import { useMemo, useRef } from "react";
import { buildRowLayout, type RowLayout } from "../geometry.ts";
import type { GridGeom } from "../types.ts";

export function useRowLayoutRef(geom: GridGeom): {
  layout: RowLayout;
  layoutRef: { current: RowLayout };
} {
  const layout = useMemo(() => buildRowLayout(geom), [geom]);
  const layoutRef = useRef<RowLayout>(layout);
  layoutRef.current = layout;
  return { layout, layoutRef };
}
