import { put, del } from "@vercel/blob";
import { parse as parseExif } from "exifr";
import sharp from "sharp";
import {
  contentHashId,
  readPhotoIndex,
  writePhotoIndex,
  type Photo,
} from "@/lib/travels/photos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function unauthorized() {
  return new Response("unauthorized", { status: 401 });
}

export async function POST(req: Request) {
  try {
    return await doUpload(req);
  } catch (err) {
    console.error("[photos/upload] fatal", err);
    return Response.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack?.split("\n").slice(0, 6).join("\n") : undefined,
      },
      { status: 500 },
    );
  }
}

async function doUpload(req: Request): Promise<Response> {
  const auth = req.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET ?? ""}`;
  if (!process.env.CRON_SECRET || auth !== expected) return unauthorized();

  const form = await req.formData();
  const file = form.get("file");
  const caption = (form.get("caption") as string | null)?.trim() || null;
  if (!(file instanceof File)) {
    return Response.json({ error: "missing 'file'" }, { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const exif = await parseExif(buf).catch(() => null);
  const lng = typeof exif?.longitude === "number" ? exif.longitude : null;
  const lat = typeof exif?.latitude === "number" ? exif.latitude : null;
  if (lng === null || lat === null) {
    return Response.json(
      { error: "no GPS coordinates in image EXIF" },
      { status: 422 },
    );
  }
  const takenAt: string | null = (() => {
    const raw = exif?.DateTimeOriginal ?? exif?.CreateDate;
    if (!raw) return null;
    const d = raw instanceof Date ? raw : new Date(raw as string);
    return Number.isFinite(d.getTime()) ? d.toISOString() : null;
  })();

  const id = contentHashId(buf);

  const [fullBuf, thumbBuf] = await Promise.all([
    sharp(buf)
      .rotate()
      .resize({ width: 1600, withoutEnlargement: true })
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer({ resolveWithObject: true }),
    sharp(buf)
      .rotate()
      .resize({ width: 400, withoutEnlargement: true })
      .jpeg({ quality: 78 })
      .toBuffer({ resolveWithObject: true }),
  ]);

  await Promise.all([
    put(`travels/photos/${id}.jpg`, fullBuf.data, {
      access: "private",
      contentType: "image/jpeg",
      cacheControlMaxAge: 60 * 60 * 24 * 365,
      allowOverwrite: true,
    }),
    put(`travels/photos/${id}-thumb.jpg`, thumbBuf.data, {
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
    lng,
    lat,
    takenAt,
    caption: caption ?? existing?.caption ?? null,
    width: fullBuf.info.width,
    height: fullBuf.info.height,
    thumbWidth: thumbBuf.info.width,
    thumbHeight: thumbBuf.info.height,
    uploadedAt: existing?.uploadedAt ?? new Date().toISOString(),
  };
  const next = [...index.filter((p) => p.id !== id), photo];
  await writePhotoIndex(next);

  return Response.json({ ok: true, photo, replaced: Boolean(existing) });
}

export async function DELETE(req: Request) {
  const auth = req.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET ?? ""}`;
  if (!process.env.CRON_SECRET || auth !== expected) return unauthorized();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return Response.json({ error: "missing id" }, { status: 400 });
  const index = await readPhotoIndex();
  if (!index.some((p) => p.id === id)) {
    return Response.json({ error: "not found" }, { status: 404 });
  }
  await Promise.all([
    del(`travels/photos/${id}.jpg`).catch(() => undefined),
    del(`travels/photos/${id}-thumb.jpg`).catch(() => undefined),
  ]);
  await writePhotoIndex(index.filter((p) => p.id !== id));
  return Response.json({ ok: true });
}
