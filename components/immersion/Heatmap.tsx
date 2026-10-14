import { shiftDay, weekdayOf } from "@/lib/immersion/model";

const LEVELS = [
  "rgba(18,18,18,0.07)",
  "rgba(179,0,0,0.22)",
  "rgba(179,0,0,0.45)",
  "rgba(179,0,0,0.7)",
  "#b30000",
];

function level(ms: number) {
  const m = ms / 60000;
  if (m <= 0) return 0;
  if (m < 15) return 1;
  if (m < 45) return 2;
  if (m < 90) return 3;
  return 4;
}

export default function Heatmap({ byDay, today, weeks = 26 }: { byDay: Record<string, number>; today: string; weeks?: number }) {
  const monday = shiftDay(today, -weekdayOf(today));
  const start = shiftDay(monday, -(weeks - 1) * 7);
  const cells = [];
  for (let i = 0; i < weeks * 7; i++) {
    const key = shiftDay(start, i);
    const ms = byDay[key] || 0;
    const future = key > today;
    const mins = Math.round(ms / 60000);
    cells.push(
      <span
        key={key}
        title={future ? undefined : `${key}: ${mins} min`}
        style={{
          aspectRatio: "1",
          borderRadius: 2,
          background: future ? "transparent" : LEVELS[level(ms)],
          outline: key === today ? "1.5px solid var(--ink)" : undefined,
          outlineOffset: 1,
        }}
      />,
    );
  }
  return (
    <div>
      <div
        style={{
          display: "grid",
          gridTemplateRows: "repeat(7, auto)",
          gridTemplateColumns: `repeat(${weeks}, minmax(0, 1fr))`,
          gridAutoFlow: "column",
          gap: 3,
        }}
      >
        {cells}
      </div>
      <div className="flex items-center gap-1 mt-2 text-xs ink-muted">
        <span className="mr-1">less</span>
        {LEVELS.map((c) => (
          <span key={c} style={{ width: 10, height: 10, borderRadius: 2, background: c, display: "inline-block" }} />
        ))}
        <span className="ml-1">90+ min</span>
      </div>
    </div>
  );
}
