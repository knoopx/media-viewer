export type Kbd = string | string[];

export interface ShortcutBinding {
  id: string;

  view?: "grid" | "fullscreen";

  keys: Kbd[];
}

export interface Command {
  id: string;

  keys: Kbd[];

  cmd: string;

  args: string[];
}

export interface ScrollWindow {
  top: number;
  height: number;
}

export interface MediaFile {
  path: string;

  mtime: number;

  width: number;

  height: number;
}

export interface TileGeom {
  global: number;

  x: number;

  w: number;
}

export interface RowGeom {
  tiles: TileGeom[];
  height: number;
  y: number;

  off: number;
}

export interface GridGeom {
  rows: RowGeom[];
  contentH: number;
  gap: number;

  edge: number;
}
