"use client";

import type { PlaySpeed } from "./TravelsClient";

interface Props {
  snapshots: string[]; // newest first (matches listSnapshots order)
  frameIndex: number; // index into snapshots; 0 = newest, snapshots.length-1 = oldest
  playing: boolean;
  loading: boolean;
  speed: PlaySpeed;
  onSpeed: (s: PlaySpeed) => void;
  onFrame: (i: number) => void;
  onTogglePlay: () => void;
}

const SPEED_OPTIONS: { value: PlaySpeed; label: string }[] = [
  { value: "slow", label: "½×" },
  { value: "normal", label: "1×" },
  { value: "fast", label: "2×" },
];

export default function TimelapseControl({
  snapshots,
  frameIndex,
  playing,
  loading,
  speed,
  onSpeed,
  onFrame,
  onTogglePlay,
}: Props) {
  if (snapshots.length === 0) return null;

  // Render the scrubber from oldest -> newest left-to-right (more intuitive
  // for a timeline). snapshots[] arrives newest-first, so flip the index for
  // display only.
  const displayIndex = snapshots.length - 1 - frameIndex;
  const currentDate = snapshots[frameIndex] ?? "";

  return (
    <div className="flex flex-row items-center gap-2 text-xs ink-muted">
      <button
        type="button"
        onClick={onTogglePlay}
        disabled={snapshots.length < 2}
        className="text-[var(--accent)] font-mono w-6 h-6 flex items-center justify-center bg-[rgba(246,241,230,0.95)] border border-[rgba(18,18,18,0.4)] hover:bg-[var(--accent)] hover:text-[var(--paper)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        title={playing ? "pause timelapse" : "play timelapse"}
        aria-label={playing ? "pause" : "play"}
      >
        {playing ? "❚❚" : "▶"}
      </button>
      <input
        type="range"
        min={0}
        max={snapshots.length - 1}
        step={1}
        value={displayIndex}
        onChange={(e) => onFrame(snapshots.length - 1 - Number(e.target.value))}
        className="w-32 accent-[var(--accent)] cursor-pointer"
        aria-label="timeline scrubber"
      />
      <span className="font-mono w-[5.5rem] text-right ink-body">
        {currentDate}
        {loading && <span className="ml-1 ink-muted">…</span>}
      </span>
      <div className="flex flex-row border border-[rgba(18,18,18,0.4)]" role="radiogroup" aria-label="playback speed">
        {SPEED_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={speed === opt.value}
            onClick={() => onSpeed(opt.value)}
            className={`font-mono w-7 h-6 flex items-center justify-center text-[10px] transition-colors ${
              speed === opt.value
                ? "bg-[var(--accent)] text-[var(--paper)]"
                : "bg-[rgba(246,241,230,0.95)] hover:bg-[rgba(179,0,0,0.15)] ink-body"
            }`}
            title={`${opt.label} speed`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
