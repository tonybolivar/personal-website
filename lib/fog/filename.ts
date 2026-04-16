import { createHash } from "node:crypto";

const MASK1 = "olhwjsktri";
const MASK2 = "eizxdwknmo";
export const MAP_WIDTH = 512;

export interface TileCoords {
  id: number;
  x: number;
  y: number;
}

export function filenameToTile(filename: string): TileCoords {
  if (filename.length < 6) {
    throw new Error(`filename too short: ${filename}`);
  }
  const middle = filename.slice(4, -2);
  let id = 0;
  for (const ch of middle) {
    const d = MASK1.indexOf(ch);
    if (d < 0) throw new Error(`bad MASK1 char '${ch}' in ${filename}`);
    id = id * 10 + d;
  }
  if (id < 0 || id >= MAP_WIDTH * MAP_WIDTH) {
    throw new Error(`tile id ${id} out of range in ${filename}`);
  }
  if (tileToFilename(id) !== filename) {
    throw new Error(`filename ${filename} fails round-trip (expected ${tileToFilename(id)})`);
  }
  return { id, x: id % MAP_WIDTH, y: Math.floor(id / MAP_WIDTH) };
}

export function tileToFilename(id: number): string {
  const s = id.toString();
  const prefix = createHash("md5").update(s, "utf8").digest("hex").slice(0, 4);
  const body = Array.from(s, (d) => MASK1.charAt(Number(d))).join("");
  const suffix = Array.from(s, (d) => MASK2.charAt(Number(d))).join("").slice(-2);
  return `${prefix}${body}${suffix}`;
}
