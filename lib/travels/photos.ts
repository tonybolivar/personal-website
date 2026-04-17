import { createHash } from "node:crypto";
import { get, put } from "@vercel/blob";

export const PHOTOS_INDEX_KEY = "travels/photos/index.json";

export interface Photo {
  id: string;
  lng: number;
  lat: number;
  takenAt: string | null;
  caption: string | null;
  width: number;
  height: number;
  thumbWidth: number;
  thumbHeight: number;
  uploadedAt: string;
}

export function contentHashId(bytes: Uint8Array | Buffer): string {
  return createHash("sha256").update(bytes).digest("hex").slice(0, 16);
}

export async function readPhotoIndex(): Promise<Photo[]> {
  try {
    const result = await get(PHOTOS_INDEX_KEY, { access: "private" });
    if (!result || result.statusCode !== 200) return [];
    const text = await new Response(result.stream).text();
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? (parsed as Photo[]) : [];
  } catch {
    return [];
  }
}

export async function writePhotoIndex(photos: Photo[]): Promise<void> {
  const sorted = [...photos].sort((a, b) => {
    const ta = a.takenAt ?? a.uploadedAt;
    const tb = b.takenAt ?? b.uploadedAt;
    return tb.localeCompare(ta);
  });
  await put(PHOTOS_INDEX_KEY, JSON.stringify(sorted), {
    access: "private",
    contentType: "application/json",
    cacheControlMaxAge: 60,
    allowOverwrite: true,
  });
}
