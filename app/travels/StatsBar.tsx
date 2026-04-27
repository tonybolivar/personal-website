"use client";

// Each Fog of World pixel is ~9.4 m on a side at the equator (block is
// 600 m / 64 px). 88 m² is a fine constant-latitude approximation.
const PIXEL_AREA_M2 = 88;

function formatKm2(m2: number): string {
  const km2 = m2 / 1_000_000;
  if (km2 >= 100) return `${Math.round(km2).toLocaleString()} km²`;
  return `${km2.toFixed(1)} km²`;
}

interface RegionEntry {
  name: string;
  blocks: number;
  bbox: [number, number, number, number];
}

interface Props {
  countries: RegionEntry[];
  states: RegionEntry[];
  exploredCount: number;
  visitedPixelCount: number;
  syncedLabel: string;
  newCountries?: string[];
  newStates?: string[];
}

function flyTo(bbox: [number, number, number, number]) {
  window.dispatchEvent(new CustomEvent("travels:fly-to", { detail: { bbox } }));
}

function Chip({ entry }: { entry: RegionEntry }) {
  return (
    <button
      onClick={() => flyTo(entry.bbox)}
      className="inline-flex items-center gap-1 px-2 py-[1px] border border-[rgba(179,0,0,0.35)] text-[var(--accent)] hover:bg-[var(--accent)] hover:text-[var(--paper)] transition-colors duration-150 text-[11px] leading-4"
      title={`fly to ${entry.name} (${entry.blocks.toLocaleString()} blocks)`}
      type="button"
    >
      <span>{entry.name}</span>
      <span className="ink-muted group-hover:text-inherit">· {entry.blocks.toLocaleString()}</span>
    </button>
  );
}

export default function StatsBar({ countries, states, exploredCount, visitedPixelCount, syncedLabel, newCountries, newStates }: Props) {
  const newBits: string[] = [];
  if (newCountries && newCountries.length) {
    newBits.push(`+ ${newCountries.length} ${newCountries.length === 1 ? "country" : "countries"}`);
  }
  if (newStates && newStates.length) {
    newBits.push(`+ ${newStates.length} ${newStates.length === 1 ? "state" : "states"}`);
  }
  const newTooltip = [
    newCountries?.length ? `Countries: ${newCountries.join(", ")}` : "",
    newStates?.length ? `States: ${newStates.join(", ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <div className="flex flex-row items-center gap-x-4 gap-y-1 px-6 py-2 text-xs ink-muted border-b border-[rgba(18,18,18,0.1)] bg-[rgba(246,241,230,0.82)] backdrop-blur-sm z-10 flex-wrap">
      <span>
        <span className="ink-body font-semibold text-[var(--accent)]">{countries.length}</span>{" "}
        {countries.length === 1 ? "country" : "countries"}
      </span>
      {countries.length > 0 && (
        <span className="flex flex-wrap gap-1">
          {countries.map((c) => <Chip key={c.name} entry={c} />)}
        </span>
      )}
      {states.length > 0 && (
        <>
          <span className="ml-2">
            <span className="ink-body font-semibold text-[var(--accent)]">{states.length}</span>{" "}
            {states.length === 1 ? "state" : "states"}
          </span>
          <span className="flex flex-wrap gap-1">
            {states.map((s) => <Chip key={s.name} entry={s} />)}
          </span>
        </>
      )}
      <span className="ml-2">
        <span className="ink-body font-semibold">{exploredCount}</span> regions ·{" "}
        <span className="ink-body font-semibold">
          {formatKm2(visitedPixelCount * PIXEL_AREA_M2)}
        </span>{" "}
        defogged
      </span>
      {newBits.length > 0 && (
        <span
          className="px-2 py-[1px] border border-[rgba(255,56,56,0.6)] bg-[rgba(255,56,56,0.12)] text-[#ff3838] font-semibold cursor-help"
          title={newTooltip || undefined}
        >
          {newBits.join(" · ")} new
        </span>
      )}
      <span className="ml-auto">{syncedLabel}</span>
    </div>
  );
}
