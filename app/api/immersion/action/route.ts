import { randomBytes } from "node:crypto";
import { isAuthed, readData, writeData } from "@/lib/immersion/store";
import { KINDS, type ImmersionData, type Kind } from "@/lib/immersion/model";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

class Bad extends Error {}

const str = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const kindOf = (v: unknown): Kind => {
  const k = KINDS.find((x) => x.id === v);
  if (!k) throw new Bad("Unknown activity type.");
  return k.id;
};
const iso = (v: unknown) => {
  const t = typeof v === "string" ? Date.parse(v) : NaN;
  if (Number.isNaN(t)) throw new Bad("Invalid date or time.");
  return new Date(t).toISOString();
};
const minutes = (v: unknown) => {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0 || n > 24 * 60) throw new Bad("Minutes must be between 1 and 1440.");
  return n;
};
const langOf = (data: ImmersionData, v: unknown) => {
  const lang = data.languages.find((l) => l.id === v);
  if (!lang) throw new Bad("Unknown language.");
  return lang;
};
const newId = () => randomBytes(8).toString("hex");

function apply(data: ImmersionData, body: Record<string, unknown>, nowMs: number) {
  const now = new Date(nowMs).toISOString();
  switch (body.op) {
    case "start": {
      if (data.active) throw new Bad("A timer is already running.");
      data.active = {
        lang: langOf(data, body.lang).id,
        kind: kindOf(body.kind),
        title: str(body.title),
        source: str(body.source, 60),
        start: now,
        pausedAt: null,
        pausedMs: 0,
      };
      return;
    }
    case "updateActive": {
      if (!data.active) throw new Bad("No timer is running.");
      if (body.title !== undefined) data.active.title = str(body.title);
      if (body.source !== undefined) data.active.source = str(body.source, 60);
      if (body.kind !== undefined) data.active.kind = kindOf(body.kind);
      return;
    }
    case "pause": {
      if (!data.active || data.active.pausedAt) return;
      data.active.pausedAt = now;
      return;
    }
    case "resume": {
      const a = data.active;
      if (!a || !a.pausedAt) return;
      a.pausedMs += nowMs - Date.parse(a.pausedAt);
      a.pausedAt = null;
      return;
    }
    case "stop": {
      const a = data.active;
      if (!a) throw new Bad("No timer is running.");
      const pausedMs = a.pausedMs + (a.pausedAt ? nowMs - Date.parse(a.pausedAt) : 0);
      data.sessions.push({
        id: newId(),
        lang: a.lang,
        kind: a.kind,
        title: a.title,
        source: a.source,
        start: a.start,
        end: now,
        pausedMs,
      });
      data.active = null;
      return;
    }
    case "discard": {
      data.active = null;
      return;
    }
    case "add": {
      const start = iso(body.start);
      data.sessions.push({
        id: newId(),
        lang: langOf(data, body.lang).id,
        kind: kindOf(body.kind),
        title: str(body.title),
        source: str(body.source, 60),
        start,
        end: new Date(Date.parse(start) + minutes(body.minutes) * 60_000).toISOString(),
        pausedMs: 0,
      });
      return;
    }
    case "edit": {
      const s = data.sessions.find((x) => x.id === body.id);
      if (!s) throw new Bad("That session no longer exists.");
      s.title = str(body.title);
      s.source = str(body.source, 60);
      s.kind = kindOf(body.kind);
      s.start = iso(body.start);
      s.end = new Date(Date.parse(s.start) + minutes(body.minutes) * 60_000).toISOString();
      s.pausedMs = 0;
      return;
    }
    case "delete": {
      data.sessions = data.sessions.filter((x) => x.id !== body.id);
      return;
    }
    case "setWords": {
      const lang = langOf(data, body.lang);
      const n = Math.round(Number(body.words));
      if (!Number.isFinite(n) || n < 0 || n > 1_000_000) throw new Bad("Word count must be a positive number.");
      lang.words = n;
      lang.wordsUpdatedAt = now;
      return;
    }
    case "addLanguage": {
      const name = str(body.name, 40);
      const id = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      if (!id) throw new Bad("Give the language a name.");
      if (data.languages.some((l) => l.id === id)) throw new Bad("That language already exists.");
      data.languages.push({ id, name, native: str(body.native, 40), words: 0, wordsUpdatedAt: null, createdAt: now });
      return;
    }
    case "settings": {
      const tz = str(body.timezone, 60);
      try {
        new Intl.DateTimeFormat("en-US", { timeZone: tz });
      } catch {
        throw new Bad("Unknown time zone.");
      }
      data.timezone = tz;
      return;
    }
    default:
      throw new Bad("Unknown action.");
  }
}

export async function POST(req: Request) {
  if (!isAuthed(req)) return Response.json({ ok: false, error: "Log in first." }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return Response.json({ ok: false, error: "Bad request." }, { status: 400 });
  const data = await readData();
  try {
    apply(data, body as Record<string, unknown>, Date.now());
  } catch (err) {
    if (err instanceof Bad) return Response.json({ ok: false, error: err.message, data }, { status: 400 });
    throw err;
  }
  await writeData(data);
  return Response.json({ ok: true, data });
}
