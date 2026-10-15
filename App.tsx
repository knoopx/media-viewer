import { statSync } from "node:fs";
import { useEffect, useRef, useState } from "react";
import { useWindowSize } from "@gpuix/react";
import type { Config } from "./config.ts";
import { Fullscreen } from "./components/Fullscreen.tsx";
import { Grid, type GridHandle } from "./components/Grid.tsx";
import {
  contentWidth,
  justifiedRows,
  moveHorizontal,
  moveRow,
  pageMove,
  rowsInViewport,
  scrollTarget,
  type Viewport,
} from "./lib/geometry.ts";
import { findCommand, runCommand } from "./lib/commands.ts";
import { setKeyHandler } from "./lib/keybus.ts";
import {
  commandShortcuts,
  FULLSCREEN,
  GRID,
  matchShortcut,
  withOverrides,
  type KeyMods,
} from "./lib/shortcuts.ts";
import { probeDimensions } from "./lib/scan.ts";
import type { Command, MediaFile } from "./lib/types.ts";
import { paletteForTheme } from "./theme.ts";

type Mode = "grid" | { fullscreen: number };

interface AppProps {
  files: MediaFile[];
  config: Config;
}

export function App({ files, config }: AppProps) {
  const [mode, setMode] = useState<Mode>("grid");

  const [media, setMedia] = useState<MediaFile[]>(files);

  const [selected, setSelected] = useState<number | null>(
    media.length > 0 ? 0 : null,
  );
  const [selectedSet, setSelectedSet] = useState<Set<number>>(new Set());
  const gridRef = useRef<GridHandle>(null);
  const p = paletteForTheme(config.theme);
  const { width: winW } = useWindowSize();

  const geom = justifiedRows(
    media,
    config.thumbnailSize,
    contentWidth(winW, 0),
  );

  const viewport = (): Viewport => {
    const v = gridRef.current?.getViewport() ?? { top: 0, height: 0 };
    return { top: v.top, bottom: v.top + v.height, height: v.height };
  };

  useEffect(() => {
    setSelected((s) => (s === null || s < 0 || s >= media.length ? null : s));
  }, [media]);

  const toggleCheck = (g: number) => {
    setSelectedSet((s) => {
      const n = new Set(s);
      if (n.has(g)) n.delete(g);
      else n.add(g);
      return n;
    });
  };

  /** Run a user-defined config command on the file at index i. */
  const applyCommand = (cmd: Command, i: number): void => {
    const f = media[i];
    if (!runCommand(cmd, f.path)) return;
    try {
      statSync(f.path);
    } catch {
      removeFileAt(i);
      return;
    }
    const dims = probeDimensions(f.path);
    if (!dims) return;
    setMedia(
      media.map((m, j) =>
        j === i ? { ...m, width: dims[0], height: dims[1] } : m,
      ),
    );
  };

  const removeFileAt = (i: number): void => {
    const newFiles = media.filter((_, j) => j !== i);
    setMedia(newFiles);
    setSelectedSet((s) => {
      const n = new Set<number>();
      for (const j of s) n.add(j < i ? j : j - 1);
      return n;
    });
    setSelected(
      newFiles.length === 0 ? null : Math.min(i, newFiles.length - 1),
    );
  };

  /** Print the checked file paths (one per line) to stdout, then exit. */
  const exitApp = (): void => {
    const paths = [...selectedSet]
      .sort((a, b) => a - b)
      .map((i) => media[i].path);
    if (paths.length === 0) {
      process.exit(0);
      return;
    }
    // Write-then-exit in the flush callback: process.exit can truncate
    // buffered pipe stdout.
    process.stdout.write(paths.join("\n") + "\n", () => process.exit(0));
  };

  const navigateRow = (down: boolean) => {
    if (selected !== null) {
      setSelected(moveRow(geom, selected, down));
    } else {
      const t = scrollTarget(geom, viewport(), down ? "down" : "up");
      if (t) gridRef.current?.scrollTo(t.y);
    }
  };

  const pageKey = (down: boolean) => {
    if (selected !== null) {
      const pages = rowsInViewport(geom, viewport());
      setSelected(pageMove(geom, selected, pages, down));
    } else {
      gridRef.current?.scrollBy(viewport().height * (down ? 1 : -1));
    }
  };

  const dispatchGridCommand = (id: string): void => {
    switch (id) {
      case "exit":
        exitApp();
        break;
      case "open":
        if (selected !== null) setMode({ fullscreen: selected });
        break;
      case "check":
        if (selected !== null) toggleCheck(selected);
        break;
      case "left":
        if (selected !== null)
          setSelected(moveHorizontal(geom, selected, false));
        break;
      case "right":
        if (selected !== null)
          setSelected(moveHorizontal(geom, selected, true));
        break;
      case "up":
        navigateRow(false);
        break;
      case "down":
        navigateRow(true);
        break;
      case "page-up":
        pageKey(false);
        break;
      case "page-down":
        pageKey(true);
        break;
      case "home":
        if (selected !== null) setSelected(0);
        else gridRef.current?.scrollTo(0);
        break;
      case "end":
        if (selected !== null) setSelected(media.length - 1);
        else gridRef.current?.scrollTo(Infinity);
        break;
    }
    const cmd = findCommand(config.commands, id);
    if (cmd && selected !== null) applyCommand(cmd, selected);
  };

  const dispatchFullscreenCommand = (i: number, id: string): void => {
    switch (id) {
      case "exit":
        exitApp();
        break;
      case "back":
        setSelected(i);
        setMode("grid");
        break;
      case "prev":
        if (i > 0) setMode({ fullscreen: i - 1 });
        break;
      case "next":
        if (i < media.length - 1) setMode({ fullscreen: i + 1 });
        break;
    }
    const cmd = findCommand(config.commands, id);
    if (cmd) applyCommand(cmd, i);
  };

  useEffect(() => {
    const cmds = commandShortcuts(config.commands);
    const gridSet = [
      ...withOverrides(GRID, config.shortcuts, "grid"),
      ...cmds,
    ];
    const fullSet = [
      ...withOverrides(FULLSCREEN, config.shortcuts, "fullscreen"),
      ...cmds,
    ];
    const handle = (key: string, mods: KeyMods) => {
      if (typeof mode === "object") {
        const s = matchShortcut(fullSet, key, mods);
        if (s) dispatchFullscreenCommand(mode.fullscreen, s.id);
        return;
      }
      const s = matchShortcut(gridSet, key, mods);
      if (s) dispatchGridCommand(s.id);
    };
    setKeyHandler(handle);
    return () => setKeyHandler(null);
  });

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        backgroundColor: p.bg,
        userSelect: "none",
        position: "relative",
      }}
    >
      <div
        style={{
          display: mode === "grid" ? "flex" : "none",
          flexDirection: "column",
          flexGrow: 1,
          minHeight: 0,
        }}
      >
        <Grid
          ref={gridRef}
          files={media}
          target={config.thumbnailSize}
          selected={selected}
          selectedSet={selectedSet}
          p={p}
          onSelect={setSelected}
        />
      </div>
      {mode !== "grid" && (
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            backgroundColor: p.bg,
          }}
        >
          <Fullscreen file={media[mode.fullscreen]} p={p} />
        </div>
      )}
    </div>
  );
}
