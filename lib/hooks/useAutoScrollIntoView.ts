import { useEffect, useRef } from "react";
import type { RowLayout } from "../geometry.ts";
import type { ScrollWindow } from "../types.ts";

export interface AutoScrollIntoViewOptions {
  selected: number | null;
  layoutRef: { current: RowLayout };
  scroll: {
    scrollTo(y: number): void;

    viewport(): ScrollWindow;
  };
}

export function useAutoScrollIntoView(opts: AutoScrollIntoViewOptions): void {
  const optsRef = useRef(opts);
  optsRef.current = opts;

  useEffect(() => {
    const o = optsRef.current;
    const selected = o.selected;
    if (selected === null) return;
    const { tops, heights, rowOf } = o.layoutRef.current;
    const rowIndex = rowOf.get(selected);
    if (rowIndex === undefined) return;

    const rowTop = tops[rowIndex];
    const rowBottom = rowTop + heights[rowIndex];
    const { top: T, height: H } = o.scroll.viewport();
    if (H === 0) return;
    if (rowTop >= T && rowBottom <= T + H) return;

    if (rowTop > T + H) {
      o.scroll.scrollTo(rowBottom - H);
    } else {
      o.scroll.scrollTo(rowTop);
    }
  }, [opts.selected]);
}
