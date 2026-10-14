import localFont from "next/font/local";

// Self-hosted so builds don't depend on fetching from Google Fonts.
// Radio Canada latin subset, variable weight.
export const radio = localFont({
  src: "./radio-canada-latin.woff2",
  weight: "300 700",
  display: "swap",
});
