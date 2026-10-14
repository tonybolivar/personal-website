import type { Metadata } from "next";
import { notFound } from "next/navigation";
import SiteHeader from "@/components/immersion/SiteHeader";
import Heatmap from "@/components/immersion/Heatmap";
import { readData } from "@/lib/immersion/store";
import {
  KINDS,
  dayKey,
  formatDuration,
  formatHours,
  kindInfo,
  langStats,
  nextMilestone,
  sessionMs,
  type Session,
} from "@/lib/immersion/model";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { lang: string } }): Promise<Metadata> {
  const data = await readData();
  const lang = data.languages.find((l) => l.id === params.lang);
  return {
    title: lang ? `${lang.name} immersion` : "immersion",
    description: lang ? `Hours of ${lang.name} immersion and words learned.` : undefined,
  };
}

function Stat({ value, label, accent }: { value: string; label: string; accent?: boolean }) {
  return (
    <div>
      <p className={`text-3xl font-semibold tabular-nums ${accent ? "text-[var(--accent)]" : ""}`}>{value}</p>
      <p className="text-xs ink-muted">{label}</p>
    </div>
  );
}

export default async function LanguagePage({ params }: { params: { lang: string } }) {
  const data = await readData();
  const lang = data.languages.find((l) => l.id === params.lang);
  if (!lang) notFound();

  const tz = data.timezone;
  const now = new Date();
  const stats = langStats(data, lang.id, now);
  const mile = nextMilestone(stats.totalMs);
  const live = data.active?.lang === lang.id ? data.active : null;
  const kindRows = KINDS.filter((k) => stats.byKind[k.id]).sort((a, b) => stats.byKind[b.id] - stats.byKind[a.id]);
  const maxKind = Math.max(1, ...kindRows.map((k) => stats.byKind[k.id]));

  const recent = stats.sessions.slice(0, 30);
  const groups: { day: string; items: Session[]; ms: number }[] = [];
  for (const s of recent) {
    const day = dayKey(s.start, tz);
    let g = groups[groups.length - 1];
    if (!g || g.day !== day) groups.push((g = { day, items: [], ms: 0 }));
    g.items.push(s);
    g.ms += sessionMs(s);
  }
  const dayLabel = (key: string) =>
    new Date(`${key}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "long", day: "numeric", timeZone: "UTC" });

  return (
    <div className="max-w-3xl w-full mx-auto px-6">
      <div className="w-full paper-surface">
        <div className="min-h-screen py-10">
          <SiteHeader line={`learning ${lang.name.toLowerCase()}`} />
          <hr className="rule" />

          <div className="flex items-baseline justify-between gap-4 flex-wrap">
            <h1 className="text-3xl font-semibold leading-tight ink-title">
              {lang.name} <span className="ink-muted font-normal">{lang.native}</span>
            </h1>
            <a href="/immersion" className="link-accent text-sm">all languages</a>
          </div>

          {live && (
            <p className="mt-3 text-sm flex items-center gap-2">
              <span className="live-dot" />
              <span>
                {kindInfo(live.kind).label.toLowerCase()}
                {live.title ? <> <span className="ink-muted">·</span> {live.title}</> : null} right now
              </span>
            </p>
          )}

          <div className="mt-6 grid grid-cols-2 gap-5 sm:grid-cols-4">
            <Stat value={formatHours(stats.totalMs)} label="hours of immersion" accent />
            <Stat value={lang.words.toLocaleString()} label="words learned" />
            <Stat value={String(stats.streak)} label="day streak" />
            <Stat value={formatHours(stats.weekMs)} label="hours this week" />
          </div>

          <div className="mt-6">
            <div className="h-2 rounded-full bg-[rgba(18,18,18,0.08)] overflow-hidden">
              <div className="h-full bg-[var(--accent)]" style={{ width: `${mile.pct.toFixed(1)}%` }} />
            </div>
            <p className="mt-2 text-xs ink-muted">
              {stats.totalMs ? `${mile.left.toFixed(1)} hours to ${mile.next}` : `first stop: ${mile.next} hours`}
            </p>
          </div>

          <hr className="rule" />
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-semibold ink-title">Last six months</h2>
            <p className="text-xs ink-muted">{stats.activeDays} active days</p>
          </div>
          <div className="mt-4">
            <Heatmap byDay={stats.byDay} today={dayKey(now, tz)} />
          </div>

          {kindRows.length > 0 && (
            <>
              <hr className="rule" />
              <h2 className="text-lg font-semibold ink-title">By activity</h2>
              <div className="mt-4 grid gap-3">
                {kindRows.map((k) => (
                  <div key={k.id} className="grid grid-cols-[84px_1fr_72px] items-center gap-3 text-sm">
                    <span>{k.label}</span>
                    <div className="h-3 rounded-sm bg-[rgba(18,18,18,0.06)] overflow-hidden">
                      <div className="h-full" style={{ width: `${(stats.byKind[k.id] / maxKind) * 100}%`, background: k.color }} />
                    </div>
                    <span className="text-right tabular-nums ink-muted">{formatHours(stats.byKind[k.id])} h</span>
                  </div>
                ))}
              </div>
            </>
          )}

          <hr className="rule" />
          <h2 className="text-lg font-semibold ink-title">Recent sessions</h2>
          {groups.length === 0 ? (
            <p className="mt-3 ink-muted">Nothing logged yet.</p>
          ) : (
            <div className="mt-4 grid gap-6">
              {groups.map((g) => (
                <div key={g.day}>
                  <div className="flex items-baseline justify-between text-sm">
                    <p className="font-semibold">{dayLabel(g.day)}</p>
                    <p className="ink-muted tabular-nums">{formatDuration(g.ms)}</p>
                  </div>
                  <ul className="mt-2 border-t border-[rgba(18,18,18,0.12)]">
                    {g.items.map((s) => {
                      const k = kindInfo(s.kind);
                      return (
                        <li key={s.id} className="flex items-center gap-3 py-2 border-b border-[rgba(18,18,18,0.08)] text-sm">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: k.color }} />
                          <span className="min-w-0 flex-1 break-words">
                            {s.title || k.label}
                            {s.source ? <span className="ink-muted"> · {s.source}</span> : null}
                          </span>
                          <span className="ink-muted tabular-nums shrink-0">{formatDuration(sessionMs(s))}</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          )}
          <p className="mt-8 text-xs ink-muted">
            Words learned {lang.wordsUpdatedAt ? `as of ${new Date(lang.wordsUpdatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: tz })}` : ""}, counted from my flashcard decks.
          </p>
        </div>
      </div>
    </div>
  );
}
