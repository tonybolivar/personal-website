"use client";

import { useEffect } from "react";

export interface PhotoLite {
  id: string;
  lng: number;
  lat: number;
  takenAt: string | null;
  caption: string | null;
  width: number;
  height: number;
}

export default function PhotoModal({
  photo,
  onClose,
  onPrev,
  onNext,
  position,
}: {
  photo: PhotoLite;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  position?: { index: number; total: number };
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft" && onPrev) onPrev();
      else if (e.key === "ArrowRight" && onNext) onNext();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, onPrev, onNext]);

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(18,18,18,0.75)] backdrop-blur-sm p-6"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative max-w-5xl w-full flex flex-col items-center"
      >
        <div className="relative w-full flex items-center justify-center">
          {onPrev && (
            <button
              type="button"
              onClick={onPrev}
              aria-label="previous"
              className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-2 sm:-translate-x-6 text-[var(--paper)] text-3xl w-10 h-10 flex items-center justify-center bg-[rgba(18,18,18,0.5)] hover:bg-[var(--accent)] rounded-full"
            >
              ‹
            </button>
          )}
          <img
            src={`/api/travels/photos/${photo.id}/image`}
            alt={photo.caption ?? ""}
            className="max-h-[80vh] w-auto object-contain border border-[rgba(18,18,18,0.4)] bg-[var(--paper)]"
            style={{ maxWidth: "100%" }}
          />
          {onNext && (
            <button
              type="button"
              onClick={onNext}
              aria-label="next"
              className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-2 sm:translate-x-6 text-[var(--paper)] text-3xl w-10 h-10 flex items-center justify-center bg-[rgba(18,18,18,0.5)] hover:bg-[var(--accent)] rounded-full"
            >
              ›
            </button>
          )}
        </div>
        <div className="mt-3 flex flex-row items-baseline justify-between gap-4 w-full text-sm">
          <div className="text-[var(--paper)]">
            {photo.caption && <div className="font-semibold">{photo.caption}</div>}
            <div className="text-[rgba(246,241,230,0.7)] text-xs font-mono mt-1">
              {photo.lat.toFixed(4)}°{photo.lat >= 0 ? "N" : "S"}{" "}
              {photo.lng.toFixed(4)}°{photo.lng >= 0 ? "E" : "W"}
              {photo.takenAt && ` · ${new Date(photo.takenAt).toLocaleDateString()}`}
              {position && position.total > 1 && ` · ${position.index + 1} / ${position.total}`}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[var(--paper)] text-xs uppercase tracking-wider hover:text-[var(--accent)]"
          >
            close (esc)
          </button>
        </div>
      </div>
    </div>
  );
}
