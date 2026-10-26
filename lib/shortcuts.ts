import { MOVE_COMMANDS, type MoveCommand } from "./geometry.ts";
import type { Command, Kbd, ShortcutBinding } from "./types.ts";

export interface Shortcut {
  id: string;
  kbds: Kbd[];
}

export interface KeyMods {
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  cmd?: boolean;
}

const MODIFIER_IDS: Record<string, keyof KeyMods> = {
  ctrl: "ctrl",
  shift: "shift",
  alt: "alt",
  cmd: "cmd",
};

function bindingMatches(binding: Kbd, key: string, mods: KeyMods): boolean {
  const codes = Array.isArray(binding) ? binding : [binding];
  const code = codes[codes.length - 1];
  if (code !== key) return false;
  for (let i = 0; i < codes.length - 1; i++) {
    const m = MODIFIER_IDS[codes[i]];
    if (m && !mods[m]) return false;
  }
  return true;
}

export function matchShortcut(
  set: Shortcut[],
  key: string,
  mods: KeyMods = {},
): Shortcut | null {
  let best: Shortcut | null = null;
  let bestScore = -1;
  for (const s of set) {
    for (const b of s.kbds) {
      if (!bindingMatches(b, key, mods)) continue;
      const score = (Array.isArray(b) ? b : [b]).length - 1;
      if (score > bestScore) {
        best = s;
        bestScore = score;
      }
    }
  }
  return best;
}

export function commandShortcuts(commands: Command[]): Shortcut[] {
  return commands.map((c) => ({ id: c.id, kbds: c.keys }));
}

export function withOverrides(
  set: Shortcut[],
  rebinds: ShortcutBinding[],
  view: "grid" | "fullscreen",
): Shortcut[] {
  const scoped = rebinds.filter((r) => r.view === undefined || r.view === view);
  if (scoped.length === 0) return set;
  const byId = new Map<string, ShortcutBinding>();
  for (const r of scoped) byId.set(r.id, r);
  const out: Shortcut[] = [];
  for (const s of set) {
    const r = byId.get(s.id);
    if (r) {
      if (r.keys.length === 0) continue;
      out.push({ ...s, kbds: r.keys });
    } else {
      out.push(s);
    }
  }
  return out;
}

const NAV: Record<MoveCommand, Kbd[]> = {
  left: ["left"],
  right: ["right"],
  up: ["up"],
  down: ["down"],
  "page-up": ["pageup"],
  "page-down": ["pagedown"],
  home: ["home"],
  end: ["end"],
};

export const GRID: Shortcut[] = [
  { id: "exit", kbds: ["q", "escape"] },
  { id: "open", kbds: ["enter"] },
  { id: "check", kbds: ["space"] },
  ...MOVE_COMMANDS.map((id) => ({ id, kbds: NAV[id] })),
];

export const FULLSCREEN: Shortcut[] = [
  { id: "exit", kbds: ["q"] },
  { id: "back", kbds: ["escape", "enter"] },
  { id: "prev", kbds: ["left"] },
  { id: "next", kbds: ["right"] },
];
