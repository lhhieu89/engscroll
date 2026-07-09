// Seeds EngScroll content from the COMMITTED banks under content/banks/ into
// Postgres. Production-safe: reads only local JSON (no english-app needed).
//
//   npm run seed:banks          (loads .env.local for DATABASE_URL)
//   DATABASE_URL=... node scripts/seed-banks.mjs
//
// Banks are the single source of truth per card type (vocab / grammar /
// expression / quote / video) + quizzes DERIVED deterministically from them.
//
// Idempotent: stable ids + ON CONFLICT update. Preserves example_audio written
// by scripts/generate-example-audio.py. Replaces regenerated types so the banks
// remain the only source.

import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const BANKS = path.join(ROOT, "content", "banks");

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("✖ DATABASE_URL not set. Run via `npm run seed:banks` or pass it inline.");
  process.exit(1);
}
const sql = postgres(DATABASE_URL, { max: 4 });

const CEFR_LEVEL = {
  A1: "basic", A2: "basic",
  B1: "intermediate", B2: "intermediate",
  C1: "advanced", C2: "advanced",
};

function bank(name) {
  const p = path.join(BANKS, name);
  if (!existsSync(p)) {
    console.error(`✖ missing bank: ${p} — run node scripts/build-banks.mjs first`);
    process.exit(1);
  }
  return JSON.parse(readFileSync(p, "utf8"));
}
function optionalBank(name) {
  const p = path.join(BANKS, name);
  return existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : [];
}
function slug(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 56);
}
// Fixed-seed PRNG (mulberry32) so quiz selection/shuffle is DETERMINISTIC —
// re-seeding produces identical quizzes (reproducible, idempotent).
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(0x1234abcd);
function shuffle(a) {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}
function sample(a, n) {
  return shuffle(a).slice(0, n);
}

// Collect all card rows here, then bulk-upsert at the end.
const cardRows = [];
const stats = { vocab: 0, grammar: 0, grammarTip: 0, expression: 0, quiz: 0, quote: 0, video: 0 };
function addCard(id, type, level, topic, contentObj, audioUrl, status) {
  cardRows.push({
    id,
    type,
    level,
    topic: topic ?? null,
    content_json: JSON.stringify(contentObj),
    audio_url: audioUrl ?? null,
    status: status ?? "published",
  });
}

// Preserve generated example audio across re-seeds (vocab + expression).
const priorAudio = new Map();
for (const r of await sql`SELECT id, content_json FROM cards WHERE type IN ('vocab','expression')`) {
  try {
    const c = JSON.parse(r.content_json);
    if (c.example_audio) priorAudio.set(r.id, c.example_audio);
  } catch {}
}

// ---- 1. vocab -------------------------------------------------------------

const vocab = bank("vocab.json");
for (const row of vocab) {
  const content = { ...row.content };
  const carried = priorAudio.get(row.id);
  if (carried) content.example_audio = carried;
  addCard(row.id, "vocab", row.level, row.topic, content, row.audio_url, row.status ?? "published");
  stats.vocab++;
}

// ---- 2. expression (functional chunks + icspeak sentence sets) ------------

const EXPRESSION_BANKS = ["expression.json", "sentences-1000.json", "crazy-400.json", "crazy-365.json"];
const expression = EXPRESSION_BANKS.flatMap(optionalBank);
for (const row of expression) {
  const content = { ...row.content };
  const carried = priorAudio.get(row.id);
  if (carried) content.example_audio = carried;
  addCard(row.id, "expression", row.level, row.topic, content, row.audio_url, row.status ?? "published");
  stats.expression++;
}

// ---- 3. grammar (curated ❌→✅) -------------------------------------------

const grammar = [
  ...bank("grammar.json"),
  ...optionalBank("grammar-extra.json"),
  ...optionalBank("grammar-extra-2.json"),
];
for (const g of grammar) {
  const level = CEFR_LEVEL[g.cefr] || "intermediate";
  addCard(`grm_${slug(g.say)}`, "grammar", level, g.topic ?? "grammar", {
    dont: g.dont,
    say: g.say,
    explain_vi: g.explain_vi,
    cefr: g.cefr || undefined,
    category: g.category || undefined,
    source: "curated",
  }, null, "published");
  stats.grammar++;
}

// EGP "tip" cards (can-do + real examples) — kept apart from the contrast set.
for (const row of optionalBank("grammar-tips.json")) {
  addCard(row.id, "grammar", row.level, row.topic ?? "grammar-tip", row.content, null, row.status ?? "published");
  stats.grammarTip++;
}

// ---- 3b. quote + video (card-ready banks; user-extendable) ----------------

for (const row of optionalBank("quote.json")) {
  addCard(row.id, "quote", row.level, row.topic ?? "quote", row.content, null, row.status ?? "published");
  stats.quote++;
}
for (const row of optionalBank("video.json")) {
  addCard(row.id, "video", row.level, row.topic ?? "video", row.content, null, row.status ?? "draft");
  stats.video++;
}

// ---- 4. quizzes DERIVED from the banks (deterministic, no fabrication) -----

function emitQuiz(idKey, level, topic, content) {
  if (!Array.isArray(content.options) || content.options.length < 2) return;
  const uniq = new Set(content.options.map((o) => String(o).trim().toLowerCase()));
  if (uniq.size !== content.options.length) return;
  if (!Number.isInteger(content.correct) || content.correct < 0 || content.correct >= content.options.length) return;
  addCard(`qz_${idKey}`, "quiz", level, topic, content, null, "published");
  stats.quiz++;
}

// Smarter distractors: same part of speech, preferring the same CEFR level.
const byPos = new Map();
for (const r of vocab) {
  const p = r.content.pos || "other";
  if (!byPos.has(p)) byPos.set(p, []);
  byPos.get(p).push(r);
}
function pickDistractors(row, valueOf, n) {
  const correct = valueOf(row);
  const pos = row.content.pos || "other";
  const pool = byPos.get(pos) || vocab;
  const seen = new Set([correct]);
  const picks = [];
  const drain = (rows) => {
    for (const r of sample(rows, n * 5)) {
      if (picks.length >= n) break;
      const v = valueOf(r);
      if (v && !seen.has(v)) { seen.add(v); picks.push(v); }
    }
  };
  drain(pool.filter((r) => r.content.cefr === row.content.cefr));
  if (picks.length < n) drain(pool);
  if (picks.length < n) drain(vocab);
  return picks.slice(0, n);
}

// (a) vocab meaning-match
for (const row of sample(vocab.filter((r) => r.content.meaning_vi && r.content.word), 500)) {
  const correct = row.content.meaning_vi;
  const options = shuffle([correct, ...pickDistractors(row, (r) => r.content.meaning_vi, 3)]);
  emitQuiz(`vocab_${slug(row.content.word)}`, row.level, "oxford", {
    question: `"${row.content.word}" nghĩa là gì?`,
    options, correct: options.indexOf(correct),
    explain_vi: `"${row.content.word}" = ${correct}.`,
    cefr: row.content.cefr, style: "meaning", source: "derived:vocab",
  });
}

// (b) grammar which-is-correct
for (const g of grammar) {
  const options = shuffle([g.say, g.dont]);
  emitQuiz(`grm_${slug(g.say)}`, CEFR_LEVEL[g.cefr] || "intermediate", "grammar", {
    question: "Câu nào đúng?",
    options, correct: options.indexOf(g.say),
    explain_vi: g.explain_vi, cefr: g.cefr, style: "correct", source: "derived:grammar",
  });
}

// (c) expression usage-match (functional only)
const functional = expression.filter((r) => r.content.category === "functional");
const exprTexts = functional.map((r) => r.content.text).filter(Boolean);
for (const row of sample(functional.filter((r) => r.content.meaning_vi && r.content.text), 200)) {
  const correct = row.content.text;
  const options = shuffle([correct, ...sample(exprTexts.filter((t) => t !== correct), 3)]);
  emitQuiz(`exp_${slug(correct)}`, row.level, "functional", {
    question: `Chọn cụm để nói: “${row.content.meaning_vi}”`,
    options, correct: options.indexOf(correct),
    explain_vi: `“${correct}” = ${row.content.meaning_vi}`,
    cefr: row.content.cefr, style: "usage", source: "derived:expression",
  });
}

// (d) vocab reverse
for (const row of sample(vocab.filter((r) => r.content.meaning_vi && r.content.word), 400)) {
  const correct = row.content.word;
  const options = shuffle([correct, ...pickDistractors(row, (r) => r.content.word, 3)]);
  emitQuiz(`vocabrev_${slug(correct)}`, row.level, "oxford", {
    question: `Từ nào có nghĩa “${row.content.meaning_vi}”?`,
    options, correct: options.indexOf(correct),
    explain_vi: `“${row.content.meaning_vi}” = ${correct}.`,
    cefr: row.content.cefr, style: "reverse", source: "derived:vocab",
  });
}

// (e) vocab cloze
function blankWord(example, word) {
  const re = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
  return re.test(example) ? example.replace(re, "______") : null;
}
const clozeEligible = vocab.filter(
  (r) => r.content.word && r.content.example && blankWord(r.content.example, r.content.word),
);
for (const row of sample(clozeEligible, 400)) {
  const correct = row.content.word;
  const gapped = blankWord(row.content.example, correct);
  const options = shuffle([correct, ...pickDistractors(row, (r) => r.content.word, 3)]);
  emitQuiz(`cloze_${slug(correct)}`, row.level, "oxford", {
    question: `Điền từ vào chỗ trống: “${gapped}”`,
    options, correct: options.indexOf(correct),
    explain_vi: `${correct}: ${row.content.meaning_vi}`,
    cefr: row.content.cefr, style: "cloze", source: "derived:vocab",
  });
}

// (f) sentence meaning
const daily = expression.filter((r) => r.content.category === "daily_sentence" && r.content.meaning_vi);
const dailyMeanings = [...new Set(daily.map((r) => r.content.meaning_vi))];
for (const row of sample(daily, 250)) {
  const correct = row.content.meaning_vi;
  const distractors = sample(dailyMeanings.filter((m) => m !== correct), 3);
  if (distractors.length < 3) continue;
  const options = shuffle([correct, ...distractors]);
  emitQuiz(`sent_${slug(row.content.text)}`, row.level, "sentences-1000", {
    question: `“${row.content.text}” nghĩa là gì?`,
    options, correct: options.indexOf(correct),
    explain_vi: `“${row.content.text}” = ${correct}`,
    style: "sentence", source: "derived:sentence",
  });
}

// ---- write to Postgres ----------------------------------------------------

// Regenerated / single-source types are wiped first (example_audio preserved above).
await sql`DELETE FROM cards WHERE type='quiz'`;
await sql`DELETE FROM cards WHERE type='expression'`;
await sql`DELETE FROM cards WHERE type='grammar' AND id NOT LIKE 'grm_%' AND id NOT LIKE 'grt_%'`;
await sql`DELETE FROM cards WHERE type='quote' AND id NOT LIKE 'qt_%'`;
await sql`DELETE FROM cards WHERE type='video' AND id NOT LIKE 'vid_%'`;

// Dedup by id (quizzes keyed on a word can collide across homographs like the
// noun/verb "run"); keep the first. Postgres rejects duplicate ids in one upsert.
const uniqueCards = [...new Map(cardRows.map((r) => [r.id, r])).values()];

const COLS = ["id", "type", "level", "topic", "content_json", "audio_url", "status"];
const CHUNK = 1000;
for (let i = 0; i < uniqueCards.length; i += CHUNK) {
  const chunk = uniqueCards.slice(i, i + CHUNK);
  await sql`
    INSERT INTO cards ${sql(chunk, ...COLS)}
    ON CONFLICT (id) DO UPDATE SET
      type = excluded.type, level = excluded.level, topic = excluded.topic,
      content_json = excluded.content_json, audio_url = excluded.audio_url, status = excluded.status
  `;
  process.stdout.write(`\r  upserted ${Math.min(i + CHUNK, uniqueCards.length)}/${uniqueCards.length} cards…`);
}
process.stdout.write("\n");

// ---- decks (browsable groupings) ------------------------------------------

const DECKS = [
  { id: "oxford-core", title: "Oxford Core (A1–C2)", desc: "Bộ từ vựng Oxford 3000/5000 chuẩn CEFR — phát âm UK/US, ví dụ.", where: "type='vocab'" },
  { id: "functional-english", title: "Mẫu câu giao tiếp", desc: "Cụm câu chức năng của Cambridge — nêu ý kiến, đồng ý, đề nghị...", where: "type='expression' AND topic='functional'" },
  { id: "sentences-1000", title: "1000 câu tiếng Anh thông dụng", desc: "Câu giao tiếp hằng ngày — có dịch và audio từng câu.", where: "type='expression' AND topic='sentences-1000'" },
  { id: "crazy-english", title: "Crazy English (400 + 365)", desc: "Bộ câu Crazy English — có phiên âm cả câu, dịch và audio.", where: "type='expression' AND topic='crazy-english'" },
  { id: "grammar-fix", title: "Sửa lỗi ngữ pháp", desc: "Lỗi người Việt hay sai và cách nói chuẩn.", where: "type='grammar' AND topic<>'grammar-tip'" },
  { id: "grammar-tips", title: "Mẹo ngữ pháp (EGP)", desc: "Điểm ngữ pháp CEFR A1–C2 của Cambridge — kèm ví dụ thật.", where: "type='grammar' AND topic='grammar-tip'" },
  { id: "quotes", title: "Trích dẫn hay", desc: "Danh ngôn truyền cảm hứng — có dịch và tác giả.", where: "type='quote'" },
];
for (const d of DECKS) {
  await sql`
    INSERT INTO decks (id, title, description, topic, level, is_premium)
    VALUES (${d.id}, ${d.title}, ${d.desc}, null, null, 0)
    ON CONFLICT (id) DO UPDATE SET title = excluded.title, description = excluded.description`;
  await sql`DELETE FROM deck_cards WHERE deck_id = ${d.id}`;
  // `where` clauses are static, author-controlled fragments (no user input).
  const ids = await sql.unsafe(`SELECT id FROM cards WHERE ${d.where} AND status='published'`);
  const dcRows = ids.map((r, i) => ({ deck_id: d.id, card_id: r.id, position: i }));
  for (let i = 0; i < dcRows.length; i += CHUNK) {
    await sql`INSERT INTO deck_cards ${sql(dcRows.slice(i, i + CHUNK), "deck_id", "card_id", "position")} ON CONFLICT DO NOTHING`;
  }
}

console.log("✅ seeded from banks:");
console.log(`   vocab ${stats.vocab} · grammar ${stats.grammar} (+${stats.grammarTip} tips) · expression ${stats.expression} · quiz ${stats.quiz} · quote ${stats.quote} · video ${stats.video}`);
console.log(`   preserved example_audio: ${priorAudio.size}`);
const byType = await sql`SELECT type, count(*)::int AS n FROM cards WHERE status='published' GROUP BY type`;
console.log(`   published now: ${JSON.stringify(byType.map((r) => ({ type: r.type, n: r.n })))}`);
await sql.end();
