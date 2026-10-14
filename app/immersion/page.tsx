import type { Metadata } from "next";
import { Radio_Canada } from "next/font/google";
import SiteHeader from "@/components/immersion/SiteHeader";
import { readData } from "@/lib/immersion/store";
import { formatHours, langStats } from "@/lib/immersion/model";

const radio = Radio_Canada({ subsets: ["latin"], weight: ["400", "600"] });

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "immersion",
  description: "Hours of immersion and words learned in each language Anthony is studying.",
};

export default async function ImmersionIndex() {
  const data = await readData();
  const langs = data.languages.map((l) => ({ lang: l, stats: langStats(data, l.id) }));

  return (
    <div className={`${radio.className} max-w-3xl w-full mx-auto px-6`}>
      <div className="w-full paper-surface">
        <div className="min-h-screen py-10">
          <SiteHeader line="languages, one hour at a time" />
          <hr className="rule" />

          <h1 className="text-3xl font-semibold leading-tight ink-title">Immersion</h1>
          <p className="mt-3 max-w-2xl leading-7 ink-muted">
            Time spent watching, listening, reading and speaking in the languages I&apos;m learning, logged as I go.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {langs.map(({ lang, stats }) => {
              const live = data.active?.lang === lang.id;
              return (
                <a
                  key={lang.id}
                  href={`/immersion/${lang.id}`}
                  className="game-card block rounded-md border border-[rgba(18,18,18,0.16)] bg-[rgba(255,255,255,0.18)] p-5"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-xl font-semibold ink-title">{lang.name}</p>
                    <p className="ink-muted">{lang.native}</p>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-3xl font-semibold text-[var(--accent)] tabular-nums">{formatHours(stats.totalMs)}</p>
                      <p className="text-xs ink-muted">hours</p>
                    </div>
                    <div>
                      <p className="text-3xl font-semibold tabular-nums">{lang.words.toLocaleString()}</p>
                      <p className="text-xs ink-muted">words learned</p>
                    </div>
                  </div>
                  <p className="mt-4 text-xs ink-muted flex items-center gap-2">
                    {live ? (
                      <>
                        <span className="live-dot" /> immersing right now
                      </>
                    ) : stats.streak ? (
                      `${stats.streak} day streak`
                    ) : (
                      `${stats.activeDays} active days`
                    )}
                  </p>
                </a>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
