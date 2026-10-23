import { spawnSync } from "node:child_process";
import type { Command } from "./types.ts";

export function findCommand(commands: Command[], id: string): Command | null {
  return commands.find((c) => c.id === id) ?? null;
}

export function runCommand(cmd: Command, path: string): boolean {
  const args = cmd.args.map((a) => a.replace(/\{path\}/g, path));
  const r = spawnSync(cmd.cmd, args, { stdio: "ignore" });
  return r.status === 0;
}
