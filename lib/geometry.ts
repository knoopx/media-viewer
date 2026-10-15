import type { MediaFile, GridGeom, RowGeom } from "./types";

export const GRID_GAP = 6;

export const GRID_MARGIN = 4;

export interface ContentRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Viewport {
  top: number;
  bottom: number;
  height: number;
}

export function aspectOf(f: MediaFile): number {
  const a = f.width === 0 || f.height === 0 ? 1.5 : f.width / f.height;
  return Math.max(a, 0.05);
}

export function contentWidth(viewW: number, scrollbarW: number): number {
  return Math.max(viewW - scrollbarW - 2 * GRID_MARGIN, 0);
}

export function justifiedRows(
  files: MediaFile[],
  target: number,
  availW: number,
): GridGeom {
  const rows: RowGeom[] = [];
  const n = files.length;
  let y = GRID_MARGIN;
  let i0 = 0;
  while (i0 < n) {
    let sum = 0;
    let j = i0;
    while (j < n) {
      sum += aspectOf(files[j]);
      const h = (availW - GRID_GAP * (j - i0)) / sum;
      j++;
      if (h <= target) break;
    }
    const rowH = (availW - GRID_GAP * (j - i0 - 1)) / sum;
    const h = j < n || rowH <= target ? rowH : target;
    let x = GRID_MARGIN;
    const tiles = [];
    for (let k = i0; k < j; k++) {
      const w = aspectOf(files[k]) * h;
      tiles.push({ global: k, x, w });
      x += w + GRID_GAP;
    }
    rows.push({ tiles, height: h, y });
    y += h + GRID_GAP;
    i0 = j;
  }
  return { rows, contentH: Math.max(y - GRID_GAP, 0) };
}

export function rowOf(geom: GridGeom, global: number): RowGeom | null {
  for (const r of geom.rows) {
    if (r.tiles.some((t) => t.global === global)) return r;
  }
  return null;
}

function rowRect(row: RowGeom): ContentRect {
  const w = row.tiles.reduce((m, t) => Math.max(m, t.x + t.w), 0);
  const x = row.tiles[0]?.x ?? 0;
  return {
    x,
    y: row.y,
    width: Math.max(w, 1),
    height: Math.max(row.height, 1),
  };
}

export function scrollTarget(
  geom: GridGeom,
  vp: Viewport,
  key: string,
): ContentRect | null {
  const rows = geom.rows;
  switch (key) {
    case "up": {
      const pos = rows.findIndex((r) => r.y + r.height > vp.top);
      if (pos > 0) return rowRect(rows[pos - 1]);
      return { x: 0, y: 0, width: 1, height: 1 };
    }
    case "down": {
      const visible = rows.filter((r) => r.y < vp.bottom).length;
      if (visible > 0 && visible < rows.length) return rowRect(rows[visible]);
      return { x: 0, y: geom.contentH, width: 1, height: 1 };
    }
    case "pageup": {
      const top = Math.max(vp.top - vp.height, 0);
      return { x: 0, y: top, width: 1, height: 1 };
    }
    case "pagedown": {
      const top = Math.min(vp.bottom + vp.height, geom.contentH);
      return { x: 0, y: top, width: 1, height: 1 };
    }
    case "home":
      return { x: 0, y: 0, width: 1, height: 1 };
    case "end":
      return { x: 0, y: geom.contentH, width: 1, height: 1 };
    default:
      return null;
  }
}

export interface FlatRows {
  rows: RowGeom[];

  rowOf: Map<number, number>;
}

export function flatRows(geom: GridGeom): FlatRows {
  const rowOf = new Map<number, number>();
  for (let ri = 0; ri < geom.rows.length; ri++) {
    for (const t of geom.rows[ri].tiles) rowOf.set(t.global, ri);
  }
  return { rows: geom.rows, rowOf };
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

export function moveHorizontal(
  geom: GridGeom,
  sel: number,
  right: boolean,
): number {
  const { rows, rowOf } = flatRows(geom);
  const ri = rowOf.get(sel);
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

export function moveRow(geom: GridGeom, sel: number, down: boolean): number {
  const { rows, rowOf } = flatRows(geom);
  const ri = rowOf.get(sel);
  if (ri === undefined) return sel;
  const cur = rows[ri].tiles.find((t) => t.global === sel);
  if (!cur) return sel;
  const next = down ? rows[ri + 1] : rows[ri - 1];
  if (!next) return sel;
  return nearestTile(next, cur.x + cur.w / 2);
}

export function pageMove(
  geom: GridGeom,
  sel: number,
  pages: number,
  down: boolean,
): number {
  const { rows, rowOf } = flatRows(geom);
  const ri = rowOf.get(sel);
  if (ri === undefined) return sel;
  const cur = rows[ri].tiles.find((t) => t.global === sel);
  if (!cur) return sel;
  const target = Math.min(
    Math.max(ri + (down ? pages : -pages), 0),
    rows.length - 1,
  );
  if (target === ri) return sel;
  return nearestTile(rows[target], cur.x + cur.w / 2);
}

export function rowsInViewport(geom: GridGeom, vp: Viewport): number {
  let n = 0;
  for (const r of geom.rows) {
    if (r.y >= vp.top && r.y < vp.top + vp.height) n++;
  }
  return Math.max(n, 1);
}
