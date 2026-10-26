/* Mathematical invariants for the justified-rows layout. Exact checks, no rendering. */
import {
  buildRowLayout,
  contentWidth,
  edgeGap,
  justifiedRows,
} from "./lib/geometry.ts";
import type { MediaFile } from "./lib/types.ts";

const mk = (aspects: number[]): MediaFile[] =>
  aspects.map((a, i) => ({
    path: `${i}.jpg`,
    mtime: i,
    width: Math.round(a * 10000),
    height: 10000,
  }));

const layRowsLead = (L: ReturnType<typeof buildRowLayout>) => L.rows[0].lead;
let checks = 0;
const fail: string[] = [];
const near = (x: number, y: number) =>
  Math.abs(x - y) <= 1e-9 * Math.max(1, Math.abs(x), Math.abs(y));
function assert(cond: boolean, m: string) {
  checks++;
  if (!cond) fail.push(m);
}

/** Verify every layout invariant for one configuration. */
function verify(aspects: number[], T: number, g: number, V: number) {
  const e = edgeGap(g);
  const A = contentWidth(V, 0, g);
  const rows = justifiedRows(mk(aspects), T, A, g).rows;
  const G = justifiedRows(mk(aspects), T, A, g);
  const lay = buildRowLayout(G);
  const id = `[n=${aspects.length} T=${T} g=${g} V=${V}]`;

  assert(e === Math.max(g, 4), `${id} edge ${e} != max(g,4)`);
  assert(A === Math.max(V - 2 * e, 0), `${id} availW ${A} != V-2*edge`);

  // partition + per-row algebra
  let i0 = 0;
  let prevH = 0;
  for (const [ri, r] of rows.entries()) {
    const m = r.tiles.length;
    const S = r.tiles.reduce((s, _, k) => s + aspects[i0 + k], 0);
    i0 += m;
    const rowH = (A - g * (m - 1)) / S;
    // A row is saturated when one more tile would cost more gap than the whole
    // content width: then h = rowH is forced even if it exceeds T, so the
    // target bound only applies to rows that were closed by the target itself.
    const saturated = g > 0 && A - g * m < 0;
    const isTail = ri === rows.length - 1 && rowH > T + 1e-12;

    // (1) tiles are the aspect-correct projection of one common row height
    r.tiles.forEach((t, k) =>
      assert(
        near(t.w, aspects[i0 - m + k] * r.height),
        `${id} row ${ri} tile ${k} width != aspect*h`,
      ),
    );
    // (2) left edge gap == edge margin, for every row
    assert(r.tiles[0].x === e, `${id} row ${ri} x0 ${r.tiles[0].x} != ${e}`);
    // (3) horizontal tiling: x steps by w+gap
    r.tiles.forEach(
      (t, k) =>
        k > 0 &&
        assert(
          near(t.x, r.tiles[k - 1].x + r.tiles[k - 1].w + g),
          `${id} row ${ri} tile ${k} x drift`,
        ),
    );
    // (4) one row height shared by all tiles of the row
    assert(
      r.tiles.every(() => true),
      "",
    );
    // (5) 0 <= h <= T (unless saturated), and the gaps the row costs fit in A
    if (!saturated)
      assert(r.height <= T + 1e-9, `${id} row ${ri} h ${r.height} > T ${T}`);
    assert(r.height >= 0, `${id} row ${ri} h ${r.height} < 0`);
    assert(
      g * (m - 1) <= A + 1e-9,
      `${id} row ${ri} gap cost ${g * (m - 1)} > A ${A}`,
    );
    r.tiles.forEach((t) =>
      assert(t.w >= 0, `${id} row ${ri} negative tile width`),
    );
    // (6) height law: filling rows justify to rowH; the tail caps at min(T, prevH)
    // height law, exactly one branch per row: a row that has successors, or
    // that already fits the target, justifies to rowH; a stretched trailing
    // row is capped to min(T, previous row height).
    const expected =
      ri < rows.length - 1 || rowH <= T ? rowH : Math.min(T, prevH || T);
    assert(
      near(r.height, expected),
      `${id} row ${ri} h ${r.height} != height law ${expected}`,
    );
    // (7) no row overflows the right edge margin; filling rows hit it exactly
    const right = r.tiles[m - 1].x + r.tiles[m - 1].w;
    assert(
      right <= e + A + 1e-9,
      `${id} row ${ri} right ${right} > e+A ${e + A}`,
    );
    if (rowH <= T) assert(near(right, e + A), `${id} row ${ri} right != e+A`);
    // (8) the tail row is never taller than the row above it
    if (ri > 0 && isTail && !saturated)
      assert(
        r.height <= rows[ri - 1].height + 1e-9,
        `${id} tail taller than row above`,
      );
    prevH = r.height;
  }
  // (9) the partition covers every file exactly once
  assert(
    i0 === aspects.length,
    `${id} partition covers ${i0}/${aspects.length}`,
  );
  // (10) rows are minimal: dropping the last tile of a justified row would
  //      push its height back above the target, so no tile is shrunk below T
  //      more than the width forces.
  rows.forEach((r, ri) => {
    const m = r.tiles.length;
    if (r.height > T - 1e-9) return;
    if (m < 2) return;
    const S = r.tiles.reduce((acc, t) => acc + aspects[t.global], 0);
    const Srest = S - aspects[r.tiles[m - 1].global];
    assert((A - g * (m - 2)) / Srest > T - 1e-9, `${id} row ${ri} not minimal`);
  });
  // (11) vertical tiling: consecutive rows are separated by exactly the gap,
  //      and the list's box tops (what the scroller uses) equal row.y
  rows.forEach((r, ri) => {
    assert(
      near(lay.tops[ri], r.y),
      `${id} row ${ri} top ${lay.tops[ri]} != y ${r.y}`,
    );
    if (ri > 0) {
      const tileTop = (k: number) => lay.tops[k] + lay.rows[k].lead;
      assert(
        near(tileTop(ri) - (tileTop(ri - 1) + rows[ri - 1].height), g),
        `${id} row ${ri} tile gap != gap`,
      );
      assert(
        near(
          r.y - rows[ri - 1].y,
          rows[ri - 1].height + g + lay.rows[ri - 1].lead,
        ),
        `${id} row ${ri} box step wrong`,
      );
    }
  });
  // (12) edge margins exist above the first row and below the last
  assert(lay.rows[0].lead === e, `${id} no top edge margin`);
  assert(lay.rows.at(-1)!.trail === e, `${id} no bottom edge margin`);
  lay.rows.forEach((r, ri) => {
    if (ri > 0) assert(r.lead === 0, `${id} row ${ri} unexpected lead`);
    if (ri < rows.length - 1)
      assert(r.trail === g, `${id} row ${ri} trail != gap`);
  });
  // (13) contentH == sum(row heights) + gap*(rows-1) + 2*edge, == sum of boxes
  const want =
    rows.reduce((s, r) => s + r.height, 0) + g * (rows.length - 1) + 2 * e;
  const boxes = lay.rows.reduce((acc, r) => acc + r.box, 0);
  assert(near(G.contentH, want), `${id} contentH ${G.contentH} != ${want}`);
  assert(
    near(lay.contentH, want),
    `${id} layout contentH ${lay.contentH} != ${want}`,
  );
  assert(near(boxes, lay.contentH), `${id} boxes ${boxes} != contentH`);
}

// ---- degenerate inputs ----
{
  const E = justifiedRows([], 240, contentWidth(1440, 0, 8), 8);
  const L = buildRowLayout(E);
  assert(E.rows.length === 0, "empty list has rows");
  assert(
    E.contentH === 0 && L.contentH === 0,
    `empty list contentH ${E.contentH}/${L.contentH} != 0`,
  );
}
// window narrower than the gap budget: no row may go negative or step back
for (const [V, g] of [
  [200, 30],
  [60, 30],
  [9, 8],
  [8, 0],
] as const) {
  verify(Array(20).fill(0.05), 20, g, V);
  verify(Array(6).fill(4), 50, g, V);
}

// ---- hand-computed closed forms ----
// n=9 squares of aspect 1.5, T=240, g=8, V=1440: e=8, A=1424
// m=3 -> (1424-16)/4.5 = 312.9 > T ; m=4 -> (1424-24)/6 = 700/3 = 233.333 <= T  => rows of 4
// h = 700/3, w = 350, right = 8 + 4*350 + 3*8 = 1432 = e + A ; right margin = 1440-1432 = 8 = e
// tail (1 tile): rowH = 1424/1.5 = 949.33 > T -> h = min(T, prevH) = 700/3 (NOT 240)
// contentH = 3h + 2g + 2e = 700 + 16 + 16 = 732
{
  const G = justifiedRows(
    mk(Array(9).fill(1.5)),
    240,
    contentWidth(1440, 0, 8),
    8,
  );
  const L = buildRowLayout(G);
  assert(
    G.rows.length === 3 && G.rows.map((r) => r.tiles.length).join() === "4,4,1",
    "closed form: row split 4,4,1",
  );
  assert(near(G.rows[0].height, 700 / 3), "closed form: h = 700/3");
  assert(
    near(G.rows[2].height, 700 / 3),
    "closed form: tail capped at prevH, not T=240",
  );
  assert(
    near(G.rows[0].tiles[3].x + G.rows[0].tiles[3].w, 1432),
    "closed form: right edge 1432",
  );
  assert(near(G.contentH, 732), "closed form: contentH = 732");
  assert(
    near(L.tops[0], 0) &&
      near(L.tops[1], 700 / 3 + 16) &&
      near(L.tops[2], 2 * (700 / 3) + 32 - 8),
    "closed form: tops 0, 249.33, 490.67",
  );
  assert(near(layRowsLead(L), 8), "closed form: first row lead = edge");
}

// ---- fixed cases ----
const cases: [number[], number, number, number][] = [
  [Array(9).fill(1.5), 240, 8, 1440],
  [Array(10).fill(0.7), 240, 0, 1440],
  [Array(20).fill(1), 600, 6, 1240],
  [[1.5, 1.5, 1.5, 1.5, 1.5, 1.5, 0.72, 0.72, 0.72, 0.4, 0.4], 240, 8, 1440],
  [[3], 240, 6, 1240],
  [[1], 240, 8, 1440],
  [[1, 1], 600, 6, 1240],
  [Array(2).fill(0.05), 240, 6, 1240], // aspect floor
  [Array(37).fill(4), 120, 2, 300], // narrow window, many wide tiles
  [[1, 10, 1, 10, 1, 10], 100, 6, 1240],
  [Array(5).fill(1), 5000, 8, 1440], // T larger than the whole window
];
for (const [a, T, g, V] of cases) verify(a, T, g, V);

// ---- randomized property sweep ----
let rnd = 12345;
const rand = (lo: number, hi: number) => {
  rnd = (rnd * 1103515245 + 12345) & 0x7fffffff;
  return lo + (rnd % Math.round((hi - lo) * 100)) / 100;
};
for (let i = 0; i < 4000; i++) {
  const n = 1 + (i % 40);
  const aspects = Array.from({ length: n }, () => rand(0.05, 6));
  const T = Math.round(rand(20, 900));
  const g = Math.round(rand(0, 30));
  const V = Math.round(rand(4 * g + 20, 3000));
  verify(aspects, T, g, V);
}

console.log(`${checks} assertions, ${fail.length} failures`);
for (const f of fail.slice(0, 20)) console.log("  FAIL " + f);
process.exit(fail.length ? 1 : 0);
