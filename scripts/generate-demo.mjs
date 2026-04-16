import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseTile, countVisited } from "../lib/fog/parseTile.ts";
import { tilesToGeoJson, geoJsonBbox } from "../lib/fog/polygonize.ts";

const here = dirname(fileURLToPath(import.meta.url));
const fixtureDir = resolve(here, "../lib/fog/__tests__/fixtures");
const outPath = resolve(here, "../public/travels-demo.json");

const names = ["23e4lltkkoke", "cd36lltksiwo"];
const tiles = names.map((n) => parseTile(n, readFileSync(resolve(fixtureDir, n))));
const fc = tilesToGeoJson(tiles);
const bbox = geoJsonBbox(fc);

const payload = {
  type: "FeatureCollection",
  features: fc.features,
  metadata: {
    generatedAt: new Date().toISOString(),
    tileCount: tiles.length,
    blockCount: tiles.reduce((s, t) => s + t.blocks.length, 0),
    visitedPixelCount: tiles.reduce((s, t) => s + countVisited(t), 0),
    bbox,
    demo: true,
  },
};

writeFileSync(outPath, JSON.stringify(payload));
console.log(`wrote ${outPath} (${JSON.stringify(payload).length} bytes, bbox=${JSON.stringify(bbox)})`);
