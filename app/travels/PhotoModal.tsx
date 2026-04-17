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
}: {
  photo: PhotoLite;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(18,18,18,0.75)] backdrop-blur-sm p-6"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative max-w-5xl w-full flex flex-col items-center"
      >
        <img
          src={`/api/travels/photos/${photo.id}/image`}
          alt={photo.caption ?? ""}
          className="max-h-[80vh] w-auto object-contain border border-[rgba(18,18,18,0.4)] bg-[var(--paper)]"
          style={{ maxWidth: "100%" }}
        />
        <div className="mt-3 flex flex-row items-baseline justify-between gap-4 w-full text-sm">
          <div className="text-[var(--paper)]">
            {photo.caption && <div className="font-semibold">{photo.caption}</div>}
            <div className="text-[rgba(246,241,230,0.7)] text-xs font-mono mt-1">
              {photo.lat.toFixed(4)}°{photo.lat >= 0 ? "N" : "S"}{" "}
              {photo.lng.toFixed(4)}°{photo.lng >= 0 ? "E" : "W"}
              {photo.takenAt && ` · ${new Date(photo.takenAt).toLocaleDateString()}`}
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
