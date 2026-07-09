// EngScroll content generator.
//
//   node scripts/generate.mjs --source=bank --type=all
//   node scripts/generate.mjs --source=llm  --type=vocab --count=1000
//   node scripts/generate.mjs --source=llm  --type=all   --count=1000 --batch
//
// Two sources of REAL, usable content:
//   bank : deterministic, offline, from curated content/banks/*.json (no API key).
//   llm  : Claude (claude-opus-4-8) with the 5 standard prompts + structured
//          outputs, generating at scale. `--batch` routes through the Batches
//          API (50% cheaper, best for thousands). Needs ANTHROPIC_API_KEY.
//
// Every generated card is inserted with status='draft' — it must pass human
// review in /admin before it can appear in the feed (Phase-1 rule: no
// auto-publish). Auto-QC rejects malformed cards before they reach the queue.

import { DatabaseSync } from "node:sqlite";
import { readFileSync, existsSync, mkdirSync, appendFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  LEVELS,
  TOPICS,
  LEVEL_MAP,
  REACT_HINTS,
  SPECS,
  toAppContent,
  dedupKey,
} from "./lib/prompts.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const DATA_DIR = path.join(ROOT, "data");
const DB_PATH = path.join(DATA_DIR, "engscroll.db");
const MODEL = "claude-opus-4-8";
// NOTE: vocabulary is NOT generated here — it comes from a single authoritative
// source, the Oxford 3000/5000 import (scripts/import-oxford.mjs). This
// generator only produces grammar/quiz/quote/video cards.
const APP_TYPES = ["quiz", "grammar", "quote", "video"];

// ---- args -----------------------------------------------------------------

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? true];
  }),
);
const SOURCE = args.source || "bank";
const TYPE = args.type || "all";
const COUNT = Number(args.count) || 0; // 0 => bank uses all available
// AI-generated content is ALWAYS draft (Phase-1 rule: no auto-publish; human
// review required). Only the curated offline bank may publish directly.
const STATUS = SOURCE === "llm" ? "draft" : args.status || "draft";
const OUT = args.out || null; // write JSONL instead of DB
const USE_BATCH = Boolean(args.batch);
const LEVEL_FILTER = args.levels ? String(args.levels).split(",") : LEVELS;
const TOPIC_FILTER = args.topics ? String(args.topics).split(",") : TOPICS;
const PER_CALL = Number(args.perCall) || 15;

let wantTypes = TYPE === "all" ? APP_TYPES : String(TYPE).split(",");
// Guard: vocabulary has one source of truth (Oxford import). Never let this
// generator emit vocab, even if explicitly requested.
if (wantTypes.includes("vocab")) {
  console.warn(
    "  ! ignoring type=vocab — vocabulary is imported from Oxford via scripts/import-oxford.mjs, not generated.",
  );
  wantTypes = wantTypes.filter((t) => t !== "vocab");
}

// ---- DB --------------------------------------------------------------------

if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
const db = new DatabaseSync(DB_PATH);
db.exec("PRAGMA journal_mode = WAL;");
db.exec(`CREATE TABLE IF NOT EXISTS cards (
  id TEXT PRIMARY KEY, type TEXT NOT NULL, level TEXT NOT NULL, topic TEXT,
  content_json TEXT NOT NULL, audio_url TEXT,
  status TEXT NOT NULL DEFAULT 'draft', review_note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);`);
const upsert = db.prepare(`
  INSERT INTO cards (id, type, level, topic, content_json, status)
  VALUES (?, ?, ?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    type=excluded.type, level=excluded.level, topic=excluded.topic,
    content_json=excluded.content_json, status=excluded.status
`);

function slug(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48);
}

// Small stable hash (djb2 → base36) to keep generated ids unique + idempotent.
function hash(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

// ---- auto QC ---------------------------------------------------------------

function qcOk(appType, c) {
  const nonEmpty = (x) => typeof x === "string" && x.trim().length > 0;
  if (!c.react_hint || !nonEmpty(c.react_hint.ok_reason) || !nonEmpty(c.react_hint.new_reason))
    return false;
  switch (appType) {
    case "vocab":
      return nonEmpty(c.word) && nonEmpty(c.meaning_vi) && nonEmpty(c.example) && c.example.includes(" ");
    case "grammar":
      return nonEmpty(c.dont) && nonEmpty(c.say) && c.dont.trim() !== c.say.trim() && nonEmpty(c.explain_vi);
    case "quiz": {
      if (!Array.isArray(c.options) || c.options.length < 2 || c.options.length > 4) return false;
      if (!Number.isInteger(c.correct) || c.correct < 0 || c.correct >= c.options.length) return false;
      const uniq = new Set(c.options.map((o) => String(o).trim().toLowerCase()));
      return uniq.size === c.options.length && nonEmpty(c.question) && nonEmpty(c.explain_vi);
    }
    case "quote":
      return nonEmpty(c.quote) && c.quote.length <= 90 && nonEmpty(c.meaning_vi);
    case "video":
      return nonEmpty(c.title) && nonEmpty(c.script_en) && nonEmpty(c.meaning_vi);
    default:
      return false;
  }
}

// ---- sink (dedup + QC + write) ---------------------------------------------

const seen = new Set(
  db.prepare("SELECT id FROM cards").all().map((r) => r.id),
);
const stats = { in: 0, qcFail: 0, dup: 0, written: 0, byType: {} };
if (OUT) writeFileSync(OUT, ""); // truncate

function emit(appType, level, topic, content) {
  stats.in++;
  if (!qcOk(appType, content)) {
    stats.qcFail++;
    return false;
  }
  const key = dedupKey(appType, content);
  const id = `gen_${appType}_${slug(content.word || content.say || content.question || content.quote || content.title)}_${hash(key)}`;
  if (seen.has(key) || seen.has(id)) {
    stats.dup++;
    return false;
  }
  seen.add(key);
  seen.add(id);
  const row = { id, type: appType, level, topic, content, status: STATUS };
  if (OUT) {
    appendFileSync(OUT, JSON.stringify(row) + "\n");
  } else {
    upsert.run(id, appType, level, topic, JSON.stringify(content), STATUS);
  }
  stats.written++;
  stats.byType[appType] = (stats.byType[appType] || 0) + 1;
  return true;
}

// ---- BANK source -----------------------------------------------------------

function bankData(file) {
  return JSON.parse(readFileSync(path.join(ROOT, "content", "banks", file), "utf8"));
}

function generateFromBank() {
  const phrases = bankData("phrases.json");
  const mistakes = bankData("mistakes.json");
  const quotes = bankData("quotes.json");
  const lvl = (x) => LEVEL_MAP[x] || "basic";

  if (wantTypes.includes("vocab"))
    for (const p of phrases)
      emit("vocab", lvl(p.level), p.topic, {
        word: p.p, ipa: p.ipa, meaning_vi: p.vi, example: p.ex,
        example_vi: p.exvi, react_hint: REACT_HINTS.vocab,
      });

  if (wantTypes.includes("grammar"))
    for (const m of mistakes)
      emit("grammar", lvl(m.level), m.topic, {
        dont: m.dont, say: m.say, explain_vi: m.vi, react_hint: REACT_HINTS.grammar,
      });

  if (wantTypes.includes("quote"))
    for (const q of quotes)
      emit("quote", lvl(q.level), q.topic, {
        quote: q.q, meaning_vi: q.vi, context_vi: q.ctx, react_hint: REACT_HINTS.quote,
      });

  if (wantTypes.includes("quiz")) {
    // (a) correct-vs-wrong sentence quizzes from the mistakes bank.
    for (const m of mistakes) {
      const flip = Math.random() < 0.5;
      const options = flip ? [m.say, m.dont] : [m.dont, m.say];
      emit("quiz", lvl(m.level), m.topic, {
        question: "Which is correct?",
        options,
        correct: options.indexOf(m.say),
        explain_vi: m.vi,
        react_hint: REACT_HINTS.quiz,
      });
    }
    // (b) meaning-match quizzes from the phrases bank (distractors from peers).
    for (const p of phrases) {
      const others = phrases.filter((x) => x.vi !== p.vi);
      const distractors = shuffle(others).slice(0, 3).map((x) => x.vi);
      const options = shuffle([p.vi, ...distractors]);
      emit("quiz", lvl(p.level), p.topic, {
        question: `What does "${p.p}" mean?`,
        options,
        correct: options.indexOf(p.vi),
        explain_vi: `"${p.p}" = ${p.vi}.`,
        react_hint: REACT_HINTS.quiz,
      });
    }
  }

  if (wantTypes.includes("video")) {
    // Scripts derived from phrases; src=null until a creator clip is attached.
    for (const p of phrases.slice(0, 12))
      emit("video", lvl(p.level), p.topic, {
        title: p.p, meaning_vi: p.vi, script_en: p.ex, context_vi: p.exvi,
        react_hint: REACT_HINTS.video,
      });
  }
}

function shuffle(a) {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

// ---- LLM source ------------------------------------------------------------

async function generateFromLLM() {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic();
  const target = COUNT || 200;

  // Build the work list: (appType, level, topic) tasks sized to hit `target`.
  const tasks = [];
  for (const appType of wantTypes) {
    const combos = [];
    for (const level of LEVEL_FILTER) for (const topic of TOPIC_FILTER) combos.push({ level, topic });
    const callsNeeded = Math.ceil(target / PER_CALL);
    for (let i = 0; i < callsNeeded; i++) {
      const { level, topic } = combos[i % combos.length];
      tasks.push({ appType, level, topic });
    }
  }

  if (USE_BATCH) {
    await runBatch(client, tasks);
  } else {
    await runSync(client, tasks);
  }
}

function requestParams(appType, level, topic) {
  const spec = SPECS[appType];
  return {
    model: MODEL,
    max_tokens: 8000,
    thinking: { type: "adaptive" },
    output_config: { format: { type: "json_schema", schema: spec.schema } },
    messages: [{ role: "user", content: spec.prompt(PER_CALL, level, topic) }],
  };
}

function ingestBatchText(appType, level, topic, text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return;
  }
  for (const raw of parsed.cards || []) emit(appType, LEVEL_MAP[level] || "basic", topic, toAppContent(appType, raw));
}

async function runSync(client, tasks) {
  const CONCURRENCY = 4;
  let idx = 0;
  async function worker() {
    while (idx < tasks.length) {
      const t = tasks[idx++];
      try {
        const res = await client.messages.create(requestParams(t.appType, t.level, t.topic));
        const text = res.content.filter((b) => b.type === "text").map((b) => b.text).join("");
        ingestBatchText(t.appType, t.level, t.topic, text);
      } catch (e) {
        console.error(`  ! ${t.appType}/${t.level}/${t.topic}: ${e.message}`);
      }
      process.stdout.write(`\r  generated ${stats.written} cards (${idx}/${tasks.length} calls)…`);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  process.stdout.write("\n");
}

async function runBatch(client, tasks) {
  const requests = tasks.map((t, i) => ({
    custom_id: `${t.appType}__${t.level}__${t.topic}__${i}`,
    params: requestParams(t.appType, t.level, t.topic),
  }));
  console.log(`  submitting batch of ${requests.length} requests…`);
  const batch = await client.messages.batches.create({ requests });
  console.log(`  batch ${batch.id} — poll status with: node scripts/generate.mjs --collect=${batch.id}`);
  // Poll to completion (batches can take up to ~1h).
  let cur = batch;
  while (cur.processing_status !== "ended") {
    await new Promise((r) => setTimeout(r, 15000));
    cur = await client.messages.batches.retrieve(batch.id);
    process.stdout.write(`\r  batch ${cur.processing_status} — done ${cur.request_counts.succeeded}/${requests.length}…`);
  }
  process.stdout.write("\n");
  for await (const result of await client.messages.batches.results(batch.id)) {
    if (result.result.type !== "succeeded") continue;
    const [appType, level, topic] = result.custom_id.split("__");
    const text = result.result.message.content.filter((b) => b.type === "text").map((b) => b.text).join("");
    ingestBatchText(appType, level, topic, text);
  }
}

// ---- run -------------------------------------------------------------------

async function main() {
  console.log(`EngScroll generator — source=${SOURCE} type=${TYPE} status=${STATUS}${OUT ? ` out=${OUT}` : ""}`);
  if (SOURCE === "bank") {
    generateFromBank();
    if (COUNT && stats.written < COUNT)
      console.log(`  note: bank holds ${stats.written} unique cards for the requested type(s) — fewer than --count=${COUNT}. Use --source=llm to scale to ${COUNT}/type.`);
  } else if (SOURCE === "llm") {
    await generateFromLLM();
  } else {
    console.error(`Unknown --source=${SOURCE} (use bank|llm)`);
    process.exit(1);
  }

  console.log(
    `\n✅ ${stats.written} cards written (${OUT ? "to " + OUT : "status=" + STATUS + " in DB"}).`,
  );
  console.log(`   by type: ${JSON.stringify(stats.byType)}`);
  console.log(`   seen ${stats.in} candidates · QC-rejected ${stats.qcFail} · duplicates ${stats.dup}`);
  if (STATUS === "draft" && !OUT)
    console.log(`   → review & publish in /admin (no card enters the feed until Approved).`);
  db.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
