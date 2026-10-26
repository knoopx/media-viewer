import { useCallback, useRef } from "react";
import type { GridGeom } from "../types.ts";
import {
  moveSelection,
  rowsInViewport,
  scrollYFor,
  MOVE_COMMANDS,
  type MoveCommand,
  type Viewport,
} from "../geometry.ts";

export interface GridNavigationOptions {
  geom: GridGeom;
  count: number;
  selected: number | null;
  setSelected(index: number): void;
  scrollTo(y: number): void;
  scrollBy(dy: number): void;
  viewport(): Viewport;
}

type Scroller = Pick<
  GridNavigationOptions,
  "geom" | "scrollTo" | "scrollBy" | "viewport"
>;

const SCROLL_WHEN_NO_SELECTION: Record<
  MoveCommand,
  ((o: Scroller) => void) | undefined
> = {
  left: undefined,
  right: undefined,
  up: (o) => o.scrollTo(scrollYFor(o.geom, o.viewport(), "up")),
  down: (o) => o.scrollTo(scrollYFor(o.geom, o.viewport(), "down")),
  "page-up": (o) => o.scrollBy(-o.viewport().height),
  "page-down": (o) => o.scrollBy(o.viewport().height),
  home: (o) => o.scrollTo(0),
  end: (o) => o.scrollTo(Infinity),
};

function isMoveCommand(id: string): id is MoveCommand {
  return (MOVE_COMMANDS as readonly string[]).includes(id);
}

export function useGridNavigation(
  options: GridNavigationOptions,
): (id: string) => boolean {
  const optsRef = useRef(options);
  optsRef.current = options;

  return useCallback((id: string): boolean => {
    const o = optsRef.current;
    if (!isMoveCommand(id)) return false;

    const sel = o.selected;
    if (sel !== null) {
      o.setSelected(
        moveSelection(o.geom, o.count, sel, id, () =>
          rowsInViewport(o.geom, o.viewport()),
        ),
      );
      return true;
    }

    SCROLL_WHEN_NO_SELECTION[id]?.(o);
    return true;
  }, []);
}
