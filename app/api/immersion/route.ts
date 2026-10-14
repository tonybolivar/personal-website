import { readData } from "@/lib/immersion/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const data = await readData();
  return Response.json(data, { headers: { "cache-control": "no-store" } });
}
