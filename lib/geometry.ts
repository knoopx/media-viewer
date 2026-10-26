import type {
  MediaFile,
  GridGeom,
  RowGeom,
  ScrollWindow,
  TileGeom,
} from "./types";

export const MIN_EDGE_GAP = 8;

export function edgeGap(gap: number): number {
  return Math.max(gap, MIN_EDGE_GAP);
}

export interface Viewport extends ScrollWindow {
  bottom: number;
}

function aspectOf(f: MediaFile): number {
  const a = f.width === 0 || f.height === 0 ? 1.5 : f.width / f.height;
  return Math.max(a, 0.05);
}

export function contentWidth(
  viewW: number,
  scrollbarW: number,
  gap: number,
): number {
  return Math.max(viewW - scrollbarW - 2 * edgeGap(gap), 0);
}

export function justifiedRows(
  files: MediaFile[],
  target: number,
  availW: number,
  gap: number,
): GridGeom {
  const rows: PendingRow[] = [];
  const n = files.length;
  const edge = edgeGap(gap);
  let i0 = 0;
  while (i0 < n) {
    let sum = 0;
    let j = i0;
    while (j < n) {
      const budget = availW - gap * (j - i0);
      if (j > i0 && budget < 0) break;
      sum += aspectOf(files[j]);
      j++;
      if (budget / sum <= target) break;
    }
    rows.push({
      i0,
      j,
      h: (availW - gap * (j - i0 - 1)) / sum,
      off: 0,
    });
    i0 = j;
  }
  repairTail(files, rows, target, availW, gap);

  const laid: RowGeom[] = [];
  let y = 0;
  rows.forEach((r, ri) => {
    let x = edge + r.off;
    const tiles: TileGeom[] = [];
    for (let k = r.i0; k < r.j; k++) {
      const w = aspectOf(files[k]) * r.h;
      tiles.push({ global: k, x, w });
      x += w + gap;
    }
    laid.push({ tiles, height: r.h, y, off: r.off });

    y += r.h + gap + (ri === 0 ? edge : 0);
  });
  const contentH = laid.length === 0 ? 0 : y - gap + edge;
  return { rows: laid, contentH, gap, edge };
}

interface PendingRow {
  i0: number;
  j: number;
  h: number;
  off: number;
}

function sumAspect(files: MediaFile[], i0: number, j: number): number {
  let s = 0;
  for (let k = i0; k < j; k++) s += aspectOf(files[k]);
  return s;
}

function hAbsorbCandidate(
  gapsM: number,
  files: MediaFile[],
  i0: number,
  j: number,
): number {
  return gapsM / (sumAspect(files, i0, j) || 1);
}

function repairTail(
  files: MediaFile[],
  rows: PendingRow[],
  target: number,
  availW: number,
  gap: number,
): void {
  const q = rows[rows.length - 1];
  if (!q) return;
  const gapsQ = availW - gap * (q.j - q.i0 - 1);
  const sumQ = sumAspect(files, q.i0, q.j);

  if (gapsQ < 0 || sumQ <= 0 || gapsQ / sumQ <= target) return;

  const p = rows.length > 1 ? rows[rows.length - 2] : undefined;
  const settled = Math.min(target, (p ? p.h : target) || target);
  const notch = gapsQ - sumQ * settled;

  let costAbsorb = Infinity;
  let hAbsorb = 0;
  if (p) {
    const merged = q.j - p.i0;
    const gapsM = availW - gap * (merged - 1);

    const above = rows.length > 2 ? rows[rows.length - 3].h : 0;
    const keepsRhythm =
      above === 0 || hAbsorbCandidate(gapsM, files, p.i0, q.j) <= above + 1e-9;
    if (gapsM >= 0 && keepsRhythm) {
      hAbsorb = gapsM / (sumAspect(files, p.i0, q.j) || 1);
      costAbsorb = 1 - hAbsorb / settled;
    }
  }
  const costCap = availW > 0 ? Math.max(notch, 0) / availW : 0;

  if (p && costAbsorb < costCap) {
    p.j = q.j;
    p.h = hAbsorb;
    rows.pop();
  } else {
    q.h = settled;

    q.off = notch > gap ? notch / 2 : 0;
  }
}

export function scrollYFor(
  geom: GridGeom,
  vp: Viewport,
  id: RowScrollCommand,
): number {
  const rows = geom.rows;
  if (id === "up") {
    const pos = rows.findIndex((r) => r.y + r.height > vp.top);
    return pos > 0 ? rows[pos - 1].y : 0;
  }
  const visible = rows.filter((r) => r.y < vp.bottom).length;
  return visible > 0 && visible < rows.length ? rows[visible].y : geom.contentH;
}

function rowIndexMap(geom: GridGeom): Map<number, number> {
  const rowOf = new Map<number, number>();
  for (let ri = 0; ri < geom.rows.length; ri++) {
    for (const t of geom.rows[ri].tiles) rowOf.set(t.global, ri);
  }
  return rowOf;
}

export interface Row extends Omit<RowGeom, "y"> {
  key: string;

  lead: number;

  trail: number;

  box: number;
}

export interface RowLayout {
  rows: Row[];

  tops: number[];

  heights: number[];
  contentH: number;
  rowIndexAt(y: number): number;
  rowOf: Map<number, number>;
}

export function buildRowLayout(geom: GridGeom): RowLayout {
  const rows: Row[] = [];
  const tops: number[] = [];
  const heights: number[] = [];
  let y = 0;
  geom.rows.forEach((r, ri) => {
    const isFirstRow = ri === 0;
    const isLastRow = ri === geom.rows.length - 1;
    const lead = isFirstRow ? geom.edge : 0;
    const trail = isLastRow ? geom.edge : geom.gap;
    const box = lead + r.height + trail;
    rows.push({
      key: `t${ri}`,
      tiles: r.tiles,
      height: r.height,
      off: r.off,
      lead,
      trail,
      box,
    });
    tops.push(y);
    heights.push(box);
    y += box;
  });
  const rowIndexAt = (target: number): number => {
    let idx = tops.length - 1;
    for (let i = 0; i < tops.length; i++) {
      if (target < tops[i] + heights[i]) {
        idx = i;
        break;
      }
    }
    return idx;
  };
  return {
    rows,
    tops,
    heights,
    contentH: y,
    rowIndexAt,
    rowOf: rowIndexMap(geom),
  };
}

function nearestTile(row: RowGeom, center: number): number {
  let best = row.tiles[0];
  let bestD = Infinity;
  for (const t of row.tiles) {
    const d = Math.abs(t.x + t.w / 2 - center);
    if (d < bestD) {
      bestD = d;
      best = t;
    }
  }
  return best.global;
}

export const MOVE_COMMANDS = [
  "left",
  "right",
  "up",
  "down",
  "page-up",
  "page-down",
  "home",
  "end",
] as const;

export type MoveCommand = (typeof MOVE_COMMANDS)[number];

export type RowScrollCommand = Extract<MoveCommand, "up" | "down">;

function moveHorizontal(geom: GridGeom, sel: number, right: boolean): number {
  const rows = geom.rows;
  const ri = rowIndexMap(geom).get(sel);
  if (ri === undefined) return sel;
  const row = rows[ri];
  const ti = row.tiles.findIndex((t) => t.global === sel);
  if (ti === -1) return sel;
  if (right) {
    if (ti + 1 < row.tiles.length) return row.tiles[ti + 1].global;
    const next = rows[ri + 1];
    return next ? next.tiles[0].global : sel;
  }
  if (ti > 0) return row.tiles[ti - 1].global;
  const prev = rows[ri - 1];
  return prev ? prev.tiles[prev.tiles.length - 1].global : sel;
}

function moveVertical(geom: GridGeom, sel: number, deltaRows: number): number {
  const rows = geom.rows;
  const ri = rowIndexMap(geom).get(sel);
  if (ri === undefined) return sel;
  const cur = rows[ri]?.tiles.find((t) => t.global === sel);
  if (!cur) return sel;
  const target = Math.min(Math.max(ri + deltaRows, 0), rows.length - 1);
  if (target === ri) return sel;
  return nearestTile(rows[target], cur.x + cur.w / 2);
}

function clampIndex(index: number, len: number): number {
  return Math.min(Math.max(index, 0), Math.max(len - 1, 0));
}

export function moveSelection(
  geom: GridGeom,
  len: number,
  sel: number,
  id: MoveCommand,
  pages: () => number,
): number {
  switch (id) {
    case "left":
      return clampIndex(moveHorizontal(geom, sel, false), len);
    case "right":
      return clampIndex(moveHorizontal(geom, sel, true), len);
    case "up":
      return clampIndex(moveVertical(geom, sel, -1), len);
    case "down":
      return clampIndex(moveVertical(geom, sel, 1), len);
    case "page-up":
      return clampIndex(moveVertical(geom, sel, -pages()), len);
    case "page-down":
      return clampIndex(moveVertical(geom, sel, pages()), len);
    case "home":
      return clampIndex(0, len);
    case "end":
      return clampIndex(len - 1, len);
  }
}

export function rowsInViewport(geom: GridGeom, vp: Viewport): number {
  let n = 0;
  for (const r of geom.rows) {
    if (r.y >= vp.top && r.y < vp.top + vp.height) n++;
  }
  return Math.max(n, 1);
}
