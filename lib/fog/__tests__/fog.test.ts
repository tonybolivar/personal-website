import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { filenameToTile, tileToFilename } from "../filename.ts";
import { parseTile, countVisited } from "../parseTile.ts";
import { globalPixelToLngLat } from "../project.ts";
import { tilesToGeoJson, geoJsonBbox } from "../polygonize.ts";

const here = (f: string) => resolve(import.meta.dirname, "fixtures", f);

// 1. Filename round-trip and decode
{
  const a = filenameToTile("23e4lltkkoke");
  assert.equal(a.id, 117660);
  assert.equal(a.x, 412);
  assert.equal(a.y, 229);

  const b = filenameToTile("cd36lltksiwo");
  assert.equal(b.id, 117659);
  assert.equal(b.x, 411);
  assert.equal(b.y, 229);

  assert.equal(tileToFilename(117660), "23e4lltkkoke");
  assert.equal(tileToFilename(117659), "cd36lltksiwo");
  console.log("ok  filename decode & round-trip");
}

// 2. Parse + visited-count integration (upstream benchmark: 36983)
{
  const t1 = parseTile("23e4lltkkoke", readFileSync(here("23e4lltkkoke")));
  const t2 = parseTile("cd36lltksiwo", readFileSync(here("cd36lltksiwo")));
  assert.equal(t1.tileX, 412);
  assert.equal(t1.tileY, 229);
  assert.equal(t2.tileX, 411);
  assert.equal(t2.tileY, 229);

  const total = countVisited(t1) + countVisited(t2);
  assert.equal(total, 36983, `expected 36983 visited pixels, got ${total}`);
  console.log(`ok  visited pixel count: ${total}`);
  console.log(`ok  tile (412,229): ${t1.blocks.length} blocks`);
  console.log(`ok  tile (411,229): ${t2.blocks.length} blocks`);
}

// 3. Projection sanity — tile (412,229) NW corner should land on China/Vietnam border
{
  const [lng, lat] = globalPixelToLngLat(412 * 8192, 229 * 8192);
  // Tile 412 NW: 412/512*360-180 = 109.6875°E; y=229 → ~18.7°N
  assert.ok(lng > 109 && lng < 110.5, `lng ${lng} out of range`);
  assert.ok(lat > 18 && lat < 20, `lat ${lat} out of range`);
  console.log(`ok  projection: (412,229) NW → ${lng.toFixed(3)}°E, ${lat.toFixed(3)}°N`);
  // Round-trip: NW then SE of the same tile should differ by one tile width
  const [lng2, lat2] = globalPixelToLngLat(413 * 8192, 230 * 8192);
  assert.ok(lng2 - lng > 0.6 && lng2 - lng < 0.8, `tile lng width ${lng2 - lng}`);
  assert.ok(lat - lat2 > 0, `tile lat should decrease southward`);
}

// 4. End-to-end polygonize smoke test on the two fixture tiles
{
  const t1 = parseTile("23e4lltkkoke", readFileSync(here("23e4lltkkoke")));
  const t2 = parseTile("cd36lltksiwo", readFileSync(here("cd36lltksiwo")));
  const fc = tilesToGeoJson([t1, t2]);
  const explored = fc.features.find(
    (f) => (f.properties as { kind?: string })?.kind === "explored",
  );
  const fog = fc.features.find(
    (f) => (f.properties as { kind?: string })?.kind === "fog",
  );
  assert.ok(explored, "expected explored feature");
  assert.ok(fog, "expected fog feature");
  const exploredAll = fc.features.filter(
    (f) => (f.properties as { kind?: string })?.kind === "explored",
  );
  assert.ok(exploredAll.length > 0, "expected at least one explored polygon");
  const polys = exploredAll.length;
  const vertexCount = exploredAll.reduce((s, f) => {
    if (f.geometry.type !== "Polygon") return s;
    return s + (f.geometry.coordinates as any).reduce((ss: number, r: any) => ss + r.length, 0);
  }, 0);
  const bbox = geoJsonBbox(fc)!;
  assert.ok(bbox[0] > 108 && bbox[2] < 112, `unexpected bbox: ${bbox.join(",")}`);
  console.log(`ok  polygonize: ${polys} explored, ${(fog!.geometry as any).coordinates.length} fog`);
  console.log(`ok  bbox: [${bbox.map((n) => n.toFixed(3)).join(", ")}]`);
  console.log(`ok  payload size: ${JSON.stringify(fc).length} bytes`);
}

console.log("\nall fog parser tests pass");
