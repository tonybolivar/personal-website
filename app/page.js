"use client";

import { Radio_Canada } from "next/font/google";
import React from "react";
import Navbar from "@/components/Navbar";
import TypeLine from "@/components/TypeLine";

const radio = Radio_Canada({
  subsets: ["latin"],
  weight: "400",
});

const WORK = [
  {
    text: "Software Engineering Intern (Infrastructure & Automation) at ",
    org: "BMO Financial Group",
    href: "https://www.bmo.com/",
    meta: "Summer 2025 · NYC",
  },
  {
    text: "IT Intern (Software Development) at ",
    org: "Montgomery ISD",
    href: "https://www.misd.org/",
    meta: "Summer 2024 · Texas",
  },
];

const PROJECTS = [
  {
    name: "Shapes & States",
    meta: "real-time multiplayer political map simulator · multi-source Dijkstra's, WebSocket, FastAPI, NumPy, PostgreSQL",
    live: "https://shapes-and-states.vercel.app/",
    github: "https://github.com/tonybolivar/shapes-and-states",
  },
  {
    name: "Raider Marketplace",
    meta: "identity-verified student marketplace · Colgate TIA venture · React, TypeScript, Supabase, RLS",
    live: "https://www.colgatemarket.com/",
    github: "",
  },
  {
    name: "Three Yakuza",
    meta: "browser-native Three.js loaders for Yakuza / Like a Dragon game assets · .gmt/.gmd/.par parsers, WebGL, TypeScript",
    live: "https://three-yakuza-gmt-viewer.vercel.app",
    github: "https://github.com/tonybolivar/three-yakuza",
  },
  {
    name: "Miku vs Teto Battle",
    meta: "rhythm battle game · FNF-inspired PVP with AI powered chat · React, Three.js, Cloudflare Workers, Durable Objects, Workers AI",
    live: "https://cf-ai-miku-teto-battle.tony-e-bolivar.workers.dev/",
    github: "https://github.com/tonybolivar/cf_ai_miku_teto_battle",
  },
];

export default function Home() {
  return (
    <div className={`${radio.className} max-w-2xl w-full mx-auto px-6`}>
      <div className="w-full paper-surface">
        <div className="min-h-screen py-10">
          {/* header */}
          <div className="flex flex-row justify-between items-start gap-6">
            <div>
              <p className="custom-text-18 ink-title">Anthony Bolivar</p>
              <TypeLine text="CS · systems & automation · building things" />
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

          {/* WORK */}
          <div className="section-title">WORK</div>
          {WORK.map((w) => (
            <div key={w.org} className="mb-6">
              <p className="ink-body">
                {w.text}
                <a
                  href={w.href}
                  className="link-accent"
                  target="_blank"
                  rel="noreferrer"
                >
                  {w.org}
                </a>
              </p>
              <p className="ink-muted">{w.meta}</p>
            </div>
          ))}

          <hr className="rule" />

          {/* PROJECTS */}
          <div className="section-title">PROJECTS</div>
          {PROJECTS.map((p) => (
            <div key={p.name} className="mb-5">
              <div className="flex justify-between items-center gap-4">
                <p className="ink-body">{p.name}</p>

                <div className="flex gap-3 text-sm">
                  {p.live ? (
                    <a
                      href={p.live}
                      className="link-accent"
                      target="_blank"
                      rel="noreferrer"
                    >
                      live
                    </a>
                  ) : null}
                  {p.github ? (
                    <a
                      href={p.github}
                      className="link-accent"
                      target="_blank"
                      rel="noreferrer"
                    >
                      github
                    </a>
                  ) : null}
                </div>
              </div>
              <p className="ink-muted">{p.meta}</p>
            </div>
          ))}

          <hr className="rule" />

          {/* footer icons/links */}
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
