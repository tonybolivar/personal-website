// Fills small gaps in the explored block grid so a trip draws as one path.
//
// Fog of World only marks blocks the phone actually got a GPS fix in. Fast
// driving, tunnels and subways leave holes, and two blocks that touch only at
// a corner render as separate squares. This adds "filled" blocks:
//   1. From every loose end of a path, look ahead (within MAX_ANGLE of the
//      direction the path was heading) for another piece of explored ground
//      up to maxGap blocks away, and join them with a 4-connected staircase.
//      Repeats until nothing new joins, so chains of single dots link up.
//   2. Corner-only touches get one block so the squares share an edge.
// Filled blocks are drawn on the map but never counted as visited.

export type BlockXY = [number, number];

export interface FillOptions {
  /** Largest gap to close, in blocks (Chebyshev distance). One block is ~0.5 km. */
  maxGap?: number;
}

export const DEFAULT_MAX_GAP = 8;
const MAX_ANGLE_DEG = 60;
const DIRECTION_RADIUS = 3;
const MAX_PASSES = 6;

const SHIFT = 65536;
const key = (x: number, y: number) => x * SHIFT + y;
const keyX = (k: number) => Math.floor(k / SHIFT);
const keyY = (k: number) => k - Math.floor(k / SHIFT) * SHIFT;

const N8: BlockXY[] = [
  [-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1],
];

function label8(blocks: Set<number>): { lab: Map<number, number>; comps: number[][] } {
  const lab = new Map<number, number>();
  const comps: number[][] = [];
  for (const b of blocks) {
    if (lab.has(b)) continue;
    const id = comps.length;
    const comp = [b];
    const stack = [b];
    lab.set(b, id);
    while (stack.length) {
      const k = stack.pop()!;
      const x = keyX(k);
      const y = keyY(k);
      for (const [dx, dy] of N8) {
        const n = key(x + dx, y + dy);
        if (blocks.has(n) && !lab.has(n)) {
          lab.set(n, id);
          stack.push(n);
          comp.push(n);
        }
      }
    }
    comps.push(comp);
  }
  return { lab, comps };
}

// Blocks strictly between a and b, stepping one axis at a time.
function staircase(ax: number, ay: number, bx: number, by: number): BlockXY[] {
  const nx = Math.abs(bx - ax);
  const ny = Math.abs(by - ay);
  const sx = bx > ax ? 1 : -1;
  const sy = by > ay ? 1 : -1;
  let x = ax;
  let y = ay;
  let ix = 0;
  let iy = 0;
  const out: BlockXY[] = [];
  while (ix < nx || iy < ny) {
    const stepX = nx && ny ? (0.5 + ix) / nx < (0.5 + iy) / ny : nx > 0;
    if (stepX) {
      x += sx;
      ix++;
    } else {
      y += sy;
      iy++;
    }
    out.push([x, y]);
  }
  out.pop();
  return out;
}

export function fillBlockGaps(real: Iterable<BlockXY>, opts: FillOptions = {}): BlockXY[] {
  const maxGap = opts.maxGap ?? DEFAULT_MAX_GAP;
  const minCos = Math.cos((MAX_ANGLE_DEG * Math.PI) / 180);
  const blocks = new Set<number>();
  for (const [x, y] of real) blocks.add(key(x, y));
  const filled: number[] = [];

  for (let pass = 0; pass < MAX_PASSES; pass++) {
    const { lab, comps } = label8(blocks);
    const joins: Array<[number, number]> = [];

    for (let ci = 0; ci < comps.length; ci++) {
      const comp = comps[ci];
      const ends =
        comp.length === 1
          ? comp
          : comp.filter((k) => {
              const x = keyX(k);
              const y = keyY(k);
              let deg = 0;
              for (const [dx, dy] of N8) if (blocks.has(key(x + dx, y + dy))) deg++;
              return deg <= 1;
            });

      for (const e of ends) {
        const ex = keyX(e);
        const ey = keyY(e);

        let dirX = 0;
        let dirY = 0;
        let hasDir = false;
        let n = 0;
        let mx = 0;
        let my = 0;
        for (const k of comp) {
          if (k === e) continue;
          const x = keyX(k);
          const y = keyY(k);
          if (Math.max(Math.abs(x - ex), Math.abs(y - ey)) <= DIRECTION_RADIUS) {
            mx += x;
            my += y;
            n++;
          }
        }
        if (n > 0) {
          dirX = ex - mx / n;
          dirY = ey - my / n;
          hasDir = dirX !== 0 || dirY !== 0;
        }

        let best: { dist: number; t: number } | null = null;
        for (let r = 2; r <= maxGap && !best; r++) {
          for (let dx = -r; dx <= r; dx++) {
            const dys = Math.abs(dx) < r ? [-r, r] : Array.from({ length: 2 * r + 1 }, (_, i) => i - r);
            for (const dy of dys) {
              const t = key(ex + dx, ey + dy);
              if (!blocks.has(t) || lab.get(t) === ci) continue;
              const dist = Math.hypot(dx, dy);
              if (hasDir) {
                const cos = (dx * dirX + dy * dirY) / (dist * Math.hypot(dirX, dirY));
                if (cos < minCos) continue;
              }
              if (!best || dist < best.dist) best = { dist, t };
            }
          }
        }
        if (best) joins.push([e, best.t]);
      }
    }

    if (joins.length === 0) break;
    for (const [e, t] of joins) {
      for (const [x, y] of staircase(keyX(e), keyY(e), keyX(t), keyY(t))) {
        const k = key(x, y);
        if (!blocks.has(k)) {
          blocks.add(k);
          filled.push(k);
        }
      }
    }
  }

  const corners: number[] = [];
  for (const k of blocks) {
    const x = keyX(k);
    const y = keyY(k);
    for (const dy of [1, -1]) {
      if (blocks.has(key(x + 1, y + dy)) && !blocks.has(key(x + 1, y)) && !blocks.has(key(x, y + dy))) {
        corners.push(key(x + 1, y));
      }
    }
  }
  for (const k of corners) {
    if (!blocks.has(k)) {
      blocks.add(k);
      filled.push(k);
    }
  }

  return filled.map((k) => [keyX(k), keyY(k)] as BlockXY);
}
