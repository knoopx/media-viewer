import { render } from "@gpuix/react";
import { statSync } from "node:fs";
import { App } from "./App.tsx";
import { loadConfig, type Config } from "./config.ts";
import { dispatchKey } from "./lib/keybus.ts";
import { scan } from "./lib/scan.ts";

const USAGE = `usage: media-viewer [options] <directory>

options:
  --theme <dark|light>   theme (default: dark)
  --thumbnail-size <px>  target tile height (default: 240)
  --gap <px>             grid spacing (default: 8)
  --window-width <px>    window width (default: 1440)
  --window-height <px>   window height (default: 900)
  --no-recursive         do not scan subdirectories
  -h, --help             show this help

Flags override config.json values; omitted flags fall back to the
config file, then built-in defaults.`;

function failUsage(message?: string): never {
  if (message) {
    console.error(message);
  }
  console.error(USAGE);
  process.exit(2);
}

function parseFlags(argv: string[]): { dir: string; overrides: Partial<Config> } {
  const overrides: Partial<Config> = {};
  const positional: string[] = [];

  const valueOf = (flag: string, i: number): string => {
    const value = argv[i + 1];
    if (value === undefined || value.startsWith("-")) {
      failUsage(`missing value for ${flag}`);
    }
    return value;
  };

  const numberOverride = (
    flag: string,
    i: number,
    key: "thumbnailSize" | "gap" | "windowWidth" | "windowHeight",
  ) => {
    const raw = valueOf(flag, i);
    const value = Number(raw);
    if (!Number.isFinite(value) || value <= 0) {
      failUsage(`invalid value for ${flag}: ${raw}`);
    }
    overrides[key] = value;
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case "-h":
      case "--help":
        console.log(USAGE);
        process.exit(0);
        break;
      case "--theme": {
        const value = valueOf(arg, i);
        i++;
        if (value !== "dark" && value !== "light") {
          failUsage(`invalid theme: ${value}`);
        }
        overrides.theme = value;
        break;
      }
      case "--thumbnail-size":
        numberOverride(arg, i, "thumbnailSize");
        i++;
        break;
      case "--gap":
        numberOverride(arg, i, "gap");
        i++;
        break;
      case "--window-width":
        numberOverride(arg, i, "windowWidth");
        i++;
        break;
      case "--window-height":
        numberOverride(arg, i, "windowHeight");
        i++;
        break;
      case "--no-recursive":
        overrides.recursive = false;
        break;
      default:
        if (arg.startsWith("-")) {
          failUsage(`unknown option: ${arg}`);
        }
        positional.push(arg);
    }
  }

  if (positional.length !== 1) {
    failUsage();
  }
  return { dir: positional[0], overrides };
}

async function main() {
  const { dir, overrides } = parseFlags(process.argv.slice(2));
  let isDir = false;
  try {
    isDir = statSync(dir).isDirectory();
  } catch {
    isDir = false;
  }
  if (!isDir) {
    console.error(`not a directory: ${dir}`);
    process.exit(2);
  }

  const config = { ...loadConfig(), ...overrides };

  const files = await scan(dir, config.recursive);

  render(<App files={files} config={config} />, {
    title: "media-viewer",
    width: config.windowWidth,
    height: config.windowHeight,
    focus: process.env.GPUIX_BACKGROUND !== "1",
    onKeyDown: (e) => dispatchKey(e.key ?? "", e.modifiers ?? {}),
  });
}

main();
