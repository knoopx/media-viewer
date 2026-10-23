import type { MediaFile } from "../lib/types.ts";
import type { Palette } from "../theme.ts";

export function CheckBadge({ p, size = 28 }: { p: Palette; size?: number }) {
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
  p: Palette;
  onClick: () => void;
}

export function Tile({ file, width, height, checked, p, onClick }: TileProps) {
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
          borderRadius: 6,
          cursor: "pointer",
        }}
      >
        <img
          src={file.path}
          objectFit="contain"
          style={{ width: "100%", height: "100%", borderRadius: 6 }}
        />

        {checked && (
          <div
            style={{
              position: "absolute",
              right: 6,
              bottom: 6,
            }}
          >
            <CheckBadge p={p} />
          </div>
        )}
      </div>
    </div>
  );
}
