"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Feature, FeatureCollection } from "geojson";
import TravelsMap from "./TravelsMap";
import StatsBar from "./StatsBar";
import TimelapseControl from "./TimelapseControl";
import type { PhotoLite } from "./PhotoModal";

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

interface Props {
  initial: TravelsPayload;
  snapshots: string[]; // newest first
  initialFrame: number;
  mapKey: string;
  stadiaKey: string;
  photos: PhotoLite[];
}

export type PlaySpeed = "slow" | "normal" | "fast";
const FRAME_INTERVAL_MS: Record<PlaySpeed, number> = {
  slow: 2400,
  normal: 1200,
  fast: 600,
};

function formatSyncedAt(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const hours = Math.round(diff / 3_600_000);
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

export default function TravelsClient({
  initial,
  snapshots,
  initialFrame,
  mapKey,
  stadiaKey,
  photos,
}: Props) {
  const [data, setData] = useState<TravelsPayload>(initial);
  const [frameIndex, setFrameIndex] = useState<number>(initialFrame);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [playSpeed, setPlaySpeed] = useState<PlaySpeed>("normal");
  // Cache per-date payloads so a replay or scrub doesn't refetch.
  const cacheRef = useRef<Map<string, TravelsPayload>>(new Map());

  // Seed the cache with whichever snapshot the server rendered with.
  useEffect(() => {
    const date = initial.metadata.generatedAt.slice(0, 10);
    cacheRef.current.set(date, initial);
  }, [initial]);

  // Fetch the snapshot for the current frame when it changes.
  useEffect(() => {
    const date = snapshots[frameIndex];
    if (!date) return;
    if (data.metadata.generatedAt.slice(0, 10) === date) return;
    const cached = cacheRef.current.get(date);
    if (cached) {
      setData(cached);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetch(`/api/travels/snapshot/${date}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`status ${r.status}`))))
      .then((j: TravelsPayload) => {
        if (cancelled) return;
        cacheRef.current.set(date, j);
        setData(j);
      })
      .catch((err) => console.warn("[timelapse] snapshot fetch failed:", err))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [frameIndex, snapshots, data.metadata.generatedAt]);

  // Play loop: step forward in time (frameIndex DECREASES because the
  // snapshots array is newest-first). Stops automatically at the newest frame.
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      setFrameIndex((f) => {
        if (f <= 0) {
          setPlaying(false);
          return 0;
        }
        return f - 1;
      });
    }, FRAME_INTERVAL_MS[playSpeed]);
    return () => clearInterval(id);
  }, [playing, playSpeed]);

  const togglePlay = () => {
    // If we're already at the newest snapshot, restart from the oldest.
    if (!playing && frameIndex === 0 && snapshots.length > 1) {
      setFrameIndex(snapshots.length - 1);
    }
    setPlaying((p) => !p);
  };

  const exploredCount = data.features.filter(
    (f) => (f.properties as { kind?: string })?.kind === "explored",
  ).length;
  const countries = data.metadata.countries ?? [];
  const states = data.metadata.states ?? [];

  // Names of regions added in this snapshot's diff. Drives the "+ N new"
  // badge in StatsBar; same date-match logic the map uses for highlighting.
  const generatedDate = data.metadata.generatedAt.slice(0, 10);
  const { newCountries, newStates } = useMemo(() => {
    const collect = (xs?: VisitedAdminFeature[]) =>
      (xs ?? [])
        .filter((f) => f.properties?.addedOn === generatedDate)
        .map((f) => f.properties.name);
    return {
      newCountries: collect(data.metadata.visitedCountries),
      newStates: collect(data.metadata.visitedStates),
    };
  }, [data, generatedDate]);

  return (
    <>
      <div className="flex flex-row items-center gap-x-4 px-6 py-1 text-xs ink-muted border-b border-[rgba(18,18,18,0.1)] bg-[rgba(246,241,230,0.82)] backdrop-blur-sm z-10">
        <TimelapseControl
          snapshots={snapshots}
          frameIndex={frameIndex}
          playing={playing}
          loading={loading}
          speed={playSpeed}
          onSpeed={setPlaySpeed}
          onFrame={(i) => {
            setPlaying(false);
            setFrameIndex(i);
          }}
          onTogglePlay={togglePlay}
        />
      </div>
      <StatsBar
        countries={countries}
        states={states}
        exploredCount={exploredCount}
        visitedPixelCount={data.metadata.visitedPixelCount}
        syncedLabel={`synced ${formatSyncedAt(data.metadata.generatedAt)}`}
        newCountries={newCountries}
        newStates={newStates}
      />
      <main className="flex-1 relative">
        <TravelsMap
          geojson={{ type: "FeatureCollection", features: data.features }}
          bbox={data.metadata.bbox}
          mapKey={mapKey}
          stadiaKey={stadiaKey}
          cities={data.metadata.cities ?? []}
          states={data.metadata.states ?? []}
          visitedStates={(data.metadata.visitedStates ?? []) as unknown as Feature[]}
          visitedCountries={(data.metadata.visitedCountries ?? []) as unknown as Feature[]}
          photos={photos}
          generatedAt={data.metadata.generatedAt}
        />
      </main>
    </>
  );
}
