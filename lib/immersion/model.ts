// Shared by the server routes and the client pages, so nothing here may
// import node-only modules.

export type Kind = "watch" | "listen" | "read" | "speak" | "write";

export const KINDS: { id: Kind; label: string; color: string }[] = [
  { id: "watch", label: "Watching", color: "#6d4fc2" },
  { id: "listen", label: "Listening", color: "#1f7a9e" },
  { id: "read", label: "Reading", color: "#2f7d4c" },
  { id: "speak", label: "Speaking", color: "#b30000" },
  { id: "write", label: "Writing", color: "#a86a00" },
];

export interface Language {
  id: string;
  name: string;
  native: string;
  words: number;
  wordsUpdatedAt: string | null;
  createdAt: string;
}

export interface Session {
  id: string;
  lang: string;
  kind: Kind;
  title: string;
  source: string;
  start: string;
  end: string;
  pausedMs: number;
}

export interface Active {
  lang: string;
  kind: Kind;
  title: string;
  source: string;
  start: string;
  pausedAt: string | null;
  pausedMs: number;
}

export interface ImmersionData {
  version: 1;
  timezone: string;
  languages: Language[];
  sessions: Session[];
  active: Active | null;
}

export const MILESTONES = [10, 25, 50, 100, 150, 250, 400, 600, 800, 1000, 1500, 2000, 3000];

export function emptyData(): ImmersionData {
  return {
    version: 1,
    timezone: "Asia/Seoul",
    languages: [
      {
        id: "korean",
        name: "Korean",
        native: "한국어",
        words: 0,
        wordsUpdatedAt: null,
        createdAt: new Date().toISOString(),
      },
    ],
    sessions: [],
    active: null,
  };
}

export function kindInfo(kind: string) {
  return KINDS.find((k) => k.id === kind) ?? KINDS[0];
}

export function sessionMs(s: { start: string; end: string; pausedMs: number }): number {
  return Math.max(0, Date.parse(s.end) - Date.parse(s.start) - (s.pausedMs || 0));
}

export function activeMs(a: Active, now = Date.now()): number {
  const paused = a.pausedMs + (a.pausedAt ? now - Date.parse(a.pausedAt) : 0);
  return Math.max(0, now - Date.parse(a.start) - paused);
}

export function dayKey(date: Date | string, timezone: string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export function shiftDay(key: string, days: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return t.toISOString().slice(0, 10);
}

// 0 = Monday
export function weekdayOf(key: string): number {
  const [y, m, d] = key.split("-").map(Number);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

export function formatDuration(ms: number, withSeconds = false): string {
  const totalSec = Math.round(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h) return m ? `${h} h ${m} min` : `${h} h`;
  if (withSeconds) return m ? `${m} min ${s} sec` : `${s} sec`;
  return `${m} min`;
}

export function formatHours(ms: number): string {
  const h = ms / 3_600_000;
  if (h >= 100) return Math.round(h).toLocaleString();
  return h.toFixed(1);
}

export interface LangStats {
  totalMs: number;
  todayMs: number;
  weekMs: number;
  streak: number;
  byKind: Record<string, number>;
  byDay: Record<string, number>;
  sessions: Session[];
  activeDays: number;
}

export function langStats(data: ImmersionData, lang: string, now = new Date()): LangStats {
  const tz = data.timezone;
  const sessions = data.sessions
    .filter((s) => s.lang === lang)
    .sort((a, b) => b.start.localeCompare(a.start));
  const byDay: Record<string, number> = {};
  const byKind: Record<string, number> = {};
  let totalMs = 0;
  for (const s of sessions) {
    const ms = sessionMs(s);
    totalMs += ms;
    const k = dayKey(s.start, tz);
    byDay[k] = (byDay[k] || 0) + ms;
    byKind[s.kind] = (byKind[s.kind] || 0) + ms;
  }
  const today = dayKey(now, tz);
  const monday = shiftDay(today, -weekdayOf(today));
  let weekMs = 0;
  for (let i = 0; i < 7; i++) weekMs += byDay[shiftDay(monday, i)] || 0;
  let streak = 0;
  let cursor = byDay[today] ? today : shiftDay(today, -1);
  while (byDay[cursor]) {
    streak++;
    cursor = shiftDay(cursor, -1);
  }
  return {
    totalMs,
    todayMs: byDay[today] || 0,
    weekMs,
    streak,
    byKind,
    byDay,
    sessions,
    activeDays: Object.keys(byDay).length,
  };
}

export function nextMilestone(totalMs: number) {
  const hours = totalMs / 3_600_000;
  const next = MILESTONES.find((m) => m > hours) ?? Math.ceil(hours / 1000 + 1) * 1000;
  const prev = [0, ...MILESTONES].filter((m) => m < next).pop() ?? 0;
  return { next, prev, pct: Math.min(100, ((hours - prev) / (next - prev)) * 100), left: next - hours };
}
