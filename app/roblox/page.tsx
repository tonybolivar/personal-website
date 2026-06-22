import { Radio_Canada } from "next/font/google";
import Navbar from "@/components/Navbar";
import TypeLine from "@/components/TypeLine";

const radio = Radio_Canada({
  subsets: ["latin"],
  weight: ["400", "600"],
});

type Project = {
  id: string;
  name: string;
  type: string;
  image: string;
  imageAlt: string;
  video?: string;
  headline: string;
  summary: string;
  systems: string[];
  stack: string;
  links?: Array<{
    label: string;
    href: string;
  }>;
  imagePosition?: string;
};

const ADVANCED_SCRIPTS = [
  "combat systems",
  "melee combat",
  "enemy AI and pathfinding",
  "tower defense / lane combat",
  "tycoon and upgrade systems",
  "inventory, hotbar, and tools",
  "shop, trading, and marketplace UI",
  "DataStore / ProfileStore saves",
  "quest and reward systems",
  "pet / companion systems",
  "placement and building systems",
  "rounds, waves, and matchmaking",
  "abilities and cooldowns",
  "leaderboards and stats",
  "custom UI controllers",
  "admin and dev tooling",
];

const SERVICES = [
  "game systems",
  "UI implementation",
  "bug fixing",
  "Rojo setup",
  "data/persistence",
  "tooling/scripts",
];

const PAYMENT_METHODS = ["Robux", "PayPal"];

const PROJECTS: Project[] = [
  {
    id: "evade-lander",
    name: "Evade Lander",
    type: "live Roblox game - 1.9M+ visits",
    image: "/roblox/evade-lander.png",
    imageAlt: "Evade Lander Roblox game thumbnail",
    headline:
      "Lead developer and scripter on a live Roblox game with 1.9M+ visits.",
    summary:
      "Owned the gameplay systems, round flow, and live operations for a published title at scale, shipping and maintaining features for an active player base.",
    systems: [
      "round flow",
      "gameplay systems",
      "live ops",
      "performance",
      "player data",
    ],
    stack: "Luau, Roblox Studio",
    links: [
      {
        label: "play",
        href: "https://www.roblox.com/games/86289234427984/Evade-Lander",
      },
    ],
  },
  {
    id: "roll-a-needoh",
    name: "Roll a Needoh",
    type: "active Roblox game",
    image: "/roblox/roll-a-needoh.png",
    imageAlt: "Roll a Needoh Roblox gameplay screenshot",
    headline:
      "Tycoon, tower-defense, farming, and collection loops in one Roblox game.",
    summary:
      "Seed rolling, plant growth, lane combat, Needoh drops, platform income, base upgrades, and persistence.",
    systems: [
      "seed rolling",
      "plant growth",
      "lane combat",
      "Needoh drops",
      "platform income",
      "save data",
    ],
    stack: "Rojo, Luau, Roblox Studio",
  },
  {
    id: "foglands",
    name: "Foglands Simulator",
    type: "survival/adventure systems",
    image: "/roblox/foglands-simulator.png",
    imageAlt: "Foglands Simulator Roblox environment screenshot",
    headline:
      "A larger simulator codebase with RPG systems and atmospheric world work.",
    summary:
      "Mining, combat, zombies, recipes, forge sequences, tile exploration, notifications, inventory, achievements, and player data.",
    systems: [
      "ProfileStore",
      "zombie AI",
      "combat",
      "mining",
      "recipes",
      "forge UI",
    ],
    stack: "Script-only Rojo sync, Luau services",
  },
  {
    id: "collect-slimes",
    name: "Collect Slimes!",
    type: "collection simulator",
    image: "/roblox/collect-slimes-poster.jpg",
    video: "/roblox/collect-slimes.mp4",
    imageAlt: "Collect Slimes Roblox gameplay video",
    headline:
      "Prompt-based collection, rarity, inventory, selling, and readable arcade UI.",
    summary:
      "Server-owned slime spawning and collection, tool inventory, rarity metadata, tool scaling, lock states, selling, and auto-convert.",
    systems: [
      "spawn points",
      "hold prompts",
      "custom inventory",
      "rarity UI",
      "selling",
      "auto-convert",
    ],
    stack: "Strict Luau modules, Studio services/controllers",
  },
  {
    id: "luau2ts",
    name: "luau2ts",
    type: "compiler/tooling",
    image: "/roblox/luau2ts.png",
    imageAlt: "luau2ts website screenshot",
    headline: "A Luau-to-TypeScript compiler for Roblox-adjacent tooling.",
    summary:
      "Language tooling work around parsing, code generation, AST structure, docs, and developer ergonomics.",
    systems: ["compiler", "AST", "codegen", "docs", "playground"],
    stack: "TypeScript, Luau syntax, Roblox ecosystem tooling",
    links: [
      { label: "live", href: "https://luau2ts.com" },
      { label: "github", href: "https://github.com/Luau2TS/luau2ts" },
    ],
  },
  {
    id: "lastfm-luau",
    name: "lastfm-luau",
    type: "published Luau library",
    image: "/roblox/lastfm-luau.png",
    imageAlt: "lastfm-luau repository screenshot",
    headline: "A typed async Last.fm API client for Roblox and Lune workflows.",
    summary:
      "Typed method coverage, examples, sessions, package metadata, release discipline, and Roblox-compatible storage patterns.",
    systems: ["API client", "typed methods", "DataStore sessions", "Wally", "CI"],
    stack: "Luau, Roblox, Lune, Wally",
    links: [
      {
        label: "wally",
        href: "https://wally.run/package/tonybolivar/lastfm-luau",
      },
      {
        label: "github",
        href: "https://github.com/tonybolivar/lastfm-luau",
      },
    ],
    imagePosition: "top center",
  },
];

function Capability({ label }: { label: string }) {
  return (
    <span className="border-l-2 border-[var(--accent)] pl-3 text-sm ink-body">
      {label}
    </span>
  );
}

function ProjectPill({ label }: { label: string }) {
  return (
    <span className="rounded border border-[rgba(18,18,18,0.16)] bg-[rgba(255,255,255,0.24)] px-2.5 py-1 text-xs ink-muted">
      {label}
    </span>
  );
}

function MediaPreview({ project }: { project: Project }) {
  const className =
    "aspect-video w-full border-b border-[rgba(18,18,18,0.14)] object-cover";

  if (project.video) {
    return (
      <video
        className={className}
        controls
        muted
        playsInline
        preload="metadata"
        poster={project.image}
        style={{ objectPosition: project.imagePosition ?? "center" }}
      >
        <source src={project.video} type="video/mp4" />
      </video>
    );
  }

  return (
    <img
      src={project.image}
      alt={project.imageAlt}
      className={className}
      style={{ objectPosition: project.imagePosition ?? "center" }}
    />
  );
}

function PricingPanel() {
  return (
    <section className="mt-10 rounded-md border border-[rgba(18,18,18,0.16)] bg-[rgba(255,255,255,0.18)] p-5">
      <div className="grid gap-6 lg:grid-cols-[1fr_0.8fr]">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] ink-muted">
            Pricing
          </p>
          <h2 className="mt-2 text-xl font-semibold tracking-normal ink-title">
            Available for scoped Roblox work.
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 ink-muted">
            Pricing depends on the size of the job, how much of the system I am
            owning, and whether it is a quick fix, a feature, or a full gameplay
            loop. Send the scope and I can quote it before starting.
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            {SERVICES.map((service) => (
              <ProjectPill key={service} label={service} />
            ))}
          </div>
        </div>

        <div className="border-t border-[rgba(18,18,18,0.14)] pt-5 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
          <p className="text-xs uppercase tracking-[0.2em] ink-muted">
            Accepted payment
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
            {PAYMENT_METHODS.map((method) => (
              <div
                key={method}
                className="rounded border border-[rgba(18,18,18,0.16)] bg-[rgba(255,255,255,0.22)] px-3 py-2 ink-body"
              >
                {method}
              </div>
            ))}
          </div>
          <p className="mt-3 text-sm leading-6 ink-muted">
            I can work with either, depending on the project and what is easier
            for the client.
          </p>
        </div>
      </div>
    </section>
  );
}

function ProjectCard({ project }: { project: Project }) {
  return (
    <article
      id={project.id}
      className="scroll-mt-8 overflow-hidden rounded-md border border-[rgba(18,18,18,0.16)] bg-[rgba(255,255,255,0.18)]"
    >
      <MediaPreview project={project} />

      <div className="p-5">
        <p className="text-xs uppercase tracking-[0.2em] ink-muted">
          {project.type}
        </p>
        <h2 className="mt-2 text-xl font-semibold tracking-normal ink-title">
          {project.name}
        </h2>
        <p className="mt-2 text-base leading-7 ink-body">{project.headline}</p>
        <p className="mt-3 text-sm leading-6 ink-muted">{project.summary}</p>

        <div className="mt-4 flex flex-wrap gap-2">
          {project.systems.map((system) => (
            <ProjectPill key={system} label={system} />
          ))}
        </div>

        <p className="mt-4 text-xs uppercase tracking-[0.18em] ink-muted">
          {project.stack}
        </p>

        {project.links?.length ? (
          <div className="mt-4 flex flex-wrap gap-3 text-sm">
            {project.links.map((link) => (
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
        ) : null}
      </div>
    </article>
  );
}

export default function RobloxPage() {
  return (
    <div className={`${radio.className} max-w-6xl w-full mx-auto px-6`}>
      <div className="w-full paper-surface">
        <div className="min-h-screen py-10">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="custom-text-18 ink-title">Anthony Bolivar</p>
              <TypeLine text="Roblox dev portfolio - games, systems, tooling" />
              <p className="ink-muted text-sm mt-1">
                <a
                  href="/resume.pdf"
                  className="link-accent"
                  target="_blank"
                  rel="noreferrer"
                >
                  resume
                </a>
              </p>
            </div>

            <Navbar />
          </div>

          <hr className="rule" />

          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
            <div>
              <div className="section-title">ROBLOX</div>
              <h1 className="text-3xl font-semibold leading-tight tracking-normal ink-title md:text-5xl">
                I build Roblox games end to end.
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-8 ink-muted">
                Playable loops, worlds, combat, economies, persistence, UI,
                Rojo pipelines, Studio workflows, and Luau tooling. I can build
                full systems or jump into advanced scripts for an existing game.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {PROJECTS.slice(0, 3).map((project) => (
                <a
                  key={project.id}
                  href={`#${project.id}`}
                  className="group block"
                  aria-label={`Jump to ${project.name}`}
                >
                  <div className="overflow-hidden rounded-md border border-[rgba(18,18,18,0.16)] bg-[var(--paper-2)]">
                    <img
                      src={project.image}
                      alt={project.imageAlt}
                      className="aspect-video w-full object-cover transition duration-200 group-hover:scale-[1.03]"
                    />
                  </div>
                  <p className="mt-2 text-xs ink-muted">{project.name}</p>
                </a>
              ))}
            </div>
          </div>

          <div className="section-title">ADVANCED SCRIPTS</div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {ADVANCED_SCRIPTS.map((capability) => (
              <Capability key={capability} label={capability} />
            ))}
          </div>

          <PricingPanel />

          <div className="section-title">PROJECTS</div>
          <div className="grid gap-6 lg:grid-cols-2">
            {PROJECTS.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>

          <hr className="rule" />

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

            <span className="ink-muted text-sm ml-auto">:O</span>
          </ul>
        </div>
      </div>
    </div>
  );
}
