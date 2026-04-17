import { put } from "@vercel/blob";
import {
  readPhotoIndex,
  writePhotoIndex,
  type Photo,
} from "@/lib/travels/photos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Client pre-resizes to ~1600 px full + ~400 px thumb via canvas, so the
// multipart body stays well under Vercel's 4.5 MB function limit. The
// server does no image processing — just validates, stores both blobs,
// and updates the photos/index.json.
export async function POST(req: Request) {
  try {
    return await doUpload(req);
  } catch (err) {
    console.error("[photos/upload] fatal", err);
    return Response.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}

async function doUpload(req: Request): Promise<Response> {
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("unauthorized", { status: 401 });
  }

  const form = await req.formData();
  const full = form.get("full");
  const thumb = form.get("thumb");
  const metaRaw = form.get("meta");
  if (!(full instanceof File) || !(thumb instanceof File) || typeof metaRaw !== "string") {
    return Response.json({ error: "missing full/thumb/meta" }, { status: 400 });
  }
  let meta: Partial<Photo>;
  try {
    meta = JSON.parse(metaRaw);
  } catch {
    return Response.json({ error: "meta is not valid JSON" }, { status: 400 });
  }
  if (
    typeof meta.id !== "string" ||
    !/^[a-f0-9]{16}$/.test(meta.id) ||
    typeof meta.lng !== "number" ||
    typeof meta.lat !== "number" ||
    typeof meta.width !== "number" ||
    typeof meta.height !== "number" ||
    typeof meta.thumbWidth !== "number" ||
    typeof meta.thumbHeight !== "number"
  ) {
    return Response.json({ error: "invalid meta payload" }, { status: 400 });
  }
  if (full.size > 5 * 1024 * 1024 || thumb.size > 1 * 1024 * 1024) {
    return Response.json({ error: "resized image too large" }, { status: 413 });
  }

  const id = meta.id;
  const [fullBytes, thumbBytes] = await Promise.all([
    full.arrayBuffer(),
    thumb.arrayBuffer(),
  ]);

  await Promise.all([
    put(`travels/photos/${id}.jpg`, Buffer.from(fullBytes), {
      access: "private",
      contentType: "image/jpeg",
      cacheControlMaxAge: 60 * 60 * 24 * 365,
      allowOverwrite: true,
    }),
    put(`travels/photos/${id}-thumb.jpg`, Buffer.from(thumbBytes), {
      access: "private",
      contentType: "image/jpeg",
      cacheControlMaxAge: 60 * 60 * 24 * 365,
      allowOverwrite: true,
    }),
  ]);

  const index = await readPhotoIndex();
  const existing = index.find((p) => p.id === id);
  const photo: Photo = {
    id,
    lng: meta.lng,
    lat: meta.lat,
    takenAt: typeof meta.takenAt === "string" ? meta.takenAt : null,
    caption:
      typeof meta.caption === "string" && meta.caption.trim()
        ? meta.caption.trim()
        : existing?.caption ?? null,
    width: meta.width,
    height: meta.height,
    thumbWidth: meta.thumbWidth,
    thumbHeight: meta.thumbHeight,
    uploadedAt: existing?.uploadedAt ?? new Date().toISOString(),
  };
  const next = [...index.filter((p) => p.id !== id), photo];
  await writePhotoIndex(next);

  return Response.json({ ok: true, photo, replaced: Boolean(existing) });
}
