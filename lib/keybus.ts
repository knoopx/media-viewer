import type { KeyMods } from "./shortcuts.ts";

type KeyHandler = (key: string, mods: KeyMods) => void;

let handler: KeyHandler | null = null;

export function setKeyHandler(h: KeyHandler | null): void {
  handler = h;
}

export function dispatchKey(key: string, mods: KeyMods): void {
  handler?.(key, mods);
}
