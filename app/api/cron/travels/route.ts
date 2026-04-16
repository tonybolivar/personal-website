import { put } from "@vercel/blob";
import { fetchSyncFiles } from "@/lib/dropbox";
import { parseTile, countVisited } from "@/lib/fog/parseTile";
import { tilesToGeoJson, geoJsonBbox } from "@/lib/fog/polygonize";
import { regionsForTiles } from "@/lib/fog/regions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BLOB_KEY = "travels/latest.json";

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET ?? ""}`;
  if (!process.env.CRON_SECRET || auth !== expected) {
    return new Response("unauthorized", { status: 401 });
  }

  try {
    return await run();
  } catch (err) {
    console.error("[cron/travels] fatal", err);
    return Response.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      },
      { status: 500 },
    );
  }
}

async function run() {
  const started = Date.now();
  const files = await fetchSyncFiles();
  const fetchedMs = Date.now() - started;

  const tiles = [];
  const skipped: { name: string; reason: string }[] = [];
  for (const f of files) {
    try {
      tiles.push(parseTile(f.name, f.bytes));
    } catch (err) {
      skipped.push({ name: f.name, reason: err instanceof Error ? err.message : String(err) });
    }
  }
  const parsedMs = Date.now() - started - fetchedMs;

  const visitedPixelCount = tiles.reduce((s, t) => s + countVisited(t), 0);
  const blockCount = tiles.reduce((s, t) => s + t.blocks.length, 0);

  const fc = tilesToGeoJson(tiles);
  const bbox = geoJsonBbox(fc);
  const polygonizeMs = Date.now() - started - fetchedMs - parsedMs;

  const { countries, states, cities } = await regionsForTiles(tiles);
  const regionsMs = Date.now() - started - fetchedMs - parsedMs - polygonizeMs;

  const payload = {
    type: "FeatureCollection" as const,
    features: fc.features,
    metadata: {
      generatedAt: new Date().toISOString(),
      tileCount: tiles.length,
      skippedTileCount: skipped.length,
      blockCount,
      visitedPixelCount,
      bbox,
      countries,
      states,
      cities,
      timings: { fetchedMs, parsedMs, polygonizeMs, regionsMs },
    },
  };

  const body = JSON.stringify(payload);
  const blob = await put(BLOB_KEY, body, {
    access: "private",
    contentType: "application/geo+json",
    cacheControlMaxAge: 3600,
    allowOverwrite: true,
  });

  return Response.json({
    ok: true,
    url: blob.url,
    ...payload.metadata,
    bytes: body.length,
    skipped,
  });
}
