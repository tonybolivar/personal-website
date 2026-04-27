import { get, list, put } from "@vercel/blob";
import type { Feature } from "geojson";
import { fetchSyncFiles } from "@/lib/dropbox";
import { parseTile, countVisited, TILE_WIDTH, type ParsedTile } from "@/lib/fog/parseTile";
import { tilesToGeoJson, geoJsonBbox } from "@/lib/fog/polygonize";
import { regionsForTiles, type VisitedAdminFeature } from "@/lib/fog/regions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BLOB_KEY = "travels/latest.json";

function blockKeysFromTiles(tiles: ParsedTile[]): Set<string> {
  const set = new Set<string>();
  for (const t of tiles) {
    for (const blk of t.blocks) {
      const gbx = t.tileX * TILE_WIDTH + blk.bx;
      const gby = t.tileY * TILE_WIDTH + blk.by;
      set.add(`${gbx},${gby}`);
    }
  }
  return set;
}

async function loadPriorBlockKeys(today: string): Promise<Set<string> | null> {
  try {
    const { blobs } = await list({ prefix: "travels/keys/" });
    const dates = blobs
      .map((b) => b.pathname.match(/travels\/keys\/(\d{4}-\d{2}-\d{2})\.keys\.json$/)?.[1])
      .filter((d): d is string => Boolean(d) && d !== today)
      .sort()
      .reverse();
    if (dates.length === 0) return null;
    const result = await get(`travels/keys/${dates[0]}.keys.json`, { access: "private" });
    if (!result || result.statusCode !== 200) return null;
    const text = await new Response(result.stream).text();
    const arr = JSON.parse(text);
    return Array.isArray(arr) ? new Set(arr) : null;
  } catch (err) {
    console.warn("[cron/travels] could not load prior block keys:", err);
    return null;
  }
}

// Keep only blocks whose global key is in `keep`. Tiles with no remaining
// blocks are dropped so polygonize doesn't iterate empty containers.
function filterTilesByKeys(tiles: ParsedTile[], keep: Set<string>): ParsedTile[] {
  return tiles
    .map((t) => ({
      ...t,
      blocks: t.blocks.filter((blk) => {
        const gbx = t.tileX * TILE_WIDTH + blk.bx;
        const gby = t.tileY * TILE_WIDTH + blk.by;
        return keep.has(`${gbx},${gby}`);
      }),
    }))
    .filter((t) => t.blocks.length > 0);
}

interface PriorSnapshot {
  date: string;
  visitedStateNames: Set<string>;
  visitedCountryNames: Set<string>;
}

async function loadPriorSnapshot(today: string): Promise<PriorSnapshot | null> {
  try {
    const { blobs } = await list({ prefix: "travels/history/" });
    const dates = blobs
      .map((b) => b.pathname.match(/travels\/history\/(\d{4}-\d{2}-\d{2})\.json$/)?.[1])
      .filter((d): d is string => Boolean(d) && d !== today)
      .sort()
      .reverse();
    if (dates.length === 0) return null;
    const priorDate = dates[0];
    const result = await get(`travels/history/${priorDate}.json`, { access: "private" });
    if (!result || result.statusCode !== 200) return null;
    const text = await new Response(result.stream).text();
    const parsed = JSON.parse(text) as {
      metadata?: {
        visitedStates?: VisitedAdminFeature[];
        visitedCountries?: VisitedAdminFeature[];
      };
    };
    const namesOf = (xs?: VisitedAdminFeature[]) => {
      const set = new Set<string>();
      for (const f of xs ?? []) {
        const n = f.properties?.name;
        if (typeof n === "string" && n.length) set.add(n);
      }
      return set;
    };
    return {
      date: priorDate,
      visitedStateNames: namesOf(parsed.metadata?.visitedStates),
      visitedCountryNames: namesOf(parsed.metadata?.visitedCountries),
    };
  } catch (err) {
    console.warn("[cron/travels] could not load prior snapshot:", err);
    return null;
  }
}

function tagNewRegions(
  features: VisitedAdminFeature[],
  priorNames: Set<string>,
  today: string,
): VisitedAdminFeature[] {
  return features.map((f) => {
    const n = f.properties?.name;
    if (!n || priorNames.has(n)) return f;
    return { ...f, properties: { ...f.properties, addedOn: today } };
  });
}

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET ?? ""}`;
  if (!process.env.CRON_SECRET || auth !== expected) {
    return new Response("unauthorized", { status: 401 });
  }

  try {
    return await run();
  } catch (err) {
    console.error("[cron/travels] fatal", err);
    return Response.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      },
      { status: 500 },
    );
  }
}

async function run() {
  const started = Date.now();
  const files = await fetchSyncFiles();
  const fetchedMs = Date.now() - started;

  const tiles = [];
  const skipped: { name: string; reason: string }[] = [];
  for (const f of files) {
    try {
      tiles.push(parseTile(f.name, f.bytes));
    } catch (err) {
      skipped.push({ name: f.name, reason: err instanceof Error ? err.message : String(err) });
    }
  }
  const parsedMs = Date.now() - started - fetchedMs;

  const visitedPixelCount = tiles.reduce((s, t) => s + countVisited(t), 0);
  const blockCount = tiles.reduce((s, t) => s + t.blocks.length, 0);

  const fc = tilesToGeoJson(tiles);
  const bbox = geoJsonBbox(fc);
  const polygonizeMs = Date.now() - started - fetchedMs - parsedMs;

  const { countries, states, cities, visitedStates, visitedCountries } = await regionsForTiles(tiles);
  const regionsMs = Date.now() - started - fetchedMs - parsedMs - polygonizeMs;

  // Diff against the most recent prior daily snapshot so newly-appeared
  // states/countries can be highlighted on the map. Tagging is by name; the
  // map renders features with addedOn === <generatedAt date> in a fresh hue.
  const today = new Date().toISOString().slice(0, 10);
  const prior = await loadPriorSnapshot(today);
  const taggedStates = prior
    ? tagNewRegions(visitedStates, prior.visitedStateNames, today)
    : visitedStates;
  const taggedCountries = prior
    ? tagNewRegions(visitedCountries, prior.visitedCountryNames, today)
    : visitedCountries;

  // Block-level diff: which (gbx,gby) keys appeared since the last cron run?
  // Polygonize just those blocks separately so the map can paint a fresh
  // overlay on top of the base explored layer. Keys are saved to a sidecar
  // blob so the next run can compare without bloating the public snapshot.
  const todayKeys = blockKeysFromTiles(tiles);
  const priorKeys = await loadPriorBlockKeys(today);
  let newExploredFeatures: Feature[] = [];
  if (priorKeys) {
    const newKeys = new Set<string>();
    for (const k of todayKeys) if (!priorKeys.has(k)) newKeys.add(k);
    if (newKeys.size > 0) {
      const newTiles = filterTilesByKeys(tiles, newKeys);
      const newFc = tilesToGeoJson(newTiles);
      newExploredFeatures = newFc.features
        .filter((f) => (f.properties as { kind?: string })?.kind === "explored")
        .map((f) => ({
          ...f,
          properties: { ...(f.properties ?? {}), kind: "explored-new", addedOn: today },
        }));
    }
  }
  const diffMs = Date.now() - started - fetchedMs - parsedMs - polygonizeMs - regionsMs;

  const payload = {
    type: "FeatureCollection" as const,
    features: [...fc.features, ...newExploredFeatures],
    metadata: {
      generatedAt: new Date().toISOString(),
      tileCount: tiles.length,
      skippedTileCount: skipped.length,
      blockCount,
      visitedPixelCount,
      bbox,
      countries,
      states,
      cities,
      visitedStates: taggedStates,
      visitedCountries: taggedCountries,
      priorSnapshotDate: prior?.date ?? null,
      newBlockCount: newExploredFeatures.length,
      timings: { fetchedMs, parsedMs, polygonizeMs, regionsMs, diffMs },
    },
  };

  const body = JSON.stringify(payload);
  // Sidecar: save today's block keys so tomorrow's run has a baseline.
  // Sorted for diff stability; cached aggressively (snapshots are immutable).
  const keysBody = JSON.stringify([...todayKeys].sort());
  const [blob] = await Promise.all([
    put(BLOB_KEY, body, {
      access: "private",
      contentType: "application/geo+json",
      cacheControlMaxAge: 3600,
      allowOverwrite: true,
    }),
    put(`travels/history/${today}.json`, body, {
      access: "private",
      contentType: "application/geo+json",
      cacheControlMaxAge: 3600 * 24 * 365,
      allowOverwrite: true,
    }),
    put(`travels/keys/${today}.keys.json`, keysBody, {
      access: "private",
      contentType: "application/json",
      cacheControlMaxAge: 3600 * 24 * 365,
      allowOverwrite: true,
    }),
  ]);

  return Response.json({
    ok: true,
    url: blob.url,
    snapshot: today,
    ...payload.metadata,
    bytes: body.length,
    skipped,
  });
}
