import { useRef } from "react";
import type { NativeRenderer } from "@gpuix/react";
import type { RowLayout } from "../geometry.ts";
import type { ScrollWindow } from "../types.ts";

export interface GridScrollOptions {
  renderer: NativeRenderer;
  listId: number | null;
  layoutRef: { current: RowLayout };
  bump?(): void;
}

export interface GridScroll {
  viewport(): ScrollWindow;

  scrollTo(y: number): void;

  scrollBy(dy: number): void;
}

function decodeScroll(
  scroll: readonly number[] | null | undefined,
  tops: number[],
  contentH: number,
  fb: ScrollWindow,
): ScrollWindow {
  if (!scroll) return fb;
  const [item, off, vh] = scroll;
  const top = item < tops.length ? tops[item] + off : contentH;
  return { top, height: vh };
}

export function useGridScroll(opts: GridScrollOptions): GridScroll {
  const optsRef = useRef(opts);
  optsRef.current = opts;

  const viewport = () => {
    const o = optsRef.current;
    const listId = o.listId;
    if (listId === null) return { top: 0, height: 0 };
    const { tops, contentH } = o.layoutRef.current;
    return decodeScroll(o.renderer.getListScrollTop?.(listId), tops, contentH, {
      top: 0,
      height: 0,
    });
  };

  const scrollTo = (y: number) => {
    const o = optsRef.current;
    const listId = o.listId;
    if (listId === null) return;
    const { tops, contentH, rowIndexAt } = o.layoutRef.current;
    if (tops.length === 0) return;
    const vh = viewport().height;
    const maxTop = Math.max(contentH - vh, 0);
    const ty = Math.min(Math.max(isFinite(y) ? y : maxTop, 0), maxTop);
    const idx = rowIndexAt(ty);
    o.renderer.scrollToItem?.(listId, idx, ty - tops[idx]);
    o.bump?.();
  };

  const scrollBy = (dy: number) => scrollTo(viewport().top + dy);

  return { viewport, scrollTo, scrollBy };
}
