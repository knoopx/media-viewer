import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { Command, ShortcutBinding } from "./lib/types.ts";

export interface Config {
  thumbnailSize: number;

  gap: number;
  windowWidth: number;
  windowHeight: number;

  recursive: boolean;

  commands: Command[];

  shortcuts: ShortcutBinding[];
}

export const defaultConfig: Config = {
  thumbnailSize: 240,
  gap: 8,
  windowWidth: 1440,
  windowHeight: 900,
  recursive: true,
  commands: [],
  shortcuts: [],
};

export function loadConfig(): Config {
  const candidates = [join(process.cwd(), "config.json")];
  const home = homedir();
  if (home)
    candidates.push(join(home, ".config", "media-viewer", "config.json"));

  for (const path of candidates) {
    let text: string;
    try {
      text = readFileSync(path, "utf8");
    } catch {
      continue;
    }
    try {
      const parsed = JSON.parse(text) as Partial<Config>;
      return { ...defaultConfig, ...parsed };
    } catch {
      return { ...defaultConfig };
    }
  }
  return { ...defaultConfig };
}
