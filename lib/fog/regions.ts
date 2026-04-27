import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import { point } from "@turf/helpers";
import type { Feature, FeatureCollection, Polygon, MultiPolygon, Position } from "geojson";
import { TILE_WIDTH, BITMAP_WIDTH, type ParsedTile } from "./parseTile.ts";
import { globalPixelToLngLat } from "./project.ts";

const COUNTRIES_URL =
  "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson";
const STATES_URL =
  "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_1_states_provinces.geojson";
const CITIES_URL =
  "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_populated_places_simple.geojson";

type AdminFeature = Feature<Polygon | MultiPolygon, Record<string, unknown>>;

async function loadFC(url: string): Promise<AdminFeature[]> {
  const res = await fetch(url, {
    // cache the dataset across cron runs inside the Node process
    next: { revalidate: 60 * 60 * 24 * 7 },
  });
  if (!res.ok) throw new Error(`${url} returned ${res.status}`);
  const fc = (await res.json()) as FeatureCollection;
  return fc.features.filter(
    (f): f is AdminFeature => f.geometry.type === "Polygon" || f.geometry.type === "MultiPolygon",
  );
}

function boundingBoxContains(f: AdminFeature, lng: number, lat: number): boolean {
  // polygon-clipping / turf don't need a bbox pre-filter but this shaves the
  // expensive ray-casting down to features that actually could contain the point.
  const bbox = (f.bbox as number[] | undefined) ?? featureBbox(f);
  return lng >= bbox[0] && lng <= bbox[2] && lat >= bbox[1] && lat <= bbox[3];
}

function featureBbox(f: AdminFeature): [number, number, number, number] {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const visit = (r: Position[]) => {
    for (const [x, y] of r) {
      if (x < minX) minX = x; if (y < minY) minY = y;
      if (x > maxX) maxX = x; if (y > maxY) maxY = y;
    }
  };
  if (f.geometry.type === "Polygon") for (const r of f.geometry.coordinates) visit(r);
  else for (const p of f.geometry.coordinates) for (const r of p) visit(r);
  return [minX, minY, maxX, maxY];
}

function findContaining(features: AdminFeature[], lng: number, lat: number, nameKeys: string[]): string | null {
  const result = findContainingWithFeat(features, lng, lat, nameKeys);
  return result ? result.name : null;
}

function findContainingWithFeat(
  features: AdminFeature[],
  lng: number,
  lat: number,
  nameKeys: string[],
): { name: string; feat: AdminFeature } | null {
  const p = point([lng, lat]);
  for (const f of features) {
    if (!boundingBoxContains(f, lng, lat)) continue;
    if (booleanPointInPolygon(p, f)) {
      for (const k of nameKeys) {
        const v = f.properties[k];
        if (typeof v === "string" && v.length) return { name: v, feat: f };
      }
    }
  }
  return null;
}

export interface RegionEntry {
  name: string;
  blocks: number;
  bbox: [number, number, number, number];
}
export interface CityEntry {
  name: string;
  lng: number;
  lat: number;
  rank: number;
}
export interface VisitedAdminFeature {
  type: "Feature";
  // `country` is set on visited STATES so the map can filter the state-level
  // layer to one country at a time. Country features themselves don't carry it.
  // `addedOn` (YYYY-MM-DD) is stamped by the cron diff when a region first
  // appears in a daily snapshot, so the map can highlight fresh additions.
  properties: { name: string; blocks: number; country?: string; addedOn?: string };
  geometry: Polygon | MultiPolygon;
}
export interface RegionStats {
  countries: RegionEntry[];
  states: RegionEntry[];
  cities: CityEntry[];
  visitedStates: VisitedAdminFeature[];
  visitedCountries: VisitedAdminFeature[];
}

export async function regionsForTiles(tiles: ParsedTile[]): Promise<RegionStats> {
  let countryFeats: AdminFeature[] = [];
  let stateFeats: AdminFeature[] = [];
  let citiesRaw: FeatureCollection | null = null;
  try {
    const [c, s, p] = await Promise.all([
      loadFC(COUNTRIES_URL),
      loadFC(STATES_URL),
      fetch(CITIES_URL, { next: { revalidate: 60 * 60 * 24 * 7 } }).then((r) => (r.ok ? r.json() : null)),
    ]);
    countryFeats = c;
    stateFeats = s;
    citiesRaw = p;
  } catch (err) {
    console.warn("failed to load admin boundaries:", err);
    return { countries: [], states: [], cities: [], visitedStates: [], visitedCountries: [] };
  }

  // Collect populated blocks as both a set (for fast city lookup) and a list
  // of lng/lat centers (for country/state ray-casting).
  const populatedBlocks = new Set<string>();
  const blockCenters: Position[] = [];
  for (const t of tiles) {
    for (const blk of t.blocks) {
      const gbx = t.tileX * TILE_WIDTH + blk.bx;
      const gby = t.tileY * TILE_WIDTH + blk.by;
      const key = `${gbx},${gby}`;
      if (populatedBlocks.has(key)) continue;
      populatedBlocks.add(key);
      const gx = gbx * BITMAP_WIDTH + BITMAP_WIDTH / 2;
      const gy = gby * BITMAP_WIDTH + BITMAP_WIDTH / 2;
      const [lng, lat] = globalPixelToLngLat(gx, gy);
      blockCenters.push([lng, lat]);
    }
  }

  interface Hit { blocks: number; minX: number; minY: number; maxX: number; maxY: number; }
  const accumulate = (map: Map<string, Hit>, name: string, lng: number, lat: number) => {
    const cur = map.get(name);
    if (cur) {
      cur.blocks++;
      if (lng < cur.minX) cur.minX = lng;
      if (lng > cur.maxX) cur.maxX = lng;
      if (lat < cur.minY) cur.minY = lat;
      if (lat > cur.maxY) cur.maxY = lat;
    } else {
      map.set(name, { blocks: 1, minX: lng, maxX: lng, minY: lat, maxY: lat });
    }
  };

  const countryHits = new Map<string, Hit>();
  const stateHits = new Map<string, Hit>();
  // Also remember which admin feature produced each name so we can emit
  // the feature geometry for map highlighting.
  const countryByName = new Map<string, AdminFeature>();
  const stateByName = new Map<string, AdminFeature>();
  for (const [lng, lat] of blockCenters) {
    const country = findContainingWithFeat(countryFeats, lng, lat, ["ADMIN", "NAME", "NAME_LONG", "SOVEREIGNT"]);
    if (country) {
      accumulate(countryHits, country.name, lng, lat);
      if (!countryByName.has(country.name)) countryByName.set(country.name, country.feat);
    }
    const state = findContainingWithFeat(stateFeats, lng, lat, ["name", "name_en", "NAME", "gn_name"]);
    if (state) {
      accumulate(stateHits, state.name, lng, lat);
      if (!stateByName.has(state.name)) stateByName.set(state.name, state.feat);
    }
  }
  const MIN_BLOCKS = 10;
  const byBlocksDesc = (a: { blocks: number }, b: { blocks: number }) => b.blocks - a.blocks;
  const toList = (m: Map<string, Hit>) =>
    [...m.entries()]
      .filter(([, h]) => h.blocks >= MIN_BLOCKS)
      .map(([name, h]) => ({
        name,
        blocks: h.blocks,
        bbox: [h.minX, h.minY, h.maxX, h.maxY] as [number, number, number, number],
      }))
      .sort(byBlocksDesc);

  // Visited cities: for each city in Natural Earth's populated places, check
  // whether any block within ~3 km of its center is populated. The city's
  // point marker is usually at downtown city hall; users are "there" if
  // they explored within a short drive. 5x5 block neighborhood = 3 km.
  const cities: CityEntry[] = [];
  if (citiesRaw) {
    const FULL = 512 * TILE_WIDTH * BITMAP_WIDTH;
    const NEIGHBOR_RADIUS = 2;
    for (const f of citiesRaw.features) {
      if (f.geometry.type !== "Point") continue;
      const [lng, lat] = f.geometry.coordinates as [number, number];
      const gx = Math.floor(((lng + 180) / 360) * FULL);
      const latRad = (lat * Math.PI) / 180;
      const gy = Math.floor(((Math.PI - Math.asinh(Math.tan(latRad))) * FULL) / (2 * Math.PI));
      const gbx = Math.floor(gx / BITMAP_WIDTH);
      const gby = Math.floor(gy / BITMAP_WIDTH);
      let hit = false;
      for (let dy = -NEIGHBOR_RADIUS; dy <= NEIGHBOR_RADIUS && !hit; dy++) {
        for (let dx = -NEIGHBOR_RADIUS; dx <= NEIGHBOR_RADIUS && !hit; dx++) {
          if (populatedBlocks.has(`${gbx + dx},${gby + dy}`)) hit = true;
        }
      }
      if (!hit) continue;
      const props = f.properties as Record<string, unknown>;
      const name = (props.name as string) ?? (props.NAME as string) ?? "";
      const rank = (props.scalerank as number) ?? (props.SCALERANK as number) ?? 99;
      if (!name) continue;
      cities.push({ name, lng, lat, rank });
    }
    cities.sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name));
  }

  const countriesList = toList(countryHits);
  const statesList = toList(stateHits);

  const pickStr = (props: Record<string, unknown>, keys: string[]): string | undefined => {
    for (const k of keys) {
      const v = props[k];
      if (typeof v === "string" && v.length) return v;
    }
    return undefined;
  };

  const adminToFeat = (
    list: typeof countriesList,
    byName: Map<string, AdminFeature>,
    extras?: (feat: AdminFeature) => Partial<VisitedAdminFeature["properties"]>,
  ): VisitedAdminFeature[] =>
    list
      .map((r) => {
        const feat = byName.get(r.name);
        if (!feat) return null;
        const properties: VisitedAdminFeature["properties"] = { name: r.name, blocks: r.blocks };
        if (extras) Object.assign(properties, extras(feat));
        return {
          type: "Feature" as const,
          properties,
          geometry: feat.geometry,
        };
      })
      .filter((f): f is VisitedAdminFeature => f !== null);

  return {
    countries: countriesList,
    states: statesList,
    cities,
    // Tag each state with the country its NE feature belongs to so the map
    // can filter "show states only for selected country."
    visitedStates: adminToFeat(statesList, stateByName, (f) => ({
      country: pickStr(f.properties, ["admin", "ADMIN", "geounit", "sovereignt"]),
    })),
    visitedCountries: adminToFeat(countriesList, countryByName),
  };
}
