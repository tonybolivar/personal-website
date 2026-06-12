import { Radio_Canada } from "next/font/google";
import Navbar from "@/components/Navbar";
import TypeLine from "@/components/TypeLine";

const radio = Radio_Canada({
  subsets: ["latin"],
  weight: ["400", "600"],
});

const MEDIA_ITEMS = [
  {
    source: "Colgate University",
    category: "Entrepreneurship & Innovation News",
    title:
      "Raider Market Aims to Create a Colgate-Centered Marketplace for Student-Led Businesses",
    href: "https://www.colgate.edu/success-after-colgate/entrepreneurship-and-innovation/entrepreneurship-innovation-news-and-53",
    date: "June 4, 2026",
    byline: "Alana Conolly",
    summary:
      "Coverage of Raider Market, the Colgate student marketplace founded through the TIA Incubator by Thomas Sfikas '28 and Anthony Bolivar '28.",
    detail:
      "The article covers the product, the entrepreneurship program support, and the technical challenge of building one backend for both mobile and web clients.",
  },
];

function ColgateMark() {
  return (
    <div className="flex aspect-video w-full flex-col justify-between rounded-md border border-[#821019] bg-[rgba(130,16,25,0.08)] p-5">
      <div>
        <p className="text-xs uppercase tracking-[0.28em] text-[#821019]">
          Colgate
        </p>
        <p className="mt-2 text-3xl font-semibold tracking-normal text-[#821019]">
          University
        </p>
      </div>

      <div className="h-px w-full bg-[#821019]/30" />

      <p className="text-xs uppercase tracking-[0.2em] text-[#821019]">
        Entrepreneurship & Innovation
      </p>
    </div>
  );
}

export default function MediaPage() {
  return (
    <div className={`${radio.className} max-w-3xl w-full mx-auto px-6`}>
      <div className="w-full paper-surface">
        <div className="min-h-screen py-10">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="custom-text-18 ink-title">Anthony Bolivar</p>
              <TypeLine text="media, press, and mentions" />
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

          <div className="section-title">MEDIA</div>
          <h1 className="text-3xl font-semibold leading-tight tracking-normal ink-title">
            Press and coverage.
          </h1>
          <p className="mt-4 max-w-2xl leading-7 ink-muted">
            A short collection of external articles and mentions. Items link out
            to the original publication.
          </p>

          <div className="mt-8 space-y-6">
            {MEDIA_ITEMS.map((item) => (
              <article
                key={item.href}
                className="grid gap-5 rounded-md border border-[rgba(18,18,18,0.16)] bg-[rgba(255,255,255,0.18)] p-5 md:grid-cols-[0.85fr_1.15fr]"
              >
                <ColgateMark />

                <div>
                  <p className="text-xs uppercase tracking-[0.2em] ink-muted">
                    {item.source} - {item.category}
                  </p>
                  <h2 className="mt-3 text-xl font-semibold tracking-normal ink-title">
                    {item.title}
                  </h2>
                  <p className="mt-2 text-sm ink-muted">
                    By {item.byline} - {item.date}
                  </p>
                  <p className="mt-4 leading-7 ink-body">{item.summary}</p>
                  <p className="mt-3 text-sm leading-6 ink-muted">
                    {item.detail}
                  </p>
                  <a
                    href={item.href}
                    className="link-accent mt-4 inline-block"
                    target="_blank"
                    rel="noreferrer"
                  >
                    read article
                  </a>
                </div>
              </article>
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
