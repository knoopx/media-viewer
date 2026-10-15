export type Kbd = string | string[];

/**
 * A user rebind for a built-in shortcut: replaces the default bindings
 * of the named shortcut id (e.g. "exit", "open", "check"). `view`
 * scopes the rebind to one view set ("grid" or "fullscreen"); omitted,
 * it applies to whichever set contains the id (e.g. "exit" in both).
 * An empty `keys` list disables the shortcut (in the scoped views).
 */
export interface ShortcutBinding {
  id: string;

  view?: "grid" | "fullscreen";

  keys: Kbd[];
}

/**
 * A user-defined file command from the config: a keybinding plus an
 * external command (`cmd` + `args`, with a `{path}` placeholder in args)
 * run on the selected file. There are no built-in commands.
 */
export interface Command {
  id: string;

  keys: Kbd[];

  cmd: string;

  args: string[];
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
}

export interface GridGeom {
  rows: RowGeom[];
  contentH: number;
}
