import type { Metadata } from "next";
import LogClient from "./LogClient";

export const metadata: Metadata = { title: "immersion · log", robots: { index: false, follow: false } };

export default function ImmersionLogPage() {
  return (
    <div className="max-w-3xl w-full mx-auto px-4 sm:px-6">
      <div className="w-full paper-surface">
        <div className="min-h-screen py-8">
          <LogClient />
        </div>
      </div>
    </div>
  );
}
