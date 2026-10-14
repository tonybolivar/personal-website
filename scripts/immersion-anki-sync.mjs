#!/usr/bin/env node
// Counts the distinct words you've studied in Anki (any card that is no
// longer new) and posts the number to /immersion as "words learned".
//
// Needs Anki open with AnkiConnect, and IMMERSION_SECRET in the environment
// or in .env.local.
//
//   node scripts/immersion-anki-sync.mjs                 # korean, live site
//   node scripts/immersion-anki-sync.mjs --dry           # print, don't post
//   IMMERSION_URL=http://localhost:3000 node scripts/immersion-anki-sync.mjs
//
// LANGS maps a language id on the site to an Anki search and the script
// (Unicode range) a word has to contain to count.

import { readFileSync } from "node:fs";

const LANGS = {
  korean: {
    query: '(deck:"Korean Class" OR deck:"Refold KO1K v2" OR deck:"Korean Lesson 4") -is:new',
    script: /[가-힣]/,
  },
};

const dry = process.argv.includes("--dry");
const only = process.argv.find((a) => !a.startsWith("-") && LANGS[a]);
const siteUrl = (process.env.IMMERSION_URL || "https://www.anthonybolivar.com").replace(/\/$/, "");

function envSecret() {
  if (process.env.IMMERSION_SECRET) return process.env.IMMERSION_SECRET;
  try {
    const line = readFileSync(new URL("../.env.local", import.meta.url), "utf8")
      .split("\n")
      .find((l) => l.startsWith("IMMERSION_SECRET="));
    return line ? line.slice("IMMERSION_SECRET=".length).trim().replace(/^"|"$/g, "") : "";
  } catch {
    return "";
  }
}

async function anki(action, params = {}) {
  const res = await fetch("http://127.0.0.1:8765", {
    method: "POST",
    body: JSON.stringify({ action, version: 6, params }),
  });
  const body = await res.json();
  if (body.error) throw new Error(`AnkiConnect ${action}: ${body.error}`);
  return body.result;
}

const clean = (html) =>
  html.replace(/\[sound:[^\]]*\]/g, "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();

async function countWords({ query, script }) {
  const ids = await anki("findNotes", { query });
  const notes = ids.length ? await anki("notesInfo", { notes: ids }) : [];
  const words = new Set();
  for (const n of notes) {
    const f = n.fields;
    const candidates = [f.Word?.value, f.Back?.value, f.Front?.value].filter(Boolean).map(clean);
    const word = candidates.find((c) => script.test(c));
    if (word) words.add(word);
  }
  return words.size;
}

const secret = envSecret();
if (!dry && !secret) {
  console.error("IMMERSION_SECRET is not set (env or .env.local).");
  process.exit(1);
}

for (const [lang, cfg] of Object.entries(LANGS)) {
  if (only && lang !== only) continue;
  const words = await countWords(cfg);
  if (dry) {
    console.log(`${lang}: ${words} words`);
    continue;
  }
  const res = await fetch(`${siteUrl}/api/immersion/action`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${secret}` },
    body: JSON.stringify({ op: "setWords", lang, words }),
  });
  const body = await res.json().catch(() => ({}));
  console.log(`${lang}: ${words} words -> ${res.status} ${body.ok ? "saved" : body.error || ""}`);
}
