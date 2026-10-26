import type { MediaFile } from "../lib/types.ts";
import type { Palette } from "../theme.ts";

const RADIUS = 6;
const BADGE_SIZE = 28;
const BADGE_INSET = 6;
const OUTLINE_WIDTH = 5;

function outlineFor(p: Palette) {
  return {
    offsetX: 0,
    offsetY: 0,
    blurRadius: 0,
    spreadRadius: OUTLINE_WIDTH,
    color: p.primary,
  };
}

function CheckBadge({ p, size = BADGE_SIZE }: { p: Palette; size?: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: p.primary,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <text style={{ fontSize: 18, color: p.check }}>✓</text>
    </div>
  );
}

interface TileProps {
  file: MediaFile;
  width: number;
  height: number;
  checked: boolean;
  selected: boolean;
  p: Palette;
  onClick: () => void;
}

export function Tile({
  file,
  width,
  height,
  checked,
  selected,
  p,
  onClick,
}: TileProps) {
  return (
    <div
      style={{
        width,
        height,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onClick={onClick}
    >
      <div
        style={{
          position: "relative",
          width,
          height,
          backgroundColor: p.cellBg,
          borderRadius: RADIUS,
          cursor: "pointer",
          boxShadow: selected ? outlineFor(p) : undefined,
        }}
      >
        <img
          src={file.path}
          objectFit="contain"
          style={{ width: "100%", height: "100%", borderRadius: RADIUS }}
        />

        {checked && (
          <div
            style={{
              position: "absolute",
              right: BADGE_INSET,
              bottom: BADGE_INSET,
            }}
          >
            <CheckBadge p={p} />
          </div>
        )}
      </div>
    </div>
  );
}
