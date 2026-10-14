import type { Metadata } from "next";
import { Radio_Canada } from "next/font/google";
import LogClient from "./LogClient";

const radio = Radio_Canada({ subsets: ["latin"], weight: ["400", "600"] });

export const metadata: Metadata = { title: "immersion · log", robots: { index: false, follow: false } };

export default function ImmersionLogPage() {
  return (
    <div className={`${radio.className} max-w-3xl w-full mx-auto px-4 sm:px-6`}>
      <div className="w-full paper-surface">
        <div className="min-h-screen py-8">
          <LogClient />
        </div>
      </div>
    </div>
  );
}
