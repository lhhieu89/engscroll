// Extracts the icspeak sentence sets (1000 common phrases + Crazy English 400 &
// 365) from the committed Postgres dump and writes them as EngScroll expression
// banks — with text, Vietnamese translation, whole-sentence phonetics
// (pronounce) and the real per-sentence audio (copied into public/).
//
//   node scripts/build-icspeak-banks.mjs
//   node scripts/build-icspeak-banks.mjs --icspeak=../icspeak
//
// Data model (Rails/Prisma): topics → topic_lessons → details(content,
// pronounce, audio) + detail_translations(content, language=1 → vi).
//
// Output (committed, card-ready expression rows):
//   content/banks/sentences-1000.json   (category "daily_sentence")
//   content/banks/crazy-400.json        (category "crazy_english")
//   content/banks/crazy-365.json        (category "crazy_english")
// Referenced MP3s are copied to public/audio/icspeak/ and the audio path is
// rewritten to /audio/icspeak/<file>.

import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const BANKS = path.join(ROOT, "content", "banks");
const AUDIO_OUT = path.join(ROOT, "public", "audio", "icspeak");

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? true];
  }),
);
const ICSPEAK = args.icspeak ? path.resolve(ROOT, args.icspeak) : path.join(ROOT, "..", "icspeak");
const DUMP = path.join(ICSPEAK, "icspeak_postgres.sql.gz");
const ICSPEAK_PUBLIC = path.join(ICSPEAK, "public");

// Target topics → bank filename + category + level.
const TARGETS = {
  5: { file: "sentences-1000.json", category: "daily_sentence", level: "basic", topic: "sentences-1000" },
  1: { file: "crazy-400.json", category: "crazy_english", level: "intermediate", topic: "crazy-english" },
  2: { file: "crazy-365.json", category: "crazy_english", level: "intermediate", topic: "crazy-english" },
};

// ---- pg COPY (TSV) parsing -------------------------------------------------

function unescape(v) {
  if (v === "\\N") return null;
  return v
    .replace(/\\t/g, "\t")
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\\\/g, "\\");
}

// Pull one `COPY public.<table> (cols...) FROM stdin;` block into array of objs.
function parseCopy(sql, table) {
  const start = sql.indexOf(`COPY public.${table} (`);
  if (start < 0) return [];
  const header = sql.slice(start, sql.indexOf("\n", start));
  const cols = header.slice(header.indexOf("(") + 1, header.indexOf(")")).split(",").map((c) => c.trim());
  const bodyStart = sql.indexOf("\n", start) + 1;
  const bodyEnd = sql.indexOf("\n\\.\n", bodyStart);
  const body = sql.slice(bodyStart, bodyEnd);
  const rows = [];
  for (const line of body.split("\n")) {
    if (!line) continue;
    const parts = line.split("\t");
    const o = {};
    cols.forEach((c, i) => (o[c] = unescape(parts[i])));
    rows.push(o);
  }
  return rows;
}

function slug(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}
function writeBank(name, rows) {
  if (!existsSync(BANKS)) mkdirSync(BANKS, { recursive: true });
  writeFileSync(path.join(BANKS, name), JSON.stringify(rows, null, 0) + "\n");
  console.log(`  → content/banks/${name}: ${rows.length} rows`);
}

// A header row like "Lesson 40: Fear" / "Lesson 1" is not a sentence.
function isHeader(content) {
  return /^lesson\s*\d+/i.test(content.trim());
}

// ---- run -------------------------------------------------------------------

if (!existsSync(DUMP)) {
  console.error(`✖ dump not found: ${DUMP} — pass --icspeak=<path>`);
  process.exit(1);
}
console.log(`Reading ${DUMP}`);
const sql = gunzipSync(readFileSync(DUMP)).toString("utf8");

const topicLessons = parseCopy(sql, "topic_lessons");
const details = parseCopy(sql, "details");
const detailTranslations = parseCopy(sql, "detail_translations");
console.log(`  parsed: topic_lessons=${topicLessons.length} details=${details.length} translations=${detailTranslations.length}`);

// detailId → Vietnamese translation (language = 1).
const viByDetail = new Map();
for (const t of detailTranslations) {
  if (t.language === "1" && t.content) viByDetail.set(t.detail_id, t.content);
}

// lessonId → topicId
const topicByLesson = new Map(topicLessons.map((l) => [l.id, l.topic_id]));

if (!existsSync(AUDIO_OUT)) mkdirSync(AUDIO_OUT, { recursive: true });
let audioCopied = 0, audioMissing = 0;
function importAudio(audioPath) {
  if (!audioPath) return null;
  const rel = audioPath.replace(/^\/+/, ""); // uploads/instantspeak/...
  const srcAbs = path.join(ICSPEAK_PUBLIC, rel);
  const base = path.basename(rel);
  const destAbs = path.join(AUDIO_OUT, base);
  if (existsSync(srcAbs)) {
    if (!existsSync(destAbs)) copyFileSync(srcAbs, destAbs);
    audioCopied++;
    return `/audio/icspeak/${base}`;
  }
  audioMissing++;
  return null;
}

const buckets = { 5: [], 1: [], 2: [] };
const stats = {};
for (const d of details) {
  const topicId = topicByLesson.get(d.topic_lesson_id);
  if (!TARGETS[topicId]) continue;
  // Strip any leading "12. " ordinal the source prefixes onto crazy-english lines.
  const content = (d.content || "").trim().replace(/^\d+\.\s*/, "");
  if (!content || isHeader(content)) continue;
  const cfg = TARGETS[topicId];
  const audio = importAudio(d.audio);
  buckets[topicId].push({
    id: `ics_${cfg.category === "crazy_english" ? "crazy" + (topicId === 1 ? "400" : "365") : "sent1000"}_${d.id}`,
    type: "expression",
    level: cfg.level,
    topic: cfg.topic,
    status: "published",
    audio_url: audio,
    content: {
      text: content,
      meaning_vi: (viByDetail.get(d.id) || "").trim(),
      pronounce: (d.pronounce || "").trim() || undefined,
      audio: audio || undefined,
      category: cfg.category,
      source: "icspeak",
    },
  });
}

for (const [topicId, cfg] of Object.entries(TARGETS)) {
  const rows = buckets[topicId];
  const withVi = rows.filter((r) => r.content.meaning_vi).length;
  const withAudio = rows.filter((r) => r.content.audio).length;
  const withPron = rows.filter((r) => r.content.pronounce).length;
  stats[cfg.file] = { total: rows.length, withVi, withAudio, withPron };
  writeBank(cfg.file, rows);
}

console.log(`\naudio copied=${audioCopied} missing=${audioMissing} → public/audio/icspeak/`);
console.log("coverage:", JSON.stringify(stats, null, 1));
console.log("→ seed with: node scripts/seed-banks.mjs");
