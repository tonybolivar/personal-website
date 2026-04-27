import { get } from "@vercel/blob";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { date: string } },
) {
  const date = params.date;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return new Response("invalid date", { status: 400 });
  }
  try {
    const result = await get(`travels/history/${date}.json`, { access: "private" });
    if (!result || result.statusCode !== 200) {
      return new Response("not found", { status: 404 });
    }
    const text = await new Response(result.stream).text();
    return new Response(text, {
      status: 200,
      headers: {
        "content-type": "application/geo+json",
        // Snapshots are immutable once written, so cache aggressively.
        "cache-control": "public, max-age=86400, s-maxage=86400, immutable",
      },
    });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
