import { get } from "@vercel/blob";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  return streamPhoto(`travels/photos/${params.id}.jpg`);
}

async function streamPhoto(key: string): Promise<Response> {
  if (!/^travels\/photos\/[a-f0-9]{16}(-thumb)?\.jpg$/.test(key)) {
    return new Response("not found", { status: 404 });
  }
  const result = await get(key, { access: "private" });
  if (!result || result.statusCode !== 200) return new Response("not found", { status: 404 });
  return new Response(result.stream, {
    headers: {
      "content-type": "image/jpeg",
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
}
