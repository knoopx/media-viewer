export interface Palette {
  bg: string;

  cellBg: string;

  dayCount: string;

  outline: string;

  check: string;

  primary: string;
}

export function paletteForTheme(theme: "dark" | "light"): Palette {
  return theme === "dark"
    ? {
        bg: "#0F0F0F",
        cellBg: "#1C1C1C",
        dayCount: "#8E8E8E",
        outline: "#FFFFFF",
        check: "#FFFFFF",
        primary: "#4C9FFF",
      }
    : {
        bg: "#FFFFFF",
        cellBg: "#E5E5E5",
        dayCount: "#6E6E6E",
        outline: "#000000",
        check: "#FFFFFF",
        primary: "#1D66E0",
      };
}
