import { inflateSync } from "node:zlib";
import { filenameToTile } from "./filename.ts";

export const TILE_WIDTH = 128;
export const BITMAP_WIDTH = 64;
const TILE_HEADER_LEN = TILE_WIDTH * TILE_WIDTH;
const TILE_HEADER_SIZE = TILE_HEADER_LEN * 2;
const BLOCK_BITMAP_SIZE = 512;
const BLOCK_SIZE = 515;
const QMARK = "?".charCodeAt(0);

export interface ParsedBlock {
  bx: number;
  by: number;
  bitmap: Uint8Array;
  region: string;
}

export interface ParsedTile {
  filename: string;
  tileX: number;
  tileY: number;
  blocks: ParsedBlock[];
}

export function parseTile(filename: string, raw: Uint8Array): ParsedTile {
  const { x: tileX, y: tileY } = filenameToTile(filename);
  const buf = inflateSync(raw);
  if (buf.byteLength < TILE_HEADER_SIZE) {
    throw new Error(`${filename}: inflated size ${buf.byteLength} < header ${TILE_HEADER_SIZE}`);
  }
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const blocks: ParsedBlock[] = [];
  for (let i = 0; i < TILE_HEADER_LEN; i++) {
    const blockIdx = view.getUint16(i * 2, true);
    if (blockIdx === 0) continue;
    const start = TILE_HEADER_SIZE + (blockIdx - 1) * BLOCK_SIZE;
    if (start + BLOCK_BITMAP_SIZE > buf.byteLength) {
      throw new Error(`${filename}: block idx ${blockIdx} past eof`);
    }
    const extra0 = buf[start + BLOCK_BITMAP_SIZE];
    const extra1 = buf[start + BLOCK_BITMAP_SIZE + 1];
    const regionChar0 = String.fromCharCode((extra0 >> 3) + QMARK);
    const regionChar1 = String.fromCharCode((((extra0 & 0x7) << 2) | ((extra1 & 0xc0) >> 6)) + QMARK);
    blocks.push({
      bx: i % TILE_WIDTH,
      by: Math.floor(i / TILE_WIDTH),
      bitmap: new Uint8Array(buf.buffer, buf.byteOffset + start, BLOCK_BITMAP_SIZE),
      region: regionChar0 + regionChar1,
    });
  }
  return { filename, tileX, tileY, blocks };
}

export function isVisited(bitmap: Uint8Array, px: number, py: number): boolean {
  return (bitmap[Math.floor(px / 8) + py * 8] & (1 << (7 - (px & 7)))) !== 0;
}

export function countVisited(tile: ParsedTile): number {
  let n = 0;
  for (const blk of tile.blocks) {
    for (let y = 0; y < BITMAP_WIDTH; y++) {
      const row = blk.bitmap.subarray(y * 8, y * 8 + 8);
      for (let i = 0; i < 8; i++) {
        let b = row[i];
        while (b) {
          b &= b - 1;
          n++;
        }
      }
    }
  }
  return n;
}
