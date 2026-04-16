import { list } from "@vercel/blob";
import { Radio_Canada } from "next/font/google";
import type { FeatureCollection } from "geojson";
import TravelsNav from "./TravelsNav";
import TravelsMap from "./TravelsMap";
import StatsBar from "./StatsBar";

const radio = Radio_Canada({ subsets: ["latin"], weight: ["400", "600"] });

export const revalidate = 300;

interface RegionEntry {
  name: string;
  blocks: number;
  bbox: [number, number, number, number];
}
interface CityEntry {
  name: string;
  lng: number;
  lat: number;
  rank: number;
}
interface TravelsMeta {
  generatedAt: string;
  tileCount: number;
  blockCount: number;
  visitedPixelCount: number;
  bbox: [number, number, number, number] | null;
  countries?: RegionEntry[];
  states?: RegionEntry[];
  cities?: CityEntry[];
}

type TravelsPayload = FeatureCollection & { metadata: TravelsMeta };

async function loadTravels(): Promise<TravelsPayload | null> {
  try {
    const { blobs } = await list({ prefix: "travels/" });
    const latest = blobs.find((b) => b.pathname === "travels/latest.json");
    if (!latest) return null;
    const res = await fetch(latest.url, { next: { revalidate: 300 } });
    if (!res.ok) return null;
    return (await res.json()) as TravelsPayload;
  } catch {
    if (process.env.NODE_ENV !== "production") {
      try {
        const fs = await import("node:fs/promises");
        const path = await import("node:path");
        const demoPath = path.resolve(process.cwd(), "public/travels-demo.json");
        const raw = await fs.readFile(demoPath, "utf8");
        return JSON.parse(raw) as TravelsPayload;
      } catch {
        return null;
      }
    }
    return null;
  }
}

function formatSyncedAt(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const hours = Math.round(diff / 3_600_000);
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

export default async function TravelsPage() {
  const data = await loadTravels();
  const mapKey = process.env.NEXT_PUBLIC_MAPTILER_KEY ?? "";
  const stadiaKey = process.env.NEXT_PUBLIC_STADIA_API_KEY ?? "";
  const exploredCount = data
    ? data.features.filter((f) => (f.properties as { kind?: string })?.kind === "explored").length
    : 0;
  const countries = data?.metadata.countries ?? [];
  const states = data?.metadata.states ?? [];

  return (
    <div className={`${radio.className} fixed inset-0 flex flex-col bg-[var(--paper)]`}>
      <header className="flex flex-row items-center justify-between px-6 py-3 border-b border-[rgba(18,18,18,0.15)] bg-[rgba(246,241,230,0.92)] backdrop-blur-sm z-20">
        <div className="flex flex-row items-baseline gap-4">
          <a href="/" className="custom-text-18 ink-title font-semibold hover:opacity-70">
            Anthony Bolivar
          </a>
          <span className="ink-muted text-sm">/ travels</span>
        </div>
        <TravelsNav />
      </header>

      {data ? (
        <StatsBar
          countries={countries}
          states={states}
          exploredCount={exploredCount}
          visitedPixelCount={data.metadata.visitedPixelCount}
          syncedLabel={`synced ${formatSyncedAt(data.metadata.generatedAt)}`}
        />
      ) : null}

      <main className="flex-1 relative">
        {data ? (
          <TravelsMap
            geojson={{ type: "FeatureCollection", features: data.features }}
            bbox={data.metadata.bbox}
            mapKey={mapKey}
            stadiaKey={stadiaKey}
            cities={data.metadata.cities ?? []}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center px-6 text-center">
            <p className="ink-muted max-w-md">
              Travel data not available yet. The first sync runs every 6 hours via a cron job.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
