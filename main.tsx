import { render } from "@gpuix/react";
import { statSync } from "node:fs";
import { dirname, extname } from "node:path";
import { App } from "./App.tsx";
import { defaultConfig, loadConfig, type Config } from "./config.ts";
import { dispatchKey } from "./lib/keybus.ts";
import { scan, SUPPORTED_IMAGE_EXTENSIONS } from "./lib/scan.ts";
import type { MediaFile } from "./lib/types.ts";

const USAGE = `usage: media-viewer [options] <directory|image>

options:
  --thumbnail-size <px>  target tile height (default: ${defaultConfig.thumbnailSize})
  --gap <px>             grid spacing (default: ${defaultConfig.gap})
  --window-width <px>    window width (default: ${defaultConfig.windowWidth})
  --window-height <px>   window height (default: ${defaultConfig.windowHeight})
  --no-recursive         do not scan subdirectories
  -h, --help             show this help

A directory opens the thumbnail grid; an image file opens directly
in fullscreen with the grid built from its parent directory
(escape returns to the grid).

Flags override config.json values; omitted flags fall back to the
config file, then built-in defaults.`;

function failUsage(message?: string): never {
  if (message) {
    console.error(message);
  }
  console.error(USAGE);
  process.exit(2);
}

function parseFlags(argv: string[]): {
  dir: string;
  overrides: Partial<Config>;
} {
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
  const config = { ...loadConfig(), ...overrides };

  let files: MediaFile[];
  let openPath: string | undefined;
  let st;
  try {
    st = statSync(dir);
  } catch {
    failUsage(`no such file: ${dir}`);
  }
  if (st.isFile()) {
    const ext = extname(dir).toLowerCase().replace(/^\./, "");
    if (!SUPPORTED_IMAGE_EXTENSIONS.includes(ext)) {
      failUsage(`unsupported image file: ${dir}`);
    }
    files = await scan(dirname(dir), config.recursive);
    openPath = dir;
  } else if (st.isDirectory()) {
    files = await scan(dir, config.recursive);
  } else {
    failUsage(`not a file or directory: ${dir}`);
  }

  render(<App files={files} config={config} openPath={openPath} />, {
    title: "media-viewer",
    width: config.windowWidth,
    height: config.windowHeight,
    focus: process.env.GPUIX_BACKGROUND !== "1",
    onKeyDown: (e) => dispatchKey(e.key ?? "", e.modifiers ?? {}),
  });
}

main();
