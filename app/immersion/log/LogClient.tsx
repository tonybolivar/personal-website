"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  KINDS,
  activeMs,
  dayKey,
  formatDuration,
  formatHours,
  kindInfo,
  langStats,
  sessionMs,
  type ImmersionData,
  type Kind,
  type Session,
} from "@/lib/immersion/model";

const border = "border border-[rgba(18,18,18,0.16)]";
const field = `${border} rounded-md bg-[rgba(255,255,255,0.5)] px-3 py-2 w-full min-w-0 focus:outline-none focus:border-[var(--accent)]`;
const btn = "rounded-md px-4 py-2 font-semibold disabled:opacity-40";
const btnRed = `${btn} bg-[var(--accent)] text-[var(--paper)] hover:opacity-90`;
const btnGhost = `${btn} ${border} hover:border-[var(--accent)]`;

function clock(ms: number) {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h}:${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

function timeOfDay(isoStr: string, tz: string) {
  return new Date(isoStr).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: tz });
}

// "2026-10-14" + "20:30" in the log's time zone -> ISO
function zonedIso(day: string, time: string, tz: string) {
  const guess = new Date(`${day}T${time}:00Z`);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  }).formatToParts(guess);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"));
  return new Date(guess.getTime() - (asUtc - guess.getTime())).toISOString();
}

function KindPicker({ value, onChange }: { value: Kind; onChange: (k: Kind) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {KINDS.map((k) => (
        <button
          key={k.id}
          type="button"
          onClick={() => onChange(k.id)}
          className="rounded-full px-3 py-1 text-sm border transition-colors"
          style={
            value === k.id
              ? { background: k.color, borderColor: k.color, color: "var(--paper)" }
              : { borderColor: k.color, color: k.color }
          }
        >
          {k.label}
        </button>
      ))}
    </div>
  );
}

function Tag({ text, color }: { text: string; color: string }) {
  return (
    <span className="rounded px-1.5 text-xs border" style={{ borderColor: color, color }}>
      {text}
    </span>
  );
}

export default function LogClient() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [data, setData] = useState<ImmersionData | null>(null);
  const [lang, setLang] = useState<string>("korean");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());

  const [title, setTitle] = useState("");
  const [source, setSource] = useState("");
  const [kind, setKind] = useState<Kind>("watch");
  const [showAdd, setShowAdd] = useState(false);
  const [addDay, setAddDay] = useState("");
  const [addTime, setAddTime] = useState("20:00");
  const [addMin, setAddMin] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [words, setWords] = useState("");
  const [newLang, setNewLang] = useState({ name: "", native: "" });
  const [showNewLang, setShowNewLang] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/immersion", { cache: "no-store" });
    const d = (await res.json()) as ImmersionData;
    setData(d);
    if (d.active) {
      setLang(d.active.lang);
      setTitle(d.active.title);
      setSource(d.active.source);
      setKind(d.active.kind);
    }
  }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("immersion_lang");
      if (saved) setLang(saved);
    } catch {}
    fetch("/api/immersion/login", { cache: "no-store" })
      .then((r) => r.json())
      .then((r) => {
        setAuthed(Boolean(r.authed));
        if (r.authed) load();
      })
      .catch(() => setAuthed(false));
  }, [load]);

  useEffect(() => {
    if (!data?.active || data.active.pausedAt) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [data?.active]);

  useEffect(() => {
    const onFocus = () => authed && load();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [authed, load]);

  useEffect(() => {
    const l = data?.languages.find((x) => x.id === lang);
    if (l) setWords(String(l.words));
  }, [data, lang]);

  const act = useCallback(async (body: Record<string, unknown>) => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/immersion/action", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const r = await res.json();
      if (r.data) setData(r.data);
      if (res.status === 401) setAuthed(false);
      if (!r.ok) setError(r.error || "Something went wrong.");
      setNow(Date.now());
      return Boolean(r.ok);
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  const tz = data?.timezone ?? "Asia/Seoul";
  const active = data?.active ?? null;
  const language = data?.languages.find((l) => l.id === lang) ?? data?.languages[0];
  const stats = useMemo(() => (data && language ? langStats(data, language.id) : null), [data, language]);

  const groups = useMemo(() => {
    const out: { day: string; items: Session[]; ms: number }[] = [];
    for (const s of stats?.sessions ?? []) {
      const day = dayKey(s.start, tz);
      let g = out[out.length - 1];
      if (!g || g.day !== day) out.push((g = { day, items: [], ms: 0 }));
      g.items.push(s);
      g.ms += sessionMs(s);
    }
    return out;
  }, [stats, tz]);

  if (authed === null) return <p className="ink-muted">Loading…</p>;

  if (!authed) {
    return (
      <form
        className="max-w-sm grid gap-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          const res = await fetch("/api/immersion/login", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ password }),
          });
          if (res.ok) {
            setAuthed(true);
            setPassword("");
            load();
          } else setError("Wrong password.");
        }}
      >
        <h1 className="text-2xl font-semibold ink-title">Immersion log</h1>
        <label htmlFor="pw" className="text-sm ink-muted">Password</label>
        <input id="pw" type="password" className={field} value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
        <button className={btnRed} disabled={!password}>Log in</button>
        {error && <p className="text-sm text-[var(--accent)]">{error}</p>}
        <a href="/immersion" className="link-accent text-sm">back to /immersion</a>
      </form>
    );
  }

  if (!data || !language || !stats) return <p className="ink-muted">Loading…</p>;

  const pickLang = (id: string) => {
    setLang(id);
    try { localStorage.setItem("immersion_lang", id); } catch {}
  };
  const elapsed = active ? activeMs(active, now) : 0;
  const todayKey = dayKey(new Date(), tz);

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-semibold ink-title">Immersion log</h1>
        <div className="flex gap-4 text-sm">
          <a href={`/immersion/${language.id}`} className="link-accent">public page</a>
          <button
            type="button"
            className="ink-muted hover:text-[var(--ink)]"
            onClick={async () => { await fetch("/api/immersion/login", { method: "DELETE" }); setAuthed(false); }}
          >
            log out
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        {data.languages.map((l) => (
          <button
            key={l.id}
            type="button"
            onClick={() => pickLang(l.id)}
            disabled={Boolean(active) && active!.lang !== l.id}
            className={`rounded-full px-3 py-1 text-sm border ${l.id === language.id ? "bg-[var(--ink)] text-[var(--paper)] border-[var(--ink)]" : "border-[rgba(18,18,18,0.25)]"} disabled:opacity-40`}
          >
            {l.name} <span className="opacity-70">{l.native}</span>
          </button>
        ))}
        <button type="button" className="text-sm link-accent" onClick={() => setShowNewLang((v) => !v)}>
          + language
        </button>
      </div>
      {showNewLang && (
        <form
          className="flex flex-wrap gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await act({ op: "addLanguage", ...newLang })) {
              const id = newLang.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
              pickLang(id);
              setNewLang({ name: "", native: "" });
              setShowNewLang(false);
            }
          }}
        >
          <input className={`${field} flex-1`} placeholder="Name, e.g. Japanese" value={newLang.name} onChange={(e) => setNewLang({ ...newLang, name: e.target.value })} />
          <input className={`${field} flex-1`} placeholder="Native, e.g. 日本語" value={newLang.native} onChange={(e) => setNewLang({ ...newLang, native: e.target.value })} />
          <button className={btnGhost} disabled={busy || !newLang.name.trim()}>Add</button>
        </form>
      )}

      {/* timer */}
      <section className={`${border} rounded-md p-4 grid gap-3 bg-[rgba(255,255,255,0.25)]`}>
        <div className="grid gap-2 sm:grid-cols-[1fr_160px]">
          <input
            className={field}
            placeholder="What are you doing? e.g. 나 혼자 산다 ep 3"
            value={title}
            maxLength={200}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => active && title !== active.title && act({ op: "updateActive", title })}
          />
          <input
            className={field}
            placeholder="Source, e.g. YouTube"
            value={source}
            maxLength={60}
            onChange={(e) => setSource(e.target.value)}
            onBlur={() => active && source !== active.source && act({ op: "updateActive", source })}
          />
        </div>
        <KindPicker
          value={kind}
          onChange={(k) => {
            setKind(k);
            if (active) act({ op: "updateActive", kind: k });
          }}
        />
        <div className="flex items-center gap-3 flex-wrap">
          {active ? (
            <>
              <span className="flex items-center gap-2 font-mono text-2xl tabular-nums">
                {!active.pausedAt && <span className="live-dot" />}
                {clock(elapsed)}
              </span>
              <span className="flex-1" />
              {active.pausedAt ? (
                <button className={btnGhost} disabled={busy} onClick={() => act({ op: "resume" })}>Resume</button>
              ) : (
                <button className={btnGhost} disabled={busy} onClick={() => act({ op: "pause" })}>Pause</button>
              )}
              <button className={btnRed} disabled={busy} onClick={async () => { if (await act({ op: "stop" })) { setTitle(""); setSource(""); } }}>
                Stop and save
              </button>
            </>
          ) : (
            <>
              <button className={btnRed} disabled={busy} onClick={() => act({ op: "start", lang: language.id, kind, title, source })}>
                Start timer
              </button>
              <button type="button" className="text-sm link-accent" onClick={() => { setShowAdd((v) => !v); setAddDay(todayKey); }}>
                add past session
              </button>
            </>
          )}
        </div>
        {active && (
          <p className="text-xs ink-muted">
            Started {timeOfDay(active.start, tz)}
            {active.pausedAt ? " · paused" : ""}
            {active.pausedMs ? ` · paused ${formatDuration(active.pausedMs, true)} so far` : ""}.{" "}
            <button type="button" className="underline" disabled={busy} onClick={() => act({ op: "discard" })}>discard</button>
          </p>
        )}
        {showAdd && !active && (
          <form
            className="grid gap-2 sm:grid-cols-[1fr_110px_110px_auto] items-end"
            onSubmit={async (e) => {
              e.preventDefault();
              const ok = await act({ op: "add", lang: language.id, kind, title, source, start: zonedIso(addDay, addTime, tz), minutes: Number(addMin) });
              if (ok) { setAddMin(""); setTitle(""); setSource(""); setShowAdd(false); }
            }}
          >
            <label className="grid gap-1 text-xs ink-muted">Date<input type="date" className={field} value={addDay} onChange={(e) => setAddDay(e.target.value)} /></label>
            <label className="grid gap-1 text-xs ink-muted">Start<input type="time" className={field} value={addTime} onChange={(e) => setAddTime(e.target.value)} /></label>
            <label className="grid gap-1 text-xs ink-muted">Minutes<input type="number" inputMode="numeric" min={1} max={1440} className={field} value={addMin} onChange={(e) => setAddMin(e.target.value)} /></label>
            <button className={btnGhost} disabled={busy || !addMin || !addDay}>Add</button>
          </form>
        )}
        {error && <p className="text-sm text-[var(--accent)]">{error}</p>}
      </section>

      {/* summary + words */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div><p className="text-2xl font-semibold tabular-nums text-[var(--accent)]">{formatHours(stats.totalMs)}</p><p className="text-xs ink-muted">hours total</p></div>
        <div><p className="text-2xl font-semibold tabular-nums">{formatDuration(stats.todayMs)}</p><p className="text-xs ink-muted">today</p></div>
        <div><p className="text-2xl font-semibold tabular-nums">{stats.streak}</p><p className="text-xs ink-muted">day streak</p></div>
        <form
          className="grid gap-1"
          onSubmit={(e) => { e.preventDefault(); act({ op: "setWords", lang: language.id, words: Number(words) }); }}
        >
          <div className="flex gap-1">
            <input type="number" inputMode="numeric" min={0} className={`${field} py-1 text-lg font-semibold`} value={words} onChange={(e) => setWords(e.target.value)} aria-label="Words learned" />
            {String(language.words) !== words && <button className="text-sm link-accent px-1" disabled={busy}>save</button>}
          </div>
          <p className="text-xs ink-muted">words learned</p>
        </form>
      </section>

      {/* entries */}
      <section className="grid gap-5">
        {groups.length === 0 && <p className="ink-muted">No sessions yet. Start the timer when you put something on.</p>}
        {groups.map((g) => (
          <div key={g.day}>
            <div className="flex items-baseline justify-between">
              <p className="font-semibold">
                {new Date(`${g.day}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" })}
              </p>
              <p className="text-sm ink-muted tabular-nums">{formatDuration(g.ms)}</p>
            </div>
            <ul className={`mt-2 ${border} rounded-md divide-y divide-[rgba(18,18,18,0.1)]`}>
              {g.items.map((s) =>
                editing === s.id ? (
                  <EditRow key={s.id} s={s} tz={tz} busy={busy} onCancel={() => setEditing(null)} onSave={async (b) => { if (await act({ op: "edit", id: s.id, ...b })) setEditing(null); }} />
                ) : (
                  <li key={s.id} className="p-3 flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="break-words">{s.title || kindInfo(s.kind).label}</p>
                      <p className="text-sm ink-muted flex flex-wrap items-center gap-x-2 gap-y-1 mt-0.5">
                        <span className="font-mono text-[var(--ink)]">{formatDuration(sessionMs(s), true)}</span>
                        <span className="tabular-nums">{timeOfDay(s.start, tz)} – {timeOfDay(s.end, tz)}</span>
                        {s.pausedMs > 0 && <span>paused {formatDuration(s.pausedMs, true)}</span>}
                        <Tag text={kindInfo(s.kind).label} color={kindInfo(s.kind).color} />
                        {s.source && <Tag text={s.source} color="var(--muted)" />}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 text-sm shrink-0">
                      <button
                        type="button"
                        title="Start again"
                        disabled={busy || Boolean(active)}
                        className="px-2 py-1 ink-muted hover:text-[var(--ink)] disabled:opacity-30"
                        onClick={async () => {
                          setTitle(s.title); setSource(s.source); setKind(s.kind);
                          await act({ op: "start", lang: s.lang, kind: s.kind, title: s.title, source: s.source });
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }}
                      >
                        ▶
                      </button>
                      <button type="button" className="px-2 py-1 ink-muted hover:text-[var(--ink)]" onClick={() => setEditing(s.id)}>edit</button>
                      {confirmDel === s.id ? (
                        <button type="button" className="px-2 py-1 rounded bg-[var(--accent)] text-[var(--paper)]" disabled={busy} onClick={async () => { await act({ op: "delete", id: s.id }); setConfirmDel(null); }}>
                          delete?
                        </button>
                      ) : (
                        <button type="button" className="px-2 py-1 ink-muted hover:text-[var(--accent)]" onClick={() => { setConfirmDel(s.id); setTimeout(() => setConfirmDel((c) => (c === s.id ? null : c)), 4000); }}>
                          ✕
                        </button>
                      )}
                    </div>
                  </li>
                ),
              )}
            </ul>
          </div>
        ))}
      </section>
    </div>
  );
}

function EditRow({
  s, tz, busy, onCancel, onSave,
}: {
  s: Session; tz: string; busy: boolean; onCancel: () => void;
  onSave: (b: Record<string, unknown>) => void;
}) {
  const [title, setTitle] = useState(s.title);
  const [source, setSource] = useState(s.source);
  const [kind, setKind] = useState<Kind>(s.kind);
  const [day, setDay] = useState(dayKey(s.start, tz));
  const [time, setTime] = useState(timeOfDay(s.start, tz));
  const [min, setMin] = useState(String(Math.max(1, Math.round(sessionMs(s) / 60000))));
  return (
    <li className="p-3 grid gap-2 bg-[rgba(255,255,255,0.35)]">
      <div className="grid gap-2 sm:grid-cols-[1fr_160px]">
        <input className={field} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" />
        <input className={field} value={source} onChange={(e) => setSource(e.target.value)} placeholder="Source" />
      </div>
      <KindPicker value={kind} onChange={setKind} />
      <div className="grid gap-2 grid-cols-3">
        <input type="date" className={field} value={day} onChange={(e) => setDay(e.target.value)} aria-label="Date" />
        <input type="time" className={field} value={time} onChange={(e) => setTime(e.target.value)} aria-label="Start time" />
        <input type="number" min={1} className={field} value={min} onChange={(e) => setMin(e.target.value)} aria-label="Minutes" />
      </div>
      <div className="flex gap-2">
        <button className={btnRed} disabled={busy} onClick={() => onSave({ title, source, kind, start: zonedIso(day, time, tz), minutes: Number(min) })}>Save</button>
        <button className={btnGhost} onClick={onCancel}>Cancel</button>
      </div>
    </li>
  );
}
