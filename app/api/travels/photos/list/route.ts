import { readPhotoIndex } from "@/lib/travels/photos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const photos = await readPhotoIndex();
  return Response.json({ photos });
}
