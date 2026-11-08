import polygonClipping from "polygon-clipping";
import type { Feature, FeatureCollection, MultiPolygon, Position } from "geojson";
import { TILE_WIDTH, BITMAP_WIDTH, type ParsedTile, isVisited } from "./parseTile.ts";
import { globalPixelToLngLat } from "./project.ts";
import { fillBlockGaps, type BlockXY } from "./bridge.ts";

// Two layers of output:
//   - "explored"  : dissolved MultiPolygon of where the user has been
//   - "fog"       : world bbox minus explored (the terra-incognita overlay)
// Both go into a single FeatureCollection so the cron handler writes a
// single blob and the client only makes one request.

const COORD_PRECISION = 5;

type BlockKey = string;
const makeKey = (gbx: number, gby: number): BlockKey => `${gbx},${gby}`;

function roundCoord(n: number): number {
  const p = Math.pow(10, COORD_PRECISION);
  return Math.round(n * p) / p;
}

export interface GeoJsonOptions {
  /** Join small gaps between path pieces (see bridge.ts). On by default. */
  fillGaps?: boolean;
  maxGap?: number;
}

export function tilesToGeoJson(tiles: ParsedTile[], opts: GeoJsonOptions = {}): FeatureCollection {
  const blocks: BlockXY[] = [];
  for (const t of tiles) {
    for (const blk of t.blocks) {
      blocks.push([t.tileX * TILE_WIDTH + blk.bx, t.tileY * TILE_WIDTH + blk.by]);
    }
  }
  return blocksToGeoJson(blocks, opts);
}

// Same output as tilesToGeoJson, from global block coordinates. Used to
// rebuild stored snapshots from their block-key sidecars.
export function blocksToGeoJson(blocks: BlockXY[], opts: GeoJsonOptions = {}): FeatureCollection {
  const exploredCoords = buildExploredMultiPolygon(blocks, opts);
  const fogCoords = buildFogMultiPolygon(exploredCoords.map((e) => e.poly));

  // One Polygon feature per component so clicking returns just that
  // region's polygon (not the whole MultiPolygon's bbox).
  const exploredFeatures: Feature[] = exploredCoords.map((item, i) => ({
    type: "Feature",
    properties: { kind: "explored", id: i, blocks: item.blocks, filledBlocks: item.filled },
    geometry: { type: "Polygon", coordinates: item.poly },
  }));
  const fog: Feature<MultiPolygon> = {
    type: "Feature",
    properties: { kind: "fog" },
    geometry: { type: "MultiPolygon", coordinates: fogCoords },
  };
  return { type: "FeatureCollection", features: [fog, ...exploredFeatures] };
}

function buildExploredMultiPolygon(
  blocks: BlockXY[],
  opts: GeoJsonOptions,
): Array<{ poly: Position[][]; blocks: number; filled: number }> {
  const populated = new Map<BlockKey, [number, number]>();
  for (const [gbx, gby] of blocks) populated.set(makeKey(gbx, gby), [gbx, gby]);
  // Filled blocks join the shapes but are not counted as visited.
  const filledKeys = new Set<BlockKey>();
  if (opts.fillGaps ?? true) {
    for (const [gbx, gby] of fillBlockGaps(populated.values(), { maxGap: opts.maxGap })) {
      const k = makeKey(gbx, gby);
      if (populated.has(k)) continue;
      populated.set(k, [gbx, gby]);
      filledKeys.add(k);
    }
  }

  // 4-connected BFS → components.
  const seen = new Set<BlockKey>();
  const components: Array<Array<[number, number]>> = [];
  for (const [key, coord] of populated) {
    if (seen.has(key)) continue;
    const comp: Array<[number, number]> = [];
    const queue: BlockKey[] = [key];
    seen.add(key);
    while (queue.length) {
      const k = queue.shift()!;
      const c = populated.get(k)!;
      comp.push(c);
      const [x, y] = c;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nk = makeKey(x + dx, y + dy);
        if (!seen.has(nk) && populated.has(nk)) {
          seen.add(nk);
          queue.push(nk);
        }
      }
    }
    components.push(comp);
  }

  const out: Array<{ poly: Position[][]; blocks: number; filled: number }> = [];
  for (const comp of components) {
    const rects = comp.map(([gbx, gby]) => [blockRectLngLat(gbx, gby)]);
    if (rects.length === 0) continue;
    const filled = comp.filter(([gbx, gby]) => filledKeys.has(makeKey(gbx, gby))).length;
    const real = comp.length - filled;
    try {
      const [first, ...rest] = rects as unknown as Parameters<typeof polygonClipping.union>;
      const unioned = polygonClipping.union(first, ...rest) as unknown as Position[][][];
      // Usually one polygon per component; if union emits multiple pieces
      // (rare for rectilinear input), split the block count proportionally.
      const split = (n: number) =>
        unioned.length === 1 ? n : Math.max(0, Math.round(n / unioned.length));
      for (const poly of unioned) out.push({ poly, blocks: Math.max(1, split(real)), filled: split(filled) });
    } catch {
      for (const [gbx, gby] of comp) {
        const isFilled = filledKeys.has(makeKey(gbx, gby));
        out.push({ poly: [blockRectLngLat(gbx, gby)], blocks: isFilled ? 0 : 1, filled: isFilled ? 1 : 0 });
      }
    }
  }
  return out;
}

// Web Mercator clips at ~85.05°; this bbox covers the entire renderable world.
const WORLD_POLY: Position[][] = [
  [
    [-180, -85.05],
    [180, -85.05],
    [180, 85.05],
    [-180, 85.05],
    [-180, -85.05],
  ],
];

function buildFogMultiPolygon(explored: Position[][][]): Position[][][] {
  if (explored.length === 0) return [WORLD_POLY];
  try {
    type DiffArgs = Parameters<typeof polygonClipping.difference>;
    const [first, ...rest] = [WORLD_POLY, ...explored] as unknown as DiffArgs;
    const diff = polygonClipping.difference(first, ...rest) as unknown as Position[][][];
    return diff;
  } catch {
    return [WORLD_POLY];
  }
}

function blockRectLngLat(gbx: number, gby: number): Position[] {
  const gxW = gbx * BITMAP_WIDTH;
  const gxE = (gbx + 1) * BITMAP_WIDTH;
  const gyN = gby * BITMAP_WIDTH;
  const gyS = (gby + 1) * BITMAP_WIDTH;
  const [lngW, latN] = globalPixelToLngLat(gxW, gyN);
  const [lngE, latS] = globalPixelToLngLat(gxE, gyS);
  const W = roundCoord(lngW);
  const E = roundCoord(lngE);
  const N = roundCoord(latN);
  const S = roundCoord(latS);
  return [[W, N], [W, S], [E, S], [E, N], [W, N]];
}

export function geoJsonBbox(fc: FeatureCollection): [number, number, number, number] | null {
  // Explored-only bbox — ignore the world-sized fog feature.
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  let seen = false;
  for (const f of fc.features) {
    if ((f.properties as { kind?: string } | null)?.kind !== "explored") continue;
    if (f.geometry.type === "Polygon") {
      for (const ring of f.geometry.coordinates) {
        for (const [x, y] of ring) {
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
          seen = true;
        }
      }
    }
  }
  return seen ? [minX, minY, maxX, maxY] : null;
}

export function countAllVisited(tiles: ParsedTile[]): number {
  let n = 0;
  for (const t of tiles) {
    for (const blk of t.blocks) {
      for (let y = 0; y < BITMAP_WIDTH; y++) {
        for (let x = 0; x < BITMAP_WIDTH; x++) {
          if (isVisited(blk.bitmap, x, y)) n++;
        }
      }
    }
  }
  return n;
}
