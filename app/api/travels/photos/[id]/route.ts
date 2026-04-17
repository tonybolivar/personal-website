import { del } from "@vercel/blob";
import { readPhotoIndex, writePhotoIndex } from "@/lib/travels/photos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("unauthorized", { status: 401 });
  }
  const id = params.id;
  if (!/^[a-f0-9]{16}$/.test(id)) {
    return Response.json({ error: "bad id" }, { status: 400 });
  }
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
