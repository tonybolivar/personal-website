import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "travels",
  description: "A world map of where Anthony has been, synced from Fog of World.",
};

export default function TravelsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
