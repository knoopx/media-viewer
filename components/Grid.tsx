import { useImperativeHandle, useRef, forwardRef } from "react";
import { useGpuixRequired, type PublicInstance } from "@gpuix/react";
import { type Row } from "../lib/geometry.ts";
import { useRowLayoutRef } from "../lib/hooks/useRowLayout.ts";
import { useGridScroll } from "../lib/hooks/useGridScroll.ts";
import { useAutoScrollIntoView } from "../lib/hooks/useAutoScrollIntoView.ts";
import type { GridGeom, MediaFile, ScrollWindow } from "../lib/types.ts";
import type { Palette } from "../theme.ts";
import { Tile } from "./Tile.tsx";

interface GridProps {
  files: MediaFile[];
  geom: GridGeom;
  target: number;
  selected: number | null;
  selectedSet: Set<number>;
  p: Palette;
  onSelect: (global: number) => void;
}

export interface GridHandle {
  scrollTo(y: number): void;

  scrollBy(dy: number): void;

  getViewport(): ScrollWindow;
}

export const Grid = forwardRef(function Grid(
  props: GridProps,
  ref: React.Ref<GridHandle>,
) {
  const { files, geom, target, selected, selectedSet, p, onSelect } = props;
  const renderer = useGpuixRequired();
  const listRef = useRef<PublicInstance | null>(null);

  const { layout, layoutRef } = useRowLayoutRef(geom);

  const { viewport, scrollTo, scrollBy } = useGridScroll({
    renderer,
    get listId() {
      return listRef.current ? listRef.current.id : null;
    },
    layoutRef,
  });

  useImperativeHandle(
    ref,
    () => ({
      scrollTo,
      scrollBy,
      getViewport: viewport,
    }),
    [renderer],
  );

  useAutoScrollIntoView({
    selected,
    layoutRef,
    scroll: { scrollTo, viewport },
  });

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
        estimatedItemHeight={target + geom.gap + geom.edge}
        style={{ flexGrow: 1, minHeight: 0, backgroundColor: p.bg }}
      >
        {layout.rows.map((row: Row) => {
          return (
            <div
              key={row.key}
              style={{
                height: row.box,
                paddingLeft: geom.edge + row.off,
                paddingRight: geom.edge + row.off,
              }}
            >
              <div
                style={{
                  display: "flex",
                  gap: geom.gap,
                  height: row.height,
                  marginTop: row.lead,
                }}
              >
                {row.tiles.map((t) => (
                  <Tile
                    key={t.global}
                    file={files[t.global]}
                    width={t.w}
                    height={row.height}
                    checked={selectedSet.has(t.global)}
                    selected={t.global === selected}
                    p={p}
                    onClick={() => onSelect(t.global)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </virtual-list>
    </div>
  );
});
