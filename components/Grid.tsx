import {
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  forwardRef,
} from "react";
import {
  useGpuixRequired,
  useWindowSize,
  type PublicInstance,
} from "@gpuix/react";
import {
  contentWidth,
  GRID_GAP,
  GRID_MARGIN,
  flatRows,
  justifiedRows,
  type FlatRows,
} from "../lib/geometry.ts";
import type { GridGeom, MediaFile } from "../lib/types.ts";
import type { Palette } from "../theme.ts";
import { CheckBadge, Tile } from "./Tile.tsx";

interface GridProps {
  files: MediaFile[];
  target: number;
  selected: number | null;
  selectedSet: Set<number>;
  p: Palette;
  onSelect: (global: number) => void;
}

interface Row {
  key: string;
  tiles: { global: number; x: number; w: number }[];
  height: number;
  trail: number;
}

function buildRows(geom: GridGeom): {
  rows: Row[];
  tileToRow: Map<number, number>;
} {
  const rows: Row[] = [];
  const tileToRow = new Map<number, number>();
  geom.rows.forEach((r, ri) => {
    const isLastRow = ri === geom.rows.length - 1;
    const trail = isLastRow ? 0 : GRID_GAP;
    r.tiles.forEach((t) => tileToRow.set(t.global, ri));
    rows.push({ key: `t${ri}`, tiles: r.tiles, height: r.height, trail });
  });
  return { rows, tileToRow };
}

function computeRowTops(rows: Row[]): {
  tops: number[];
  heights: number[];
  contentHeights: number[];
  contentH: number;
} {
  let y = 0;
  const tops: number[] = [];
  const heights: number[] = [];
  const contentHeights: number[] = [];
  for (const r of rows) {
    tops.push(y);
    const ch = r.height;
    const h = ch + r.trail;
    contentHeights.push(ch);
    heights.push(h);
    y += h;
  }
  return { tops, heights, contentHeights, contentH: y };
}

function computeHighlight(
  flat: FlatRows,
  selected: number,
  scrollTop: number,
  viewportHeight: number,
): { left: number; top: number; w: number; h: number } | null {
  const ri = flat.rowOf.get(selected);
  const row = ri !== undefined ? flat.rows[ri] : undefined;
  const tile = row ? row.tiles.find((t) => t.global === selected) : undefined;
  if (row && tile) {
    const rowTopScreen = row.y - scrollTop;
    const near =
      rowTopScreen >= -row.height &&
      rowTopScreen <= viewportHeight + row.height;
    if (near) {
      return {
        left: tile.x - tile.w * 0.02,
        top: row.y - scrollTop - row.height * 0.02,
        w: tile.w * 1.04,
        h: row.height * 1.04,
      };
    }
  }
  return null;
}

export interface GridHandle {
  scrollTo(y: number): void;

  scrollBy(dy: number): void;

  getViewport(): { top: number; height: number };
}

export const Grid = forwardRef(function Grid(
  props: GridProps,
  ref: React.Ref<GridHandle>,
) {
  const { files, target, selected, selectedSet, p, onSelect } = props;
  const { width, height } = useWindowSize();
  const renderer = useGpuixRequired();
  const listRef = useRef<PublicInstance | null>(null);

  const [scrollNonce, setScrollNonce] = useState(0);

  const availW = contentWidth(width, 0);
  const geom = justifiedRows(files, target, availW);

  const flat = flatRows(geom);

  const { rows, tileToRow: tileToRowIndex } = buildRows(geom);

  const tileToRowRef = useRef<Map<number, number>>(tileToRowIndex);
  tileToRowRef.current = tileToRowIndex;

  const rowTopsRef = useRef<{
    tops: number[];
    heights: number[];
    contentHeights: number[];
    contentH: number;
  }>({
    tops: [],
    heights: [],
    contentHeights: [],
    contentH: 0,
  });
  rowTopsRef.current = computeRowTops(rows);

  const viewport = () => {
    const list = listRef.current;
    if (!list) return { top: 0, height: 0 };
    const a = renderer.getListScrollTop?.(list.id);
    if (!a) return { top: 0, height: 0 };
    const { tops, contentH } = rowTopsRef.current;
    const [item, off, vh] = a;
    if (item >= tops.length) return { top: contentH, height: vh };
    return { top: tops[item] + off, height: vh };
  };

  const scrollTo = (y: number) => {
    const list = listRef.current;
    if (!list) return;
    const { tops, heights, contentH } = rowTopsRef.current;
    if (tops.length === 0) return;
    const vh = viewport().height;
    const maxTop = Math.max(contentH - vh, 0);
    const ty = Math.min(Math.max(isFinite(y) ? y : maxTop, 0), maxTop);
    let idx = tops.length - 1;
    for (let i = 0; i < tops.length; i++) {
      if (ty < tops[i] + heights[i]) {
        idx = i;
        break;
      }
    }
    renderer.scrollToItem?.(list.id, idx, ty - tops[idx]);
  };

  useImperativeHandle(
    ref,
    () => ({
      scrollTo,
      scrollBy: (dy: number) => scrollTo(viewport().top + dy),
      getViewport: viewport,
    }),
    [renderer],
  );

  const { tops, contentH } = rowTopsRef.current;
  const list = listRef.current;
  let scrollTop = 0;
  let viewportHeight = height;
  {
    const a = list ? renderer.getListScrollTop?.(list.id) : null;
    if (a) {
      const [item, off, vh] = a;
      scrollTop = item < tops.length ? tops[item] + off : contentH;
      viewportHeight = vh != null && vh > 0 ? vh : height;
    }
  }

  useEffect(() => {
    if (selected === null || !listRef.current) return;
    const list = listRef.current;
    const rowIndex = tileToRowRef.current.get(selected);
    if (rowIndex === undefined) return;
    const { tops, contentHeights } = rowTopsRef.current;
    if (tops.length === 0) return;
    const rowTop = tops[rowIndex];
    const rowBottom = rowTop + contentHeights[rowIndex];
    const a = renderer.getListScrollTop?.(list.id);
    if (!a) return;
    const [item, off, vh] = a;
    const T = item < tops.length ? tops[item] + off : 0;
    const H = vh;
    if (rowTop >= T && rowBottom <= T + H) return;

    if (rowTop > T + H) {
      scrollTo(rowBottom - H);
    } else {
      scrollTo(rowTop);
    }
  }, [selected, renderer]);

  const highlight =
    selected !== null
      ? computeHighlight(flat, selected, scrollTop, viewportHeight)
      : null;

  void scrollNonce;

  return (
    <div
      style={{
        position: "relative",
        flexGrow: 1,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <virtual-list
        ref={listRef}
        estimatedItemHeight={target}
        onVisibleRange={() => setScrollNonce((n) => n + 1)}
        style={{ flexGrow: 1, minHeight: 0, backgroundColor: p.bg }}
      >
        {rows.map((row) => {
          const totalH = row.height + row.trail;
          return (
            <div
              key={row.key}
              style={{
                height: totalH,
                paddingLeft: GRID_MARGIN,
                paddingRight: GRID_MARGIN,
              }}
            >
              <div
                style={{
                  display: "flex",
                  gap: GRID_GAP,
                  height: row.height,
                }}
              >
                {row.tiles.map((t) => (
                  <Tile
                    key={t.global}
                    file={files[t.global]}
                    width={t.w}
                    height={row.height}
                    checked={selectedSet.has(t.global)}
                    p={p}
                    onClick={() => onSelect(t.global)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </virtual-list>

      {}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
        }}
      >
        {}
        {highlight && selected !== null && (
          <img
            src={files[selected].path}
            objectFit="contain"
            style={{
              position: "absolute",
              left: highlight.left,
              top: highlight.top,
              width: highlight.w,
              height: highlight.h,
              borderRadius: 6,

              boxShadow: {
                offsetX: 0,
                offsetY: 0,
                blurRadius: 0,
                spreadRadius: 5,
                color: p.primary,
              },
            }}
          />
        )}
        {/* Check badge above the focus glow so the tick stays visible on the focused tile. */}
        {highlight && selected !== null && selectedSet.has(selected) && (
          <div
            style={{
              position: "absolute",
              left: highlight.left + highlight.w - 34,
              top: highlight.top + highlight.h - 34,
            }}
          >
            <CheckBadge p={p} />
          </div>
        )}
      </div>
    </div>
  );
});
