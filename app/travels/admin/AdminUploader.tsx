"use client";

import { useEffect, useRef, useState } from "react";

interface PhotoEntry {
  id: string;
  lng: number;
  lat: number;
  takenAt: string | null;
  caption: string | null;
  width: number;
  height: number;
  uploadedAt: string;
}

interface PendingFile {
  key: string;
  file: File;
  lng: number | null;
  lat: number | null;
  takenAt: string | null;
  caption: string;
  status: "checking" | "ready" | "no-gps" | "uploading" | "done" | "error";
  message?: string;
  previewUrl: string;
}

export default function AdminUploader() {
  const [secret, setSecret] = useState<string>("");
  const [photos, setPhotos] = useState<PhotoEntry[]>([]);
  const [pending, setPending] = useState<PendingFile[]>([]);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const stored = typeof window !== "undefined" ? sessionStorage.getItem("travels_admin_secret") : null;
    if (stored) setSecret(stored);
    refresh();
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") sessionStorage.setItem("travels_admin_secret", secret);
  }, [secret]);

  async function refresh() {
    try {
      const res = await fetch("/api/travels/photos/list", { cache: "no-store" });
      if (!res.ok) return;
      const json = (await res.json()) as { photos: PhotoEntry[] };
      setPhotos(json.photos);
    } catch {}
  }

  async function onFiles(files: FileList | File[]) {
    const { parse } = await import("exifr");
    const next: PendingFile[] = [];
    for (const file of Array.from(files)) {
      const key = `${file.name}:${file.size}:${file.lastModified}:${Math.random().toString(36).slice(2, 6)}`;
      next.push({
        key,
        file,
        lng: null,
        lat: null,
        takenAt: null,
        caption: "",
        status: "checking",
        previewUrl: URL.createObjectURL(file),
      });
    }
    setPending((prev) => [...prev, ...next]);

    for (const entry of next) {
      try {
        const meta = await parse(entry.file);
        const lng = typeof meta?.longitude === "number" ? meta.longitude : null;
        const lat = typeof meta?.latitude === "number" ? meta.latitude : null;
        const raw = meta?.DateTimeOriginal ?? meta?.CreateDate ?? null;
        const d = raw instanceof Date ? raw : raw ? new Date(raw as string) : null;
        const takenAt = d && Number.isFinite(d.getTime()) ? d.toISOString() : null;
        updatePending(entry.key, {
          lng,
          lat,
          takenAt,
          status: lng !== null && lat !== null ? "ready" : "no-gps",
          message: lng !== null && lat !== null ? undefined : "no GPS in EXIF — skip",
        });
      } catch (err) {
        updatePending(entry.key, {
          status: "error",
          message: err instanceof Error ? err.message : "exif parse failed",
        });
      }
    }
  }

  function updatePending(key: string, patch: Partial<PendingFile>) {
    setPending((prev) => prev.map((p) => (p.key === key ? { ...p, ...patch } : p)));
  }

  async function uploadOne(entry: PendingFile) {
    if (!secret) {
      updatePending(entry.key, { status: "error", message: "enter secret" });
      return;
    }
    if (entry.lng === null || entry.lat === null) return;
    updatePending(entry.key, { status: "uploading", message: "hashing…" });

    try {
      const arrayBuf = await entry.file.arrayBuffer();
      const id = await hashId(arrayBuf);

      updatePending(entry.key, { message: "resizing…" });
      const bitmap = await createImageBitmap(entry.file, { imageOrientation: "from-image" });
      const full = await resizeToBlob(bitmap, 1600, 0.82);
      const thumb = await resizeToBlob(bitmap, 400, 0.78);
      bitmap.close();

      const totalKb = Math.round((full.blob.size + thumb.blob.size) / 1024);
      updatePending(entry.key, { message: `uploading ${totalKb} KB…` });
      const form = new FormData();
      form.append("full", new File([full.blob], `${id}.jpg`, { type: "image/jpeg" }));
      form.append("thumb", new File([thumb.blob], `${id}-thumb.jpg`, { type: "image/jpeg" }));
      form.append(
        "meta",
        JSON.stringify({
          id,
          lng: entry.lng,
          lat: entry.lat,
          takenAt: entry.takenAt,
          caption: entry.caption.trim() || null,
          width: full.width,
          height: full.height,
          thumbWidth: thumb.width,
          thumbHeight: thumb.height,
        }),
      );
      const res = await fetch("/api/travels/photos/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${secret}` },
        body: form,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      updatePending(entry.key, { status: "done", message: "pinned" });
      refresh();
    } catch (err) {
      updatePending(entry.key, {
        status: "error",
        message: err instanceof Error ? err.message : "upload failed",
      });
    }
  }

  async function uploadAll() {
    for (const entry of pending) {
      if (entry.status === "ready") await uploadOne(entry);
    }
  }

  async function removePhoto(id: string) {
    if (!secret) return;
    if (!confirm(`delete photo ${id}?`)) return;
    const res = await fetch(`/api/travels/photos/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${secret}` },
    });
    if (res.ok) refresh();
    else alert(`delete failed: ${res.status}`);
  }

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className="ink-muted text-xs uppercase tracking-wider">admin secret</span>
        <input
          type="password"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          className="border border-[rgba(18,18,18,0.3)] px-3 py-2 bg-white text-sm font-mono"
          placeholder="CRON_SECRET"
          autoComplete="off"
        />
      </label>

      <div
        onDragEnter={(e) => { e.preventDefault(); setDragging(true); }}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (e.dataTransfer.files.length) onFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed p-10 text-center cursor-pointer transition-colors ${dragging ? "bg-[rgba(179,0,0,0.06)] border-[var(--accent)]" : "border-[rgba(18,18,18,0.3)] hover:border-[var(--accent)]"}`}
      >
        <p className="ink-body">drop photos here</p>
        <p className="ink-muted text-xs mt-1">or click to pick · jpg/png with GPS EXIF</p>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && onFiles(e.target.files)}
        />
      </div>

      {pending.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-row items-center gap-3">
            <button
              type="button"
              onClick={uploadAll}
              className="link-accent text-sm"
              disabled={!secret || !pending.some((p) => p.status === "ready")}
            >
              upload all ready
            </button>
            <button
              type="button"
              onClick={() => {
                for (const p of pending) URL.revokeObjectURL(p.previewUrl);
                setPending([]);
              }}
              className="ink-muted text-sm hover:text-[var(--accent)]"
            >
              clear
            </button>
          </div>

          {pending.map((p) => (
            <div key={p.key} className="flex flex-row gap-3 border border-[rgba(18,18,18,0.15)] p-3 items-start">
              <img src={p.previewUrl} alt="" className="w-24 h-24 object-cover" />
              <div className="flex-1 flex flex-col gap-1">
                <div className="flex flex-row justify-between gap-2">
                  <span className="text-sm ink-body font-mono break-all">{p.file.name}</span>
                  <span className={`text-xs uppercase tracking-wider ${statusClass(p.status)}`}>
                    {p.status}
                  </span>
                </div>
                {p.lat !== null && p.lng !== null && (
                  <span className="text-xs ink-muted font-mono">
                    {p.lat.toFixed(4)}°{p.lat >= 0 ? "N" : "S"} {p.lng.toFixed(4)}°{p.lng >= 0 ? "E" : "W"}
                    {p.takenAt && ` · ${new Date(p.takenAt).toLocaleDateString()}`}
                  </span>
                )}
                {p.message && (
                  <span className="text-xs" style={{ color: p.status === "done" ? "#1a6e1a" : p.status === "error" ? "#b30000" : "#5a5a5a" }}>
                    {p.message}
                  </span>
                )}
                {p.status === "ready" && (
                  <>
                    <input
                      value={p.caption}
                      onChange={(e) => updatePending(p.key, { caption: e.target.value })}
                      placeholder="optional caption"
                      className="text-sm border border-[rgba(18,18,18,0.2)] px-2 py-1 mt-1"
                    />
                    <button
                      type="button"
                      onClick={() => uploadOne(p)}
                      className="link-accent text-sm self-start"
                      disabled={!secret}
                    >
                      upload
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4">
        <div className="section-title" style={{ paddingTop: "1rem" }}>existing ({photos.length})</div>
        {photos.length === 0 ? (
          <p className="ink-muted text-sm">none yet</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {photos.map((p) => (
              <div key={p.id} className="border border-[rgba(18,18,18,0.15)] p-2 flex flex-col gap-1">
                <img
                  src={`/api/travels/photos/${p.id}/thumb`}
                  alt={p.caption ?? ""}
                  className="w-full aspect-square object-cover"
                />
                <div className="text-[11px] ink-muted font-mono">
                  {p.lat.toFixed(3)},{p.lng.toFixed(3)}
                </div>
                {p.caption && <div className="text-xs ink-body">{p.caption}</div>}
                <button
                  type="button"
                  onClick={() => removePhoto(p.id)}
                  className="text-xs ink-muted hover:text-[var(--accent)] self-start"
                >
                  delete
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function statusClass(s: PendingFile["status"]): string {
  switch (s) {
    case "checking":
    case "uploading":
      return "ink-muted";
    case "ready":
      return "text-[var(--accent)]";
    case "done":
      return "text-[color:#1a6e1a]";
    case "no-gps":
    case "error":
    default:
      return "text-[color:#b30000]";
  }
}

async function hashId(buf: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", buf);
  const hex = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return hex.slice(0, 16);
}

async function resizeToBlob(
  bitmap: ImageBitmap,
  maxWidth: number,
  quality: number,
): Promise<{ blob: Blob; width: number; height: number }> {
  const ratio = bitmap.width > maxWidth ? maxWidth / bitmap.width : 1;
  const width = Math.max(1, Math.round(bitmap.width * ratio));
  const height = Math.max(1, Math.round(bitmap.height * ratio));
  if (typeof OffscreenCanvas !== "undefined") {
    const c = new OffscreenCanvas(width, height);
    const ctx = c.getContext("2d");
    if (!ctx) throw new Error("no 2d context");
    ctx.drawImage(bitmap, 0, 0, width, height);
    const blob = await c.convertToBlob({ type: "image/jpeg", quality });
    return { blob, width, height };
  }
  const c = document.createElement("canvas");
  c.width = width;
  c.height = height;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("no 2d context");
  ctx.drawImage(bitmap, 0, 0, width, height);
  const blob = await new Promise<Blob | null>((resolve) =>
    c.toBlob(resolve, "image/jpeg", quality),
  );
  if (!blob) throw new Error("canvas toBlob failed");
  return { blob, width, height };
}
