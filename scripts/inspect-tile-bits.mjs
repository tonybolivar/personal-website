// Inspects the unused bits in each block's 3-byte trailer to test whether
// they encode a per-block "first visited" date. The current parser only
// consumes 10 bits for the region code, leaving 14 bits per block:
//   - low 6 bits of extra1 (byte at offset 513)
//   - all 8 bits of extra2 (byte at offset 514)
//
// Prints distribution stats, a histogram, and date interpretations under
// several plausible epochs (FoW launch, Unix epoch, etc.) so you can eyeball
// whether the field looks like a date.
//
// Usage:
//   node scripts/inspect-tile-bits.mjs                     -> fixtures only
//   node scripts/inspect-tile-bits.mjs path/to/tile ...    -> specific files
//   node scripts/inspect-tile-bits.mjs --dropbox [N]       -> sample N live
//                                                            tiles from Dropbox
//                                                            (default 30)
// Dropbox mode requires .env.local with DROPBOX_APP_KEY, DROPBOX_APP_SECRET,
// DROPBOX_REFRESH_TOKEN, DROPBOX_SYNC_PATH set.

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { resolve, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { inflateSync } from "node:zlib";

const TILE_WIDTH = 128;
const TILE_HEADER_LEN = TILE_WIDTH * TILE_WIDTH;
const TILE_HEADER_SIZE = TILE_HEADER_LEN * 2;
const BLOCK_BITMAP_SIZE = 512;
const BLOCK_SIZE = 515;

const here = dirname(fileURLToPath(import.meta.url));
const defaultDir = resolve(here, "../lib/fog/__tests__/fixtures");

function tileFiles() {
  const args = process.argv.slice(2).filter((a) => a !== "--dropbox" && !/^\d+$/.test(a));
  if (args.length) return args.map((p) => resolve(p));
  return readdirSync(defaultDir)
    .filter((n) => statSync(resolve(defaultDir, n)).isFile())
    .map((n) => resolve(defaultDir, n));
}

function loadDotEnvLocal() {
  const p = resolve(here, "../.env.local");
  if (!existsSync(p)) return;
  const text = readFileSync(p, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    if (process.env[m[1]] !== undefined) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    process.env[m[1]] = v;
  }
}

async function fetchDropboxSample(limit) {
  loadDotEnvLocal();
  const required = ["DROPBOX_APP_KEY", "DROPBOX_APP_SECRET", "DROPBOX_REFRESH_TOKEN", "DROPBOX_SYNC_PATH"];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length) {
    console.error(`Missing env vars: ${missing.join(", ")}`);
    console.error("Add them to .env.local. The Vercel project already has them — copy from the Vercel dashboard.");
    process.exit(1);
  }
  const { Dropbox } = await import("dropbox");
  const nodeFetchMod = await import("node-fetch");
  const dbx = new Dropbox({
    clientId: process.env.DROPBOX_APP_KEY,
    clientSecret: process.env.DROPBOX_APP_SECRET,
    refreshToken: process.env.DROPBOX_REFRESH_TOKEN,
    fetch: nodeFetchMod.default,
  });

  console.log(`Listing ${process.env.DROPBOX_SYNC_PATH} ...`);
  const files = [];
  let res = await dbx.filesListFolder({ path: process.env.DROPBOX_SYNC_PATH, recursive: false });
  for (;;) {
    for (const e of res.result.entries) if (e[".tag"] === "file") files.push(e);
    if (!res.result.has_more) break;
    res = await dbx.filesListFolderContinue({ cursor: res.result.cursor });
  }
  const sampled = limit > 0 ? Math.min(limit, files.length) : files.length;
  console.log(`Found ${files.length} tile(s). Pulling ${sampled}.\n`);

  const picked = limit > 0 ? [...files].sort(() => Math.random() - 0.5).slice(0, limit) : files;

  // Parallel download with a small worker pool — same pattern as the cron path.
  const out = new Array(picked.length);
  let cursor = 0;
  let done = 0;
  const concurrency = 8;
  async function worker() {
    for (;;) {
      const i = cursor++;
      if (i >= picked.length) return;
      const f = picked[i];
      const dl = await dbx.filesDownload({ path: f.path_lower ?? f.id });
      const bin = dl.result.fileBinary;
      const bytes = bin instanceof Buffer ? bin : Buffer.from(bin);
      out[i] = { name: f.name, clientModified: f.client_modified, bytes };
      done++;
      if (done % 10 === 0 || done === picked.length) {
        process.stdout.write(`  downloaded ${done}/${picked.length}\r`);
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  process.stdout.write(`\n`);
  return out;
}

function parseTileRaw(buf) {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const blocks = [];
  for (let i = 0; i < TILE_HEADER_LEN; i++) {
    const blockIdx = view.getUint16(i * 2, true);
    if (blockIdx === 0) continue;
    const start = TILE_HEADER_SIZE + (blockIdx - 1) * BLOCK_SIZE;
    if (start + BLOCK_SIZE > buf.byteLength) break;
    const extra0 = buf[start + BLOCK_BITMAP_SIZE];
    const extra1 = buf[start + BLOCK_BITMAP_SIZE + 1];
    const extra2 = buf[start + BLOCK_BITMAP_SIZE + 2];
    blocks.push({ extra0, extra1, extra2 });
  }
  return blocks;
}

function describe(name, values) {
  if (values.length === 0) return console.log(`  ${name}: (empty)`);
  const sorted = [...values].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const median = sorted[Math.floor(sorted.length / 2)];
  const mean = sorted.reduce((s, v) => s + v, 0) / sorted.length;
  const unique = new Set(values).size;
  const zeroCount = values.filter((v) => v === 0).length;
  console.log(
    `  ${name.padEnd(26)} n=${values.length}  min=${min}  max=${max}  median=${median}  mean=${mean.toFixed(1)}  unique=${unique}  zeros=${zeroCount} (${((zeroCount / values.length) * 100).toFixed(1)}%)`
  );
}

function histogram(values, buckets = 30) {
  if (values.length === 0) return;
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max === min) {
    console.log(`    all values = ${min}`);
    return;
  }
  const width = (max - min) / buckets;
  const counts = new Array(buckets).fill(0);
  for (const v of values) {
    const idx = Math.min(buckets - 1, Math.floor((v - min) / width));
    counts[idx]++;
  }
  const peak = Math.max(...counts);
  const barWidth = 40;
  for (let i = 0; i < buckets; i++) {
    const lo = Math.round(min + i * width);
    const hi = Math.round(min + (i + 1) * width);
    const bar = "#".repeat(Math.round((counts[i] / peak) * barWidth));
    console.log(`    ${String(lo).padStart(6)}-${String(hi).padStart(6)}  ${String(counts[i]).padStart(5)}  ${bar}`);
  }
}

function asDate(daysSinceEpoch, epoch) {
  const ms = epoch.getTime() + daysSinceEpoch * 86400_000;
  return new Date(ms).toISOString().slice(0, 10);
}

const EPOCHS = {
  "FoW launch (2014-04-12)": new Date("2014-04-12T00:00:00Z"),
  "iOS epoch (2001-01-01)": new Date("2001-01-01T00:00:00Z"),
  "Unix epoch (1970-01-01)": new Date("1970-01-01T00:00:00Z"),
  "Y2K (2000-01-01)": new Date("2000-01-01T00:00:00Z"),
};

async function loadTiles() {
  const argv = process.argv.slice(2);
  const dropboxIdx = argv.indexOf("--dropbox");
  if (dropboxIdx !== -1) {
    const limitArg = argv[dropboxIdx + 1];
    // 0 / "all" → no cap, fetch everything.
    let limit = 30;
    if (limitArg === "all" || limitArg === "0") limit = 0;
    else if (limitArg && /^\d+$/.test(limitArg)) limit = Number(limitArg);
    const sample = await fetchDropboxSample(limit);
    return sample.map((s) => ({ label: s.name, clientModified: s.clientModified, bytes: s.bytes }));
  }
  const files = tileFiles();
  return files.map((p) => ({ label: basename(p), bytes: readFileSync(p) }));
}

function variance(values) {
  if (values.length < 2) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  return values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
}

async function main() {
  const tiles = await loadTiles();
  console.log(`Inspecting ${tiles.length} tile(s):\n`);

  const all = { e1Low6: [], e2: [], be14: [], le14: [] };
  // For spatial-coherence test: per-tile BE-14 variance + tile-mean BE-14.
  const perTileMeans = [];
  const perTileVariances = [];
  // For client-modified vs BE14 test: if BE14 encodes "days since visit",
  // tiles with newer client_modified should have lower BE14 means.
  const tileMtimeVsMean = [];
  let printedTileLines = 0;

  for (const { label, clientModified, bytes: raw } of tiles) {
    let inflated;
    try {
      inflated = inflateSync(raw);
    } catch (err) {
      console.log(`! ${label}: not zlib (${err.message}). Skipping.`);
      continue;
    }
    const blocks = parseTileRaw(inflated);
    if (printedTileLines < 6) {
      console.log(`${label}: ${blocks.length} blocks (raw ${raw.length}B → inflated ${inflated.length}B)`);
      printedTileLines++;
    } else if (printedTileLines === 6) {
      console.log(`  ... (suppressing further per-tile lines)`);
      printedTileLines++;
    }

    const e1Low6 = blocks.map((b) => b.extra1 & 0x3f);
    const e2 = blocks.map((b) => b.extra2);
    const be14 = blocks.map((b) => ((b.extra1 & 0x3f) << 8) | b.extra2);
    const le14 = blocks.map((b) => (b.extra1 & 0x3f) | (b.extra2 << 6));

    if (printedTileLines <= 6 && blocks.length > 0) {
      describe("extra1 low 6 bits", e1Low6);
      describe("extra2 (full byte)", e2);
      describe("BE 14-bit (e1<<8|e2)", be14);
      console.log();
    }

    if (blocks.length >= 2) {
      const m = be14.reduce((s, v) => s + v, 0) / be14.length;
      const v = variance(be14);
      perTileMeans.push(m);
      perTileVariances.push(v);
      if (clientModified) {
        const ts = new Date(clientModified).getTime();
        if (Number.isFinite(ts)) tileMtimeVsMean.push({ ts, mean: m, label });
      }
    }

    all.e1Low6.push(...e1Low6);
    all.e2.push(...e2);
    all.be14.push(...be14);
    all.le14.push(...le14);
  }

  console.log("\n=== Aggregate across all tiles ===");
  describe("extra1 low 6 bits", all.e1Low6);
  describe("extra2 (full byte)", all.e2);
  describe("BE 14-bit", all.be14);
  describe("LE 14-bit", all.le14);

  console.log("\nHistogram BE 14-bit (e1_lo6 << 8 | e2):");
  histogram(all.be14);
  console.log("\nHistogram LE 14-bit (e1_lo6 | e2 << 6):");
  histogram(all.le14);

  console.log("\nIf this is days-since-epoch, sample values map to:");
  for (const [label, epoch] of Object.entries(EPOCHS)) {
    const beMin = Math.min(...all.be14);
    const beMax = Math.max(...all.be14);
    const leMin = Math.min(...all.le14);
    const leMax = Math.max(...all.le14);
    console.log(`  ${label}`);
    console.log(`    BE: ${beMin} → ${asDate(beMin, epoch)},  ${beMax} → ${asDate(beMax, epoch)}`);
    console.log(`    LE: ${leMin} → ${asDate(leMin, epoch)},  ${leMax} → ${asDate(leMax, epoch)}`);
  }

  // === Spatial coherence test ===
  // If BE14 encodes a per-block first-visit DATE, neighboring blocks within
  // the same tile (~10x10 km) should have varied values (different days
  // visited). If BE14 encodes a REGION sub-code, sibling blocks should have
  // very similar/identical values (same admin region).
  //
  // Compare:
  //   within-tile variance (avg of per-tile variances)
  //   between-tile variance (variance of per-tile means)
  // If within-tile variance is small relative to between-tile variance, the
  // field is region-like. If they're comparable or within > between, it's
  // more time-like.
  console.log("\n=== Spatial coherence (variance partition) ===");
  if (perTileMeans.length >= 2) {
    const avgWithin = perTileVariances.reduce((s, v) => s + v, 0) / perTileVariances.length;
    const between = variance(perTileMeans);
    const totalVar = variance(all.be14);
    console.log(`  avg within-tile variance:   ${avgWithin.toFixed(1)}`);
    console.log(`  between-tile variance:      ${between.toFixed(1)}`);
    console.log(`  total variance:             ${totalVar.toFixed(1)}`);
    const withinFrac = totalVar > 0 ? (avgWithin / totalVar) : 0;
    console.log(`  within / total:             ${(withinFrac * 100).toFixed(1)}%`);
    console.log(`  Interpretation:`);
    console.log(`    - High within-fraction (>50%): blocks vary inside a tile -> looks TIME-like`);
    console.log(`    - Low within-fraction  (<20%): blocks share value across tile -> looks REGION-like`);
  } else {
    console.log("  (need >=2 tiles for variance partition)");
  }

  // === Client-modified vs BE14 mean ===
  // If BE14 encodes "days since first visit", tiles whose Dropbox file was
  // modified more recently should NOT systematically have lower BE14 means
  // (a tile gets re-written on any block change, but the per-block first-
  // visit date is stable). However a strong negative correlation between
  // file mtime and BE14 mean would suggest BE14 tracks something tied to
  // sync/write events rather than a stable date.
  if (tileMtimeVsMean.length >= 5) {
    const xs = tileMtimeVsMean.map((p) => p.ts);
    const ys = tileMtimeVsMean.map((p) => p.mean);
    const xMean = xs.reduce((s, v) => s + v, 0) / xs.length;
    const yMean = ys.reduce((s, v) => s + v, 0) / ys.length;
    let num = 0, dx = 0, dy = 0;
    for (let i = 0; i < xs.length; i++) {
      num += (xs[i] - xMean) * (ys[i] - yMean);
      dx += (xs[i] - xMean) ** 2;
      dy += (ys[i] - yMean) ** 2;
    }
    const corr = num / Math.sqrt(dx * dy);
    console.log(`\n=== Dropbox client_modified vs per-tile BE14 mean ===`);
    console.log(`  Pearson correlation: ${corr.toFixed(3)} (n=${xs.length})`);
    console.log(`  -> near 0: independent. Strong negative: BE14 ~ time-since-write.`);
  }

  console.log("\nVerdict guidance:");
  console.log("  - If most blocks have value 0, the bits are unused (no timestamp).");
  console.log("  - If values cluster in a plausible date range under one of the epochs, that's your encoding.");
  console.log("  - If values are uniformly random, it's not a date (maybe a hash or unused garbage).");
  console.log("  - Spatial coherence is the cleanest test: high within-tile variance = time, low = region.");
}

main();
