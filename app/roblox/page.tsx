import type { Metadata } from "next";
import { radio } from "@/lib/fonts";
import Navbar from "@/components/Navbar";
import TypeLine from "@/components/TypeLine";

export const metadata: Metadata = {
  title: "Roblox Development",
  description:
    "Roblox systems developer Anthony Bolivar: 135M+ contributed visits across 7 live experiences. Combat, tower defense, simulators, DataStores, monetization, and strict Luau tooling.",
};

// Stats are fetched live from Roblox at request time and cached for 10 minutes,
// so nothing on this page goes stale. FALLBACK holds the last-known values in
// case the API is unreachable.
export const revalidate = 600;

type Game = {
  id: string;
  placeId: number;
  universeId: number;
  name: string;
  genre: string;
  studio: string;
  verified?: boolean;
  role: string;
  note?: string;
  featured?: boolean;
  fallback: { visits: number; playing: number; favorites: number; up: number; down: number };
};

// Ordered by scale. Marble Rail leads as the featured card.
const GAMES: Game[] = [
  {
    id: "marble-rail",
    placeId: 12876963758,
    universeId: 4506887869,
    name: "Marble Rail",
    genre: "Obby · Runner",
    studio: "Marble Rail",
    role: "Core gameplay systems",
    featured: true,
    fallback: { visits: 117530259, playing: 36, favorites: 3367068, up: 47400, down: 32894 },
  },
  {
    id: "speed-broom",
    placeId: 128252926626455,
    universeId: 9947971638,
    name: "+1 Speed Broom Escape",
    genre: "Incremental Sim",
    studio: "MegaBig Studios",
    verified: true,
    role: "Core gameplay systems",
    fallback: { visits: 9301949, playing: 72, favorites: 530906, up: 14644, down: 1112 },
  },
  {
    id: "crossfire",
    placeId: 90087620888117,
    universeId: 9425187033,
    name: "CROSSFIRE",
    genre: "Shooter · PvP",
    studio: "Final Descent",
    role: "Complete rewrite",
    fallback: { visits: 5408712, playing: 62, favorites: 411811, up: 323, down: 224 },
  },
  {
    id: "create-a-soccer-squad",
    placeId: 103272456843934,
    universeId: 10334563323,
    name: "Create A Soccer Squad",
    genre: "Sports · Collector",
    studio: "its time for the world cup",
    role: "Lead developer",
    note: "lead dev",
    fallback: { visits: 2494948, playing: 2578, favorites: 3986, up: 2088, down: 443 },
  },
  {
    id: "evade-lander",
    placeId: 86289234427984,
    universeId: 10208988072,
    name: "Evade Lander",
    genre: "Survival · 1-v-All",
    studio: "tyfan arts",
    role: "Gameplay systems",
    fallback: { visits: 2247351, playing: 52, favorites: 12045, up: 2996, down: 815 },
  },
  {
    id: "grow-the-hole",
    placeId: 107776899291890,
    universeId: 9527211987,
    name: "Grow The Hole",
    genre: "Simulation",
    studio: "Semid Studio",
    role: "Built the upgrader system",
    fallback: { visits: 1812496, playing: 27, favorites: 23610, up: 20902, down: 713 },
  },
  {
    id: "block-tower-defense",
    placeId: 92388007111402,
    universeId: 9789705873,
    name: "Block Tower Defense",
    genre: "Tower Defense",
    studio: "Tandeas Games",
    role: "Core gameplay systems",
    fallback: { visits: 939524, playing: 52, favorites: 2482, up: 2081, down: 220 },
  },
  {
    id: "jump-wall-for-brainrot",
    placeId: 128555953524657,
    universeId: 10193709159,
    name: "Jump Wall for Brainrot",
    genre: "Simulation · Tycoon",
    studio: "Game Group This",
    role: "Core gameplay systems",
    fallback: { visits: 240161, playing: 17, favorites: 432, up: 79, down: 21 },
  },
  {
    id: "guess-my-needoh",
    placeId: 117097706694420,
    universeId: 10380024294,
    name: "Guess My Needoh",
    genre: "Party · Casual",
    studio: "Miniverse Game Studios",
    role: "Built solo, from scratch",
    note: "solo build",
    fallback: { visits: 165334, playing: 74, favorites: 14193, up: 901, down: 48 },
  },
];

type LiveStat = { visits: number; playing: number; favorites: number; up: number; down: number };

async function fetchLiveStats(): Promise<Map<number, LiveStat>> {
  const ids = GAMES.map((g) => g.universeId).join(",");
  const map = new Map<number, LiveStat>();
  try {
    const [detailsRes, votesRes] = await Promise.all([
      fetch(`https://games.roblox.com/v1/games?universeIds=${ids}`, {
        next: { revalidate: 600 },
      }),
      fetch(`https://games.roblox.com/v1/games/votes?universeIds=${ids}`, {
        next: { revalidate: 600 },
      }),
    ]);
    if (detailsRes.ok) {
      const d = (await detailsRes.json()) as {
        data?: { id: number; visits: number; playing: number; favoritedCount: number }[];
      };
      for (const g of d.data ?? []) {
        map.set(g.id, {
          visits: g.visits,
          playing: g.playing,
          favorites: g.favoritedCount,
          up: 0,
          down: 0,
        });
      }
    }
    if (votesRes.ok) {
      const v = (await votesRes.json()) as {
        data?: { id: number; upVotes: number; downVotes: number }[];
      };
      for (const row of v.data ?? []) {
        const e = map.get(row.id);
        if (e) {
          e.up = row.upVotes;
          e.down = row.downVotes;
        }
      }
    }
  } catch {
    // Fall back to last-known values below.
  }
  return map;
}

function statFor(game: Game, live: Map<number, LiveStat>): LiveStat {
  const l = live.get(game.universeId);
  // Merge: prefer live values, keep fallback for anything the API omitted.
  if (!l) return game.fallback;
  return {
    visits: l.visits || game.fallback.visits,
    playing: typeof l.playing === "number" ? l.playing : game.fallback.playing,
    favorites: l.favorites || game.fallback.favorites,
    up: l.up || game.fallback.up,
    down: l.down || game.fallback.down,
  };
}

function compact(n: number): string {
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    return `${m >= 100 ? m.toFixed(1) : m.toFixed(1)}M`;
  }
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return `${n}`;
}

function likeRatio(up: number, down: number): number | null {
  const total = up + down;
  if (total < 30) return null;
  return Math.round((up / total) * 100);
}

const SYSTEMS = [
  {
    name: "Combat & weapons",
    detail: "gun handling, hit detection, first/third-person feel",
    proof: "CROSSFIRE",
  },
  {
    name: "Tower defense & waves",
    detail: "turret placement, wave scaling, bosses, base upgrades",
    proof: "Block Tower Defense",
  },
  {
    name: "Incremental & sim loops",
    detail: "rebirths, upgraders, treadmill boosts, pets",
    proof: "Speed Broom · Grow The Hole",
  },
  {
    name: "Survival & destruction",
    detail: "1-vs-all rounds, hiding, physics destruction",
    proof: "Evade Lander",
  },
  {
    name: "Round-based multiplayer",
    detail: "matchmaking, turns, guess resolution, win states",
    proof: "Guess My Needoh",
  },
  {
    name: "Data persistence",
    detail: "ProfileStore, session-locked saves, retry logic",
    proof: "every live game",
  },
  {
    name: "Monetization",
    detail: "gamepasses, dev products, single-owner receipt grants",
    proof: "every live game",
  },
  {
    name: "Progression & economy",
    detail: "soft currency, leaderstats, unlocks, boosts",
    proof: "Marble Rail · Speed Broom",
  },
];

const CAPABILITIES = [
  "enemy AI & pathfinding",
  "inventory, hotbar & tools",
  "shop, trading & marketplace UI",
  "quest & reward systems",
  "pet & companion systems",
  "placement & building",
  "rounds, waves & matchmaking",
  "abilities & cooldowns",
  "leaderboards & stats",
  "custom UI controllers",
  "admin & dev tooling",
  "remote routing & networking",
];

const STACK = ["Knit", "ProfileStore", "Replica", "Zap", "RbxUtil", "Rojo", "Wally"];

const UNIFIED_STATS = [
  { value: "483", label: "scripts inventoried" },
  { value: "218", label: "server scripts mapped" },
  { value: "145", label: "client scripts mapped" },
  { value: "117", label: "module scripts mapped" },
  { value: "175", label: "GUI trees preserved" },
  { value: "87", label: "image asset ids cataloged" },
];

const UNIFIED_SYSTEMS = [
  "DataService: session-locked, retrying DataStore persistence",
  "DevProductService: single ProcessReceipt owner with registered grants",
  "RemoteRouter: typed channel router over reliable, unreliable, and function remotes",
  "CheckpointService: stage progression, teleporting, skip-stage purchase flow",
  "BoostService: authoritative timed movement boost state",
  "CurrencyService: soft currency, leaderstats, and player boost attributes",
  "Promise and Signal: strict Luau async primitives",
  "Rojo project: droppable source tree with game-specific config isolated",
];

const PROOF_POINTS = [
  {
    title: "Can rescue messy production code",
    body: "It extracts the load-bearing systems from real production games, inventories the hidden coupling, and turns them into a strict, game-agnostic source tree.",
  },
  {
    title: "Fixes real Roblox failure modes",
    body: "It removes `_G` service state, consolidates competing ProcessReceipt callbacks, and fixes client-created remote races that can silently break networking.",
  },
  {
    title: "Builds for teams, not just demos",
    body: "Each module has typed APIs, lifecycle methods, dependency headers, config injection, and clear human-review flags for per-game security decisions.",
  },
];

const TOOLING = [
  {
    name: "luau2ts",
    type: "compiler & tooling",
    image: "/roblox/luau2ts.png",
    imageAlt: "luau2ts website screenshot",
    summary:
      "A Luau-to-TypeScript compiler: parsing, code generation, AST structure, docs, and a live playground.",
    stack: "TypeScript · Luau syntax · Roblox tooling",
    links: [
      { label: "live", href: "https://luau2ts.com" },
      { label: "github", href: "https://github.com/Luau2TS/luau2ts" },
    ],
    imagePosition: "center",
  },
  {
    name: "lastfm-luau",
    type: "published Luau library",
    image: "/roblox/lastfm-luau.png",
    imageAlt: "lastfm-luau repository screenshot",
    summary:
      "A typed async Last.fm API client for Roblox and Lune: typed method coverage, sessions, examples, and release discipline.",
    stack: "Luau · Roblox · Lune · Wally",
    links: [
      { label: "wally", href: "https://wally.run/package/tonybolivar/lastfm-luau" },
      { label: "github", href: "https://github.com/tonybolivar/lastfm-luau" },
    ],
    imagePosition: "top center",
  },
];

const HIRE_FIT = [
  "Roblox gameplay systems",
  "backend services & persistence",
  "monetization & marketplace flows",
  "typed Luau architecture",
  "Rojo source organization",
  "UI implementation",
  "bug fixing in live codebases",
  "developer tooling",
];

function Pill({ label }: { label: string }) {
  return (
    <span className="rounded border border-[rgba(18,18,18,0.16)] bg-[rgba(255,255,255,0.24)] px-2.5 py-1 text-xs ink-muted">
      {label}
    </span>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-lg font-semibold leading-none ink-title tabular-nums">{value}</span>
      <span className="mt-1 text-[11px] uppercase tracking-[0.12em] ink-muted">{label}</span>
    </div>
  );
}

function VerifiedMark() {
  return (
    <span
      title="Verified studio"
      className="inline-flex h-[15px] w-[15px] items-center justify-center rounded-full bg-[#2b7fff] text-[9px] font-bold text-white"
      aria-label="Verified studio"
    >
      ✓
    </span>
  );
}

function FeaturedGame({ game, stat }: { game: Game; stat: LiveStat }) {
  const href = `https://www.roblox.com/games/${game.placeId}`;
  return (
    <article className="game-card group overflow-hidden rounded-lg border border-[rgba(18,18,18,0.16)] bg-[rgba(255,255,255,0.22)] lg:grid lg:grid-cols-[1.15fr_1fr]">
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="relative block min-h-[220px] overflow-hidden bg-[var(--paper-2)] lg:min-h-full"
        aria-label={`Play ${game.name} on Roblox`}
      >
        <img
          src={`/roblox/${game.id}-banner.png`}
          alt={`${game.name} gameplay`}
          className="game-thumb absolute inset-0 h-full w-full object-cover"
        />
        <span className="absolute left-4 top-4 rounded bg-[var(--accent)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--paper)]">
          Flagship
        </span>
        <img
          src={`/roblox/${game.id}-icon.png`}
          alt=""
          aria-hidden
          className="absolute bottom-4 left-4 h-12 w-12 rounded-md border-2 border-[var(--paper)] object-cover shadow-[0_4px_14px_rgba(0,0,0,0.35)]"
        />
      </a>

      <div className="flex flex-col justify-center p-6 md:p-8">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em]">
          <span style={{ color: "var(--accent)" }}>#1 by visits</span>
          <span className="ink-muted">· flagship</span>
        </div>
        <h3 className="mt-3 text-3xl font-semibold tracking-normal ink-title md:text-4xl">
          {game.name}
        </h3>
        <p className="mt-1 flex items-center gap-1.5 text-sm ink-muted">
          {game.genre} · {game.studio}
          {game.verified ? <VerifiedMark /> : null}
        </p>
        <p className="mt-3 text-sm leading-6 ink-body">
          <span className="font-semibold">My role:</span> {game.role}
        </p>

        <div className="mt-6 flex flex-wrap items-end gap-x-8 gap-y-4">
          <div>
            <div className="text-4xl font-semibold leading-none ink-title tabular-nums md:text-5xl">
              {compact(stat.visits)}
            </div>
            <div className="mt-1.5 text-[11px] uppercase tracking-[0.14em] ink-muted">
              lifetime visits
            </div>
          </div>
          <div className="flex gap-6 pb-1">
            <div className="flex flex-col">
              <span className="flex items-center gap-1.5 text-lg font-semibold leading-none ink-title tabular-nums">
                <span className="live-dot" aria-hidden />
                {stat.playing}
              </span>
              <span className="mt-1 text-[11px] uppercase tracking-[0.12em] ink-muted">playing</span>
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-semibold leading-none ink-title tabular-nums">
                {compact(stat.favorites)}
              </span>
              <span className="mt-1 text-[11px] uppercase tracking-[0.12em] ink-muted">
                favorites
              </span>
            </div>
          </div>
        </div>

        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="mt-6 inline-flex w-fit items-center gap-1.5 rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--paper)] transition-opacity hover:opacity-90"
        >
          play on roblox →
        </a>
      </div>
    </article>
  );
}

function GameCard({ game, stat }: { game: Game; stat: LiveStat }) {
  const ratio = likeRatio(stat.up, stat.down);
  const href = `https://www.roblox.com/games/${game.placeId}`;

  return (
    <article className="game-card group flex flex-col overflow-hidden rounded-lg border border-[rgba(18,18,18,0.16)] bg-[rgba(255,255,255,0.22)]">
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="relative block aspect-square overflow-hidden bg-[var(--paper-2)]"
        aria-label={`Play ${game.name} on Roblox`}
      >
        <img
          src={`/roblox/${game.id}-icon.png`}
          alt={`${game.name} game icon`}
          className="game-thumb h-full w-full object-cover"
        />
        {game.note ? (
          <span className="absolute left-3 top-3 rounded bg-[var(--accent)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--paper)]">
            {game.note}
          </span>
        ) : null}
        {ratio && ratio >= 85 ? (
          <span className="absolute right-3 top-3 rounded bg-[rgba(18,18,18,0.82)] px-2 py-0.5 text-[10px] font-semibold text-white">
            ▲ {ratio}% liked
          </span>
        ) : null}
      </a>

      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] ink-muted">
          <span>{game.genre}</span>
        </div>
        <h3 className="mt-2 text-xl font-semibold tracking-normal ink-title">{game.name}</h3>

        <div className="mt-2 flex items-center gap-1.5 text-sm ink-muted">
          <span>{game.studio}</span>
          {game.verified ? <VerifiedMark /> : null}
        </div>

        <p className="mt-3 text-sm leading-6 ink-body">
          <span className="font-semibold">My role:</span> {game.role}
        </p>

        <div className="mt-auto grid grid-cols-3 gap-3 border-t border-[rgba(18,18,18,0.12)] pt-4">
          <Stat value={compact(stat.visits)} label="visits" />
          <div className="flex flex-col">
            <span className="flex items-center gap-1.5 text-lg font-semibold leading-none ink-title tabular-nums">
              <span className="live-dot" aria-hidden />
              {stat.playing}
            </span>
            <span className="mt-1 text-[11px] uppercase tracking-[0.12em] ink-muted">playing</span>
          </div>
          <Stat value={compact(stat.favorites)} label="favorites" />
        </div>

        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-flex w-fit items-center gap-1 text-sm link-accent"
        >
          play on roblox →
        </a>
      </div>
    </article>
  );
}

function ArchitectureVisual() {
  const sourceRows = [
    { left: "MarbleRail extraction", right: "483 scripts" },
    { left: "inventory + conflicts", right: "_G, remotes, receipts" },
    { left: "strict modules", right: "typed APIs" },
    { left: "Rojo tree", right: "drop-in systems" },
  ];

  const routes = [
    "DataService -> leaderstats + saves",
    "DevProductService -> registered grants",
    "RemoteRouter -> channel events",
    "CheckpointService -> stage flow",
  ];

  return (
    <div className="overflow-hidden rounded-md bg-[#10151f] text-slate-100 shadow-[0_18px_45px_rgba(16,21,31,0.22)]">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#ffbd2e]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
        </div>
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-slate-400">
          unified-src · private
        </span>
      </div>

      <div className="grid gap-px bg-white/10 md:grid-cols-[0.95fr_1.05fr]">
        <div className="bg-[#111827] p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-emerald-300">extraction</p>
          <div className="mt-4 space-y-3">
            {sourceRows.map((row) => (
              <div
                key={row.left}
                className="grid grid-cols-[1fr_auto] gap-3 rounded border border-white/10 bg-white/5 px-3 py-2 font-mono text-xs"
              >
                <span className="text-slate-200">{row.left}</span>
                <span className="text-sky-300">{row.right}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-[#0f172a] p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-sky-300">game-ready modules</p>
          <div className="mt-4 grid gap-3">
            {routes.map((route) => (
              <div
                key={route}
                className="rounded border border-white/10 bg-white/5 px-3 py-2 font-mono text-xs text-slate-200"
              >
                {route}
              </div>
            ))}
          </div>
          <div className="mt-4 rounded border border-emerald-300/30 bg-emerald-300/10 px-3 py-2 font-mono text-xs text-emerald-100">
            config changes only; no logic edits per new game
          </div>
        </div>
      </div>
    </div>
  );
}

function ScoreItem({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-3xl font-semibold leading-none ink-title tabular-nums md:text-4xl">
        {value}
      </span>
      <span className="mt-2 text-xs uppercase tracking-[0.16em] ink-muted">{label}</span>
    </div>
  );
}

export default async function RobloxPage() {
  const live = await fetchLiveStats();
  const stats = GAMES.map((g) => ({ game: g, stat: statFor(g, live) }));

  const totalVisits = stats.reduce((s, { stat }) => s + stat.visits, 0);
  const totalPlaying = stats.reduce((s, { stat }) => s + stat.playing, 0);
  const visitsHeadline = `${Math.floor(totalVisits / 1_000_000)}M+`;

  const featured = stats[0];
  const rest = stats.slice(1);

  const heroTiles = stats.slice(0, 4);

  return (
    <div className={`${radio.className} max-w-6xl w-full mx-auto px-6`}>
      <div className="w-full paper-surface">
        <div className="min-h-screen py-10">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="custom-text-18 ink-title">Anthony Bolivar</p>
              <TypeLine text="Roblox systems, games, tooling" />
              <p className="ink-muted text-sm mt-1">
                <a href="/ABResume.pdf" className="link-accent" target="_blank" rel="noreferrer">
                  resume
                </a>
              </p>
            </div>

            <Navbar />
          </div>

          <hr className="rule" />

          {/* HERO */}
          <section className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            <div>
              <div className="section-title">ROBLOX SYSTEMS DEVELOPER</div>
              <h1 className="text-3xl font-semibold leading-[1.05] tracking-normal ink-title md:text-5xl text-balance">
                I build the gameplay systems behind {visitsHeadline} player visits.
              </h1>
              <p className="mt-4 text-base leading-7 ink-body">
                Senior developer &amp; programmer at{" "}
                <a
                  href="https://www.playverse.cc/"
                  target="_blank"
                  rel="noreferrer"
                  className="link-accent font-semibold"
                >
                  PlayVerse
                </a>
                , with systems work for{" "}
                <a
                  href="https://www.nitegameslab.com/"
                  target="_blank"
                  rel="noreferrer"
                  className="link-accent font-semibold"
                >
                  Nite Games Lab
                </a>
                .
              </p>
              <p className="mt-4 max-w-2xl text-base leading-8 ink-body text-pretty">
                Combat, tower defense, simulators, survival, persistence, and monetization,
                shipped as a contributing developer across{" "}
                <span className="font-semibold">{GAMES.length} live Roblox experiences</span>. Every
                number below links to a game you can play right now.
              </p>

              <div className="mt-6 flex flex-wrap gap-2">
                <Pill label="strict Luau" />
                <Pill label="gameplay systems" />
                <Pill label="ProfileStore" />
                <Pill label="Rojo workflows" />
                <Pill label="monetization" />
              </div>

              <div className="mt-8 flex flex-wrap items-end gap-x-10 gap-y-6 border-t border-[rgba(18,18,18,0.16)] pt-6">
                <ScoreItem value={visitsHeadline} label="contributed visits" />
                <ScoreItem value={`${GAMES.length}`} label="live games" />
                <ScoreItem value={`~${totalPlaying}`} label="playing right now" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {heroTiles.map(({ game }, index) => (
                <a
                  key={game.id}
                  href={`https://www.roblox.com/games/${game.placeId}`}
                  target="_blank"
                  rel="noreferrer"
                  className={`game-card block overflow-hidden rounded-lg border border-[rgba(18,18,18,0.16)] bg-[var(--paper-2)] ${
                    index === 1 ? "translate-y-5" : ""
                  } ${index === 2 ? "-translate-y-5" : ""}`}
                  aria-label={`Play ${game.name}`}
                >
                  <div className="overflow-hidden">
                    <img
                      src={`/roblox/${game.id}-icon.png`}
                      alt={`${game.name} icon`}
                      className="game-thumb aspect-square w-full object-cover"
                    />
                  </div>
                  <p className="truncate px-3 py-2 text-xs ink-muted">{game.name}</p>
                </a>
              ))}
            </div>
          </section>

          {/* LIVE GAMES */}
          <div className="section-title">LIVE GAMES · {visitsHeadline} VISITS</div>
          <div className="grid gap-5">
            <FeaturedGame game={featured.game} stat={featured.stat} />
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {rest.map(({ game, stat }) => (
                <GameCard key={game.id} game={game} stat={stat} />
              ))}
            </div>
          </div>

          {/* SYSTEMS SHOWCASE (moved above the flagship refactor) */}
          <div className="section-title">SYSTEMS I BUILD</div>
          <p className="max-w-2xl text-base leading-8 ink-body text-pretty">
            The same systems, shipped and proven in live games, not demos. Each one names where it
            runs in production.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {SYSTEMS.map((system) => (
              <div
                key={system.name}
                className="rounded-md border border-[rgba(18,18,18,0.16)] bg-[rgba(255,255,255,0.2)] p-4"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="text-base font-semibold ink-title">{system.name}</h3>
                  <span className="shrink-0 text-[11px] uppercase tracking-[0.1em] ink-muted">
                    {system.proof}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-6 ink-muted">{system.detail}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            {CAPABILITIES.map((cap) => (
              <Pill key={cap} label={cap} />
            ))}
          </div>

          <div className="mt-7">
            <p className="text-xs uppercase tracking-[0.16em] ink-muted">
              frameworks &amp; libraries
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {STACK.map((s) => (
                <span
                  key={s}
                  className="rounded border border-[rgba(18,18,18,0.22)] bg-[rgba(179,0,0,0.06)] px-2.5 py-1 text-xs font-semibold ink-body"
                >
                  {s}
                </span>
              ))}
            </div>
          </div>

          {/* FLAGSHIP REFACTOR (now below the systems showcase) */}
          <div className="section-title">FLAGSHIP REFACTOR</div>
          <section className="rounded-md border border-[rgba(18,18,18,0.16)] bg-[rgba(255,255,255,0.2)] p-5 md:p-7">
            <div className="grid gap-8 lg:grid-cols-[0.92fr_1.08fr] lg:items-start">
              <div>
                <h2 className="text-2xl font-semibold leading-tight tracking-normal ink-title md:text-4xl">
                  A strict, portable systems library
                </h2>
                <p className="mt-4 text-base leading-8 ink-body text-pretty">
                  A private, game-agnostic Luau library. I extract the load-bearing systems
                  from the games I work on and generalize them into strict, typed, drop-in
                  modules, so a new project starts on a stable foundation instead of from
                  scratch. Every module follows one rigid header and architecture standard and
                  drops into a new game with config changes, not logic edits.
                </p>

                <div className="mt-5 flex flex-wrap gap-2">
                  <Pill label="strict Luau" />
                  <Pill label="Rojo" />
                  <Pill label="DataStores" />
                  <Pill label="remotes" />
                  <Pill label="monetization" />
                  <Pill label="portable services" />
                </div>

                <p className="mt-5 text-sm ink-muted">
                  Private toolkit. Source not published. Walkthroughs available on request.
                </p>
              </div>

              <ArchitectureVisual />
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {UNIFIED_STATS.map((s) => (
                <div
                  key={s.label}
                  className="rounded-md border border-[rgba(18,18,18,0.16)] bg-[rgba(255,255,255,0.2)] p-4"
                >
                  <p className="text-3xl font-semibold leading-none ink-title tabular-nums">
                    {s.value}
                  </p>
                  <p className="mt-2 text-sm leading-5 ink-muted">{s.label}</p>
                </div>
              ))}
            </div>

            <div className="mt-8 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] ink-muted">systems extracted</p>
                <div className="mt-4 grid gap-2">
                  {UNIFIED_SYSTEMS.map((system) => (
                    <div
                      key={system}
                      className="rounded border border-[rgba(18,18,18,0.14)] bg-[rgba(255,255,255,0.22)] px-3 py-2 text-sm leading-6 ink-body"
                    >
                      {system}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs uppercase tracking-[0.2em] ink-muted">why it matters</p>
                <div className="mt-4 grid gap-4">
                  {PROOF_POINTS.map((point) => (
                    <div key={point.title}>
                      <h3 className="text-base font-semibold ink-title">{point.title}</h3>
                      <p className="mt-1 text-sm leading-6 ink-muted">{point.body}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* TOOLING */}
          <div className="section-title">SHIPPED TOOLING</div>
          <div className="grid gap-6 lg:grid-cols-2">
            {TOOLING.map((tool) => (
              <article
                key={tool.name}
                className="game-card overflow-hidden rounded-lg border border-[rgba(18,18,18,0.16)] bg-[rgba(255,255,255,0.18)]"
              >
                <div className="overflow-hidden border-b border-[rgba(18,18,18,0.14)]">
                  <img
                    src={tool.image}
                    alt={tool.imageAlt}
                    className="game-thumb aspect-video w-full object-cover"
                    style={{ objectPosition: tool.imagePosition }}
                  />
                </div>
                <div className="p-5">
                  <p className="text-xs uppercase tracking-[0.2em] ink-muted">{tool.type}</p>
                  <h3 className="mt-2 text-xl font-semibold tracking-normal ink-title">
                    {tool.name}
                  </h3>
                  <p className="mt-2 text-sm leading-6 ink-body">{tool.summary}</p>
                  <p className="mt-4 text-xs uppercase tracking-[0.18em] ink-muted">{tool.stack}</p>
                  <div className="mt-4 flex flex-wrap gap-3 text-sm">
                    {tool.links.map((link) => (
                      <a
                        key={link.href}
                        href={link.href}
                        className="link-accent"
                        target="_blank"
                        rel="noreferrer"
                      >
                        {link.label}
                      </a>
                    ))}
                  </div>
                </div>
              </article>
            ))}
          </div>

          {/* HIRE */}
          <section className="mt-10 grid gap-6 border-y border-[rgba(18,18,18,0.18)] py-8 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] ink-muted">studio fit</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-normal ink-title text-balance">
                Hire me when the game needs systems that survive scale.
              </h2>
              <p className="mt-3 text-sm leading-6 ink-muted text-pretty">
                I am strongest where gameplay, backend state, remotes, monetization, UI, and tooling
                meet. I can own a feature from blank script to production module, or step into an
                existing codebase and make it safer without stalling the team.
              </p>
              <div className="mt-5">
                <p className="text-xs uppercase tracking-[0.16em] ink-muted">discord</p>
                <p className="mt-1 text-base font-semibold ink-title">deathcow</p>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              {HIRE_FIT.map((item) => (
                <div
                  key={item}
                  className="rounded border border-[rgba(18,18,18,0.16)] bg-[rgba(255,255,255,0.18)] px-3 py-2 text-sm ink-body"
                >
                  {item}
                </div>
              ))}
            </div>
          </section>

          <ul className="pt-8 flex flex-row items-center">
            <a
              href="https://github.com/tonybolivar"
              className="pr-5 link-accent"
              target="_blank"
              rel="noreferrer"
            >
              <img src="/github.svg" alt="github" width={26} height={26} />
            </a>

            <a
              href="https://www.linkedin.com/in/anthony-bolivar-22059523b/"
              className="pr-5 link-accent"
              target="_blank"
              rel="noreferrer"
            >
              <img src="/linkedin.svg" alt="linkedin" width={26} height={26} />
            </a>

            <span className="ink-muted text-sm ml-auto">Roblox systems</span>
          </ul>
        </div>
      </div>
    </div>
  );
}
