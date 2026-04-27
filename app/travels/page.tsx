import { get, list } from "@vercel/blob";
import { Radio_Canada } from "next/font/google";
import type { FeatureCollection } from "geojson";
import TravelsNav from "./TravelsNav";
import TravelsClient from "./TravelsClient";
import { readPhotoIndex, type Photo } from "@/lib/travels/photos";

const radio = Radio_Canada({ subsets: ["latin"], weight: ["400", "600"] });

export const dynamic = "force-dynamic";

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
interface VisitedAdminFeature {
  type: "Feature";
  properties: { name: string; blocks: number; country?: string; addedOn?: string };
  geometry: unknown;
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
  visitedStates?: VisitedAdminFeature[];
  visitedCountries?: VisitedAdminFeature[];
}

type TravelsPayload = FeatureCollection & { metadata: TravelsMeta };

async function loadTravels(snapshot: string | null = null): Promise<TravelsPayload | null> {
  const key = snapshot ? `travels/history/${snapshot}.json` : "travels/latest.json";
  try {
    const result = await get(key, { access: "private" });
    if (!result || result.statusCode !== 200) return null;
    const text = await new Response(result.stream).text();
    return JSON.parse(text) as TravelsPayload;
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

async function listSnapshots(): Promise<string[]> {
  try {
    const { blobs } = await list({ prefix: "travels/history/" });
    const dates: string[] = [];
    for (const b of blobs) {
      const m = b.pathname.match(/travels\/history\/(\d{4}-\d{2}-\d{2})\.json$/);
      if (m) dates.push(m[1]);
    }
    dates.sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
    return dates;
  } catch {
    return [];
  }
}

export default async function TravelsPage({
  searchParams,
}: {
  searchParams?: { snapshot?: string };
}) {
  const requestedSnapshot = searchParams?.snapshot ?? null;
  const snapshot = requestedSnapshot && /^\d{4}-\d{2}-\d{2}$/.test(requestedSnapshot) ? requestedSnapshot : null;
  const [data, snapshotsList, photos] = await Promise.all([
    loadTravels(snapshot),
    listSnapshots(),
    readPhotoIndex().catch((): Photo[] => []),
  ]);
  const mapKey = process.env.NEXT_PUBLIC_MAPTILER_KEY ?? "";
  const stadiaKey = process.env.NEXT_PUBLIC_STADIA_API_KEY ?? "";
  // snapshotsList is newest-first; index 0 is the latest. If the URL pinned
  // a specific date, start the scrubber there; otherwise start at latest.
  const initialFrame = snapshot
    ? Math.max(0, snapshotsList.indexOf(snapshot))
    : 0;

  return (
    <div className={`${radio.className} fixed inset-0 flex flex-col bg-[var(--paper)]`}>
      <header className="flex flex-row items-center justify-between px-6 py-3 border-b border-[rgba(18,18,18,0.15)] bg-[rgba(246,241,230,0.92)] backdrop-blur-sm z-20">
        <div className="flex flex-row items-baseline gap-4">
          <a href="/" className="custom-text-18 ink-title font-semibold hover:opacity-70">
            Anthony Bolivar
          </a>
          <span className="ink-muted text-sm">/ travels</span>
        </div>
        <div className="flex flex-row items-center gap-4">
          <TravelsNav />
        </div>
      </header>

      {data ? (
        <TravelsClient
          initial={data}
          snapshots={snapshotsList}
          initialFrame={initialFrame}
          mapKey={mapKey}
          stadiaKey={stadiaKey}
          photos={photos}
        />
      ) : (
        <main className="flex-1 relative">
          <div className="absolute inset-0 flex items-center justify-center px-6 text-center">
            <p className="ink-muted max-w-md">
              Travel data not available yet. The first sync runs every 6 hours via a cron job.
            </p>
          </div>
        </main>
      )}
    </div>
  );
}
