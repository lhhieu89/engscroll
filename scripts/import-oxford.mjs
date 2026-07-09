// Oxford 3000/5000 vocabulary importer for EngScroll.
//
//   node scripts/import-oxford.mjs
//   node scripts/import-oxford.mjs --status=draft
//   node scripts/import-oxford.mjs --src=../english-app/apps/api/prisma/data
//
// Pulls a REAL, standardised vocabulary set from the sibling `english-app`
// project (which crawled it from the Oxford Learner's Dictionaries): every word
// carries a CEFR level (A1–C2), UK + US IPA, the dictionary's own hosted
// pronunciation audio (real human voices), an English definition, an example
// sentence, and a Vietnamese gloss/example. This is the source of truth for the
// vocab feed — far more trustworthy than hand-typed cards.
//
// Word-pronunciation audio uses Oxford's hosted MP3 URLs directly. The example
// sentence audio is generated separately by scripts/generate-example-audio.py
// (Microsoft Edge neural TTS) — this importer leaves `example_audio` untouched
// and preserves any value a previous audio run already wrote (idempotent).

import { DatabaseSync } from "node:sqlite";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const DB_PATH = path.join(ROOT, "data", "engscroll.db");

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? true];
  }),
);
const STATUS = args.status || "published";
const SRC_DIR = args.src
  ? path.resolve(ROOT, args.src)
  : path.join(ROOT, "..", "english-app", "apps", "api", "prisma", "data");
const TOPIC = "oxford";

// CEFR → EngScroll's 3-band level. A1/A2 → basic, B1/B2 → intermediate,
// C1/C2 → advanced.
const CEFR_LEVEL = {
  A1: "basic", A2: "basic",
  B1: "intermediate", B2: "intermediate",
  C1: "advanced", C2: "advanced",
};

// The Oxford `example` field is often "collocation, Real sentence." — e.g.
// "abandon somebody, The baby had been abandoned by its mother." Strip the
// leading collocation and keep the true sentence (capitalised, multi-word).
// Returns { text, usedTail } so the Vietnamese example can be split identically.
function cleanExample(raw) {
  if (!raw) return { text: "", usedTail: false };
  const parts = raw.split(", ");
  if (parts.length > 1) {
    const tail = parts[parts.length - 1].trim();
    if (/^[A-Z]/.test(tail) && tail.includes(" ")) {
      return { text: tail, usedTail: true };
    }
  }
  return { text: raw.trim(), usedTail: false };
}

// Mirror the en split on the Vietnamese string so the two stay aligned.
function alignVi(rawVi, usedTail) {
  if (!rawVi) return "";
  if (!usedTail) return rawVi.trim();
  const parts = rawVi.split(", ");
  return (parts.length > 1 ? parts[parts.length - 1] : rawVi).trim();
}

function slug(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}

function readJson(name) {
  const p = path.join(SRC_DIR, name);
  if (!existsSync(p)) {
    console.error(`✖ missing data file: ${p}\n  Point --src at english-app's prisma/data dir.`);
    process.exit(1);
  }
  return JSON.parse(readFileSync(p, "utf8"));
}

// ---- load source -----------------------------------------------------------

const cefr = readJson("oxford-cefr.json");
const vi = readJson("oxford-vi.json");
const viWords = vi.words ?? vi;
const viDefs = vi.defs ?? {};
const viExamples = vi.examples ?? {};

console.log(`EngScroll Oxford import — ${cefr.length} source entries · status=${STATUS}`);
console.log(`  src: ${SRC_DIR}`);

// ---- DB --------------------------------------------------------------------

const db = new DatabaseSync(DB_PATH);
db.exec("PRAGMA journal_mode = WAL;");

// Preserve any example_audio a prior Edge-TTS run already wrote, so re-importing
// the word metadata never wipes generated audio links.
const priorAudio = new Map();
for (const r of db.prepare("SELECT id, content_json FROM cards WHERE id LIKE 'oxf\\_%' ESCAPE '\\'").all()) {
  try {
    const c = JSON.parse(r.content_json);
    if (c.example_audio) priorAudio.set(r.id, c.example_audio);
  } catch {}
}

const upsert = db.prepare(`
  INSERT INTO cards (id, type, level, topic, content_json, audio_url, status)
  VALUES (?, 'vocab', ?, ?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    level=excluded.level, topic=excluded.topic,
    content_json=excluded.content_json, audio_url=excluded.audio_url,
    status=excluded.status
`);

// ---- build + insert --------------------------------------------------------

const seen = new Set();
const stats = { in: 0, skipLevel: 0, dup: 0, written: 0, byLevel: {}, byCefr: {} };

db.exec("BEGIN");
for (const e of cefr) {
  stats.in++;
  const level = CEFR_LEVEL[e.cefr];
  if (!level) {
    stats.skipLevel++;
    continue;
  }
  const key = `${e.word.toLowerCase()}|${e.pos ?? ""}`;
  if (seen.has(key)) {
    stats.dup++;
    continue;
  }
  seen.add(key);

  const id = `oxf_${slug(e.word)}_${slug(e.pos || "x")}`;
  const { text: example, usedTail } = cleanExample(e.example);
  const example_vi = alignVi(viExamples[e.example], usedTail);
  const meaning_vi = (viWords[e.word.toLowerCase()] || "").trim() || e.meaning || "";

  const content = {
    word: e.word,
    pos: e.pos || undefined,
    cefr: e.cefr,
    ipa_uk: e.ipa_uk || undefined,
    ipa_us: e.ipa_us || undefined,
    audio_uk: e.audio_uk || undefined,
    audio_us: e.audio_us || undefined,
    meaning_vi,
    meaning_en: e.meaning || undefined,
    example,
    example_vi: example_vi || undefined,
  };
  const carried = priorAudio.get(id);
  if (carried) content.example_audio = carried;

  // The card row's audio_url mirrors the US word audio (feed-level convenience).
  upsert.run(id, level, TOPIC, JSON.stringify(content), e.audio_us || null, STATUS);
  stats.written++;
  stats.byLevel[level] = (stats.byLevel[level] || 0) + 1;
  stats.byCefr[e.cefr] = (stats.byCefr[e.cefr] || 0) + 1;
}
db.exec("COMMIT");

// Register a browsable deck for the imported set (idempotent).
db.prepare(`
  INSERT INTO decks (id, title, description, topic, level, is_premium)
  VALUES ('oxford-core', 'Oxford Core (A1–C2)',
          'Bộ từ vựng Oxford 3000/5000 chuẩn CEFR — có phát âm UK/US, ví dụ & audio.',
          'oxford', NULL, 0)
  ON CONFLICT(id) DO UPDATE SET title=excluded.title, description=excluded.description
`).run();

console.log(`\n✅ ${stats.written} Oxford vocab cards written (status=${STATUS}).`);
console.log(`   by level: ${JSON.stringify(stats.byLevel)}`);
console.log(`   by CEFR:  ${JSON.stringify(stats.byCefr)}`);
console.log(`   seen ${stats.in} · skipped(no-level) ${stats.skipLevel} · dup(word+pos) ${stats.dup}`);
console.log(`   carried-over example_audio: ${priorAudio.size}`);
console.log(`\n→ Next: generate example-sentence audio with`);
console.log(`   python3 scripts/generate-example-audio.py --limit=300`);
db.close();
