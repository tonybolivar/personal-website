// Ground-truth lookup: for a given lat/lng (and radius in km), pulls every
// geotagged photo nearby from the photo index, then for each photo looks up
// the fog tile + block it falls inside and prints the block's "extra bits"
// alongside the photo's takenAt timestamp. If those extra bits encode a
// per-block date, the photo's takenAt and the decoded date should line up.
//
// Usage:
//   node scripts/probe-photo-block.mjs <lat> <lng> [radiusKm]
//   node scripts/probe-photo-block.mjs pensacola
//
// Requires .env.local to have DROPBOX_* and BLOB_READ_WRITE_TOKEN set.

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { inflateSync } from "node:zlib";
import { createHash } from "node:crypto";

const here = dirname(fileURLToPath(import.meta.url));

// Mirror constants from lib/fog so this script stays self-contained.
const MAP_WIDTH = 512;
const TILE_WIDTH = 128;
const BITMAP_WIDTH = 64;
const FULL = MAP_WIDTH * TILE_WIDTH * BITMAP_WIDTH; // 4,194,304
const TILE_HEADER_LEN = TILE_WIDTH * TILE_WIDTH;
const TILE_HEADER_SIZE = TILE_HEADER_LEN * 2;
const BLOCK_BITMAP_SIZE = 512;
const BLOCK_SIZE = 515;
const MASK1 = "olhwjsktri";
const MASK2 = "eizxdwknmo";

function tileToFilename(id) {
  const s = id.toString();
  const prefix = createHash("md5").update(s, "utf8").digest("hex").slice(0, 4);
  const body = Array.from(s, (d) => MASK1.charAt(Number(d))).join("");
  const suffix = Array.from(s, (d) => MASK2.charAt(Number(d))).join("").slice(-2);
  return `${prefix}${body}${suffix}`;
}

function lngLatToBlock(lng, lat) {
  const gx = Math.floor(((lng + 180) / 360) * FULL);
  const latRad = (lat * Math.PI) / 180;
  const gy = Math.floor(((Math.PI - Math.asinh(Math.tan(latRad))) * FULL) / (2 * Math.PI));
  const gbx = Math.floor(gx / BITMAP_WIDTH);
  const gby = Math.floor(gy / BITMAP_WIDTH);
  const tileX = Math.floor(gbx / TILE_WIDTH);
  const tileY = Math.floor(gby / TILE_WIDTH);
  const bx = gbx - tileX * TILE_WIDTH;
  const by = gby - tileY * TILE_WIDTH;
  const tileId = tileY * MAP_WIDTH + tileX;
  return { tileId, tileX, tileY, bx, by, gbx, gby };
}

function distKm(a, b) {
  const R = 6371;
  const dLat = ((b[1] - a[1]) * Math.PI) / 180;
  const dLng = ((b[0] - a[0]) * Math.PI) / 180;
  const lat1 = (a[1] * Math.PI) / 180;
  const lat2 = (b[1] * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
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

async function readPhotoIndex() {
  const { get } = await import("@vercel/blob");
  const result = await get("travels/photos/index.json", { access: "private" });
  if (!result || result.statusCode !== 200) {
    throw new Error(`could not fetch photo index (status ${result?.statusCode})`);
  }
  const text = await new Response(result.stream).text();
  const parsed = JSON.parse(text);
  if (!Array.isArray(parsed)) throw new Error("photo index is not an array");
  return parsed;
}

async function fetchTileByName(name) {
  const { Dropbox } = await import("dropbox");
  const nodeFetchMod = await import("node-fetch");
  const dbx = new Dropbox({
    clientId: process.env.DROPBOX_APP_KEY,
    clientSecret: process.env.DROPBOX_APP_SECRET,
    refreshToken: process.env.DROPBOX_REFRESH_TOKEN,
    fetch: nodeFetchMod.default,
  });
  const path = `${process.env.DROPBOX_SYNC_PATH}/${name}`;
  const dl = await dbx.filesDownload({ path });
  const bin = dl.result.fileBinary;
  const bytes = bin instanceof Buffer ? bin : Buffer.from(bin);
  const inflated = inflateSync(bytes);
  return { bytes, inflated, clientModified: dl.result.client_modified };
}

function readBlockExtras(inflated, bx, by) {
  if (inflated.byteLength < TILE_HEADER_SIZE) return null;
  const view = new DataView(inflated.buffer, inflated.byteOffset, inflated.byteLength);
  const headerOffset = (by * TILE_WIDTH + bx) * 2;
  const blockIdx = view.getUint16(headerOffset, true);
  if (blockIdx === 0) return { populated: false };
  const start = TILE_HEADER_SIZE + (blockIdx - 1) * BLOCK_SIZE;
  if (start + BLOCK_SIZE > inflated.byteLength) return null;
  const extra0 = inflated[start + BLOCK_BITMAP_SIZE];
  const extra1 = inflated[start + BLOCK_BITMAP_SIZE + 1];
  const extra2 = inflated[start + BLOCK_BITMAP_SIZE + 2];
  return {
    populated: true,
    extra0,
    extra1,
    extra2,
    e1Low6: extra1 & 0x3f,
    be14: ((extra1 & 0x3f) << 8) | extra2,
    le14: (extra1 & 0x3f) | (extra2 << 6),
  };
}

const PRESETS = {
  pensacola: { lat: 30.421, lng: -87.217, radiusKm: 30, label: "Pensacola, FL" },
  colgate: { lat: 42.8189, lng: -75.5337, radiusKm: 5, label: "Colgate / Hamilton NY" },
};

function parseArgs() {
  const argv = process.argv.slice(2);
  if (argv.length === 1 && argv[0].toLowerCase() === "all") {
    return { all: true };
  }
  if (argv.length === 1 && PRESETS[argv[0].toLowerCase()]) {
    return PRESETS[argv[0].toLowerCase()];
  }
  if (argv.length >= 2) {
    const lat = parseFloat(argv[0]);
    const lng = parseFloat(argv[1]);
    const radiusKm = argv[2] ? parseFloat(argv[2]) : 25;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      console.error(`bad lat/lng: ${argv[0]}, ${argv[1]}`);
      process.exit(1);
    }
    return { lat, lng, radiusKm, label: `${lat},${lng}` };
  }
  console.error("Usage: node scripts/probe-photo-block.mjs <lat> <lng> [radiusKm]");
  console.error("       node scripts/probe-photo-block.mjs pensacola | colgate | all");
  process.exit(1);
}

function asDate(daysSinceEpoch, epoch) {
  const ms = epoch.getTime() + daysSinceEpoch * 86400_000;
  return new Date(ms).toISOString().slice(0, 10);
}

async function main() {
  loadDotEnvLocal();
  const required = [
    "DROPBOX_APP_KEY",
    "DROPBOX_APP_SECRET",
    "DROPBOX_REFRESH_TOKEN",
    "DROPBOX_SYNC_PATH",
    "BLOB_READ_WRITE_TOKEN",
  ];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length) {
    console.error(`Missing env: ${missing.join(", ")}`);
    process.exit(1);
  }

  const args = parseArgs();
  const photos = await readPhotoIndex();
  let nearby;
  let labelStr;
  if (args.all) {
    labelStr = "ALL photos";
    nearby = photos
      .map((p) => ({ ...p, distKm: 0 }))
      .sort((a, b) => (a.takenAt ?? a.uploadedAt).localeCompare(b.takenAt ?? b.uploadedAt));
    console.log(`Probing all ${photos.length} photo(s) (sorted oldest -> newest)\n`);
  } else {
    const { lat, lng, radiusKm, label } = args;
    labelStr = label;
    console.log(`Probing around ${label} (${lat}, ${lng}, ${radiusKm} km radius)\n`);
    nearby = photos
      .map((p) => ({ ...p, distKm: distKm([lng, lat], [p.lng, p.lat]) }))
      .filter((p) => p.distKm <= radiusKm)
      .sort((a, b) => a.distKm - b.distKm);
    if (nearby.length === 0) {
      console.log(`No photos within ${radiusKm} km. (${photos.length} photos in index total.)`);
      return;
    }
    console.log(`${nearby.length} photo(s) within ${radiusKm} km:\n`);
  }

  // Fetch unique tiles only.
  const tilesByName = new Map();
  for (const p of nearby) {
    const blk = lngLatToBlock(p.lng, p.lat);
    const name = tileToFilename(blk.tileId);
    p._blk = blk;
    p._tileName = name;
    if (!tilesByName.has(name)) tilesByName.set(name, null);
  }
  console.log(`Need ${tilesByName.size} unique tile(s). Fetching from Dropbox...\n`);
  for (const name of tilesByName.keys()) {
    try {
      const t = await fetchTileByName(name);
      tilesByName.set(name, t);
    } catch (err) {
      console.log(`  ${name}: NOT in Dropbox (${err.message?.slice(0, 80)})`);
      tilesByName.set(name, "missing");
    }
  }

  console.log();
  const fits = []; // collect (taken, BE14) for cross-photo epoch fit
  for (const p of nearby) {
    const t = tilesByName.get(p._tileName);
    const taken = p.takenAt ?? p.uploadedAt;
    const takenDate = new Date(taken);
    const daysAgo = Math.round((Date.now() - takenDate.getTime()) / 86400_000);
    console.log(`Photo ${p.id}  takenAt=${taken.slice(0, 10)} (${daysAgo}d ago)`);
    if (!args.all) {
      console.log(`  lng,lat=${p.lng.toFixed(5)},${p.lat.toFixed(5)}  ${p.distKm.toFixed(1)} km from ${labelStr}`);
    } else {
      console.log(`  lng,lat=${p.lng.toFixed(5)},${p.lat.toFixed(5)}`);
    }
    console.log(`  caption: ${(p.caption ?? "").slice(0, 80)}`);
    console.log(`  block: tile ${p._blk.tileId} (${p._blk.tileX},${p._blk.tileY})  bx=${p._blk.bx} by=${p._blk.by}  file=${p._tileName}`);
    if (t === null || t === "missing") {
      console.log(`  -> tile not loaded`);
      console.log();
      continue;
    }
    const blk = readBlockExtras(t.inflated, p._blk.bx, p._blk.by);
    if (!blk) {
      console.log(`  -> tile parse failed`);
    } else if (!blk.populated) {
      console.log(`  -> block UNVISITED in fog data (no header entry)`);
    } else {
      console.log(`  -> bytes  extra0=0x${blk.extra0.toString(16).padStart(2, "0")}  extra1=0x${blk.extra1.toString(16).padStart(2, "0")}  extra2=0x${blk.extra2.toString(16).padStart(2, "0")}`);
      console.log(`     e1Low6=${blk.e1Low6}  e2=${blk.extra2}  BE14=${blk.be14}  LE14=${blk.le14}`);
      const takenMs = takenDate.getTime();
      const impliedEpochDays = new Date(takenMs - blk.be14 * 86400_000);
      const impliedEpochHalf = new Date(takenMs - (blk.be14 / 2) * 86400_000);
      const impliedEpochE2Only = new Date(takenMs - blk.extra2 * 86400_000);
      console.log(`     Implied epoch (BE14 = days):         ${impliedEpochDays.toISOString().slice(0, 10)}`);
      console.log(`     Implied epoch (BE14 = half-days):    ${impliedEpochHalf.toISOString().slice(0, 10)}`);
      console.log(`     Implied epoch (extra2 only = days):  ${impliedEpochE2Only.toISOString().slice(0, 10)}`);
      fits.push({ taken: takenDate, be14: blk.be14, e2: blk.extra2 });
    }
    console.log();
  }

  // Cross-photo epoch consistency check.
  if (fits.length >= 2) {
    console.log(`=== Cross-photo epoch consistency ===`);
    console.log(`If BE14 IS days-since-fixed-epoch, the implied epoch should be the SAME across photos.`);
    const days = fits.map((f) => f.taken.getTime() - f.be14 * 86400_000);
    const half = fits.map((f) => f.taken.getTime() - (f.be14 / 2) * 86400_000);
    const e2 = fits.map((f) => f.taken.getTime() - f.e2 * 86400_000);
    const spread = (arr) => {
      const min = Math.min(...arr), max = Math.max(...arr);
      const spreadDays = Math.round((max - min) / 86400_000);
      const meanDate = new Date(arr.reduce((s, v) => s + v, 0) / arr.length);
      return { min: new Date(min).toISOString().slice(0, 10), max: new Date(max).toISOString().slice(0, 10), spreadDays, meanDate: meanDate.toISOString().slice(0, 10) };
    };
    const dRange = spread(days);
    const hRange = spread(half);
    const e2Range = spread(e2);
    console.log(`  BE14 = days        -> implied epoch range ${dRange.min} .. ${dRange.max}  (spread ${dRange.spreadDays}d, mean ${dRange.meanDate})`);
    console.log(`  BE14 = half-days   -> implied epoch range ${hRange.min} .. ${hRange.max}  (spread ${hRange.spreadDays}d, mean ${hRange.meanDate})`);
    console.log(`  extra2 only days   -> implied epoch range ${e2Range.min} .. ${e2Range.max}  (spread ${e2Range.spreadDays}d, mean ${e2Range.meanDate})`);
    console.log(`\n  -> Spread <30d means consistent epoch -> very likely a date.`);
    console.log(`  -> Spread of years means encoding is wrong (or it's not a date).`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
