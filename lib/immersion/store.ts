import { createHmac, timingSafeEqual } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { get, put } from "@vercel/blob";
import { emptyData, type ImmersionData } from "./model";

const BLOB_KEY = "immersion/data.json";
const LOCAL_FILE = path.join(process.cwd(), ".data", "immersion.json");
export const AUTH_COOKIE = "immersion_auth";

// Without a Blob token (local dev) the data lives in .data/immersion.json.
const useBlob = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN);

export async function readData(): Promise<ImmersionData> {
  try {
    let text: string;
    if (useBlob()) {
      const result = await get(BLOB_KEY, { access: "private", useCache: false });
      if (!result || result.statusCode !== 200) return emptyData();
      text = await new Response(result.stream).text();
    } else {
      text = await fs.readFile(LOCAL_FILE, "utf8");
    }
    const parsed = JSON.parse(text) as ImmersionData;
    return parsed && parsed.version === 1 ? parsed : emptyData();
  } catch {
    return emptyData();
  }
}

export async function writeData(data: ImmersionData): Promise<void> {
  const body = JSON.stringify(data);
  if (useBlob()) {
    await put(BLOB_KEY, body, {
      access: "private",
      contentType: "application/json",
      cacheControlMaxAge: 60,
      allowOverwrite: true,
    });
  } else {
    await fs.mkdir(path.dirname(LOCAL_FILE), { recursive: true });
    await fs.writeFile(LOCAL_FILE, body);
  }
}

function secret(): string {
  return process.env.IMMERSION_SECRET || process.env.CRON_SECRET || "";
}

export function sessionToken(): string {
  return createHmac("sha256", secret()).update("immersion-session-v1").digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

export function checkPassword(candidate: string): boolean {
  const s = secret();
  console.log(`[immersion] secret configured=${Boolean(s)} len=${s.length} candidateLen=${candidate.length}`);
  return Boolean(s) && safeEqual(candidate, s);
}

export function isAuthed(req: Request): boolean {
  if (!secret()) return false;
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ") && checkPassword(auth.slice(7))) return true;
  const cookie = req.headers.get("cookie") ?? "";
  const match = cookie.split(/;\s*/).find((c) => c.startsWith(`${AUTH_COOKIE}=`));
  return Boolean(match) && safeEqual(match!.slice(AUTH_COOKIE.length + 1), sessionToken());
}
