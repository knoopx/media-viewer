import type { MediaFile } from "../lib/types.ts";
import type { Palette } from "../theme.ts";

interface FullscreenProps {
  file: MediaFile;
  p: Palette;
}

export function Fullscreen({ file, p }: FullscreenProps) {
  return (
    <div
      style={{
        flexGrow: 1,
        minHeight: 0,
        backgroundColor: p.bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <img
        src={file.path}
        objectFit="contain"
        style={{ width: "100%", height: "100%" }}
      />
    </div>
  );
}
