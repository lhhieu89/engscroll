// Builds the COMMITTED seed banks under content/banks/ from the sibling
// english-app corpora. Run once (or whenever the upstream data changes); the
// output JSON is committed so production never depends on english-app — it just
// seeds from the files (see scripts/seed-banks.mjs).
//
//   node scripts/build-banks.mjs
//   node scripts/build-banks.mjs --src=../english-app/apps/api/prisma/data
//
// Produces:
//   content/banks/vocab.json      — Oxford 3000/5000, card-ready (CEFR, IPA, UK/US audio)
//   content/banks/expression.json — Cambridge functional language, card-ready
//   content/banks/grammar-egp.json — English Grammar Profile (1239 pts), data backbone
//
// content/banks/grammar.json (the ❌→✅ contrast feed cards) is hand-curated and
// NOT generated here.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const BANKS = path.join(ROOT, "content", "banks");

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? true];
  }),
);
const SRC = args.src
  ? path.resolve(ROOT, args.src)
  : path.join(ROOT, "..", "english-app", "apps", "api", "prisma", "data");

const CEFR_LEVEL = {
  A1: "basic", A2: "basic",
  B1: "intermediate", B2: "intermediate",
  C1: "advanced", C2: "advanced",
};

function readJson(name) {
  const p = path.join(SRC, name);
  if (!existsSync(p)) {
    console.error(`✖ missing ${p} — point --src at english-app/prisma/data`);
    process.exit(1);
  }
  return JSON.parse(readFileSync(p, "utf8"));
}

function slug(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}

function writeBank(name, rows) {
  if (!existsSync(BANKS)) mkdirSync(BANKS, { recursive: true });
  writeFileSync(path.join(BANKS, name), JSON.stringify(rows, null, 0) + "\n");
  console.log(`  → content/banks/${name}: ${rows.length} rows`);
}

// ---- vocab (Oxford 3000/5000) ---------------------------------------------

function cleanExample(raw) {
  if (!raw) return { text: "", usedTail: false };
  const parts = raw.split(", ");
  if (parts.length > 1) {
    const tail = parts[parts.length - 1].trim();
    if (/^[A-Z]/.test(tail) && tail.includes(" ")) return { text: tail, usedTail: true };
  }
  return { text: raw.trim(), usedTail: false };
}
function alignVi(rawVi, usedTail) {
  if (!rawVi) return "";
  if (!usedTail) return rawVi.trim();
  const parts = rawVi.split(", ");
  return (parts.length > 1 ? parts[parts.length - 1] : rawVi).trim();
}

function buildVocab() {
  const cefr = readJson("oxford-cefr.json");
  const vi = readJson("oxford-vi.json");
  const viWords = vi.words ?? vi;
  const viExamples = vi.examples ?? {};
  const seen = new Set();
  const rows = [];
  for (const e of cefr) {
    const level = CEFR_LEVEL[e.cefr];
    if (!level) continue;
    const key = `${e.word.toLowerCase()}|${e.pos ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const { text: example, usedTail } = cleanExample(e.example);
    const example_vi = alignVi(viExamples[e.example], usedTail);
    const meaning_vi = (viWords[e.word.toLowerCase()] || "").trim() || e.meaning || "";
    rows.push({
      id: `oxf_${slug(e.word)}_${slug(e.pos || "x")}`,
      type: "vocab",
      level,
      topic: "oxford",
      status: "published",
      audio_url: e.audio_us || null,
      content: {
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
      },
    });
  }
  writeBank("vocab.json", rows);
}

// ---- expression (Cambridge functional language) ---------------------------

// The upstream Cambridge functional set skews toward academic-WRITING
// scaffolds ("X differs from Y…", "(1)… (2)…") that read poorly as standalone
// conversational cards. Keep only clean spoken chunks: no X/Y/…/(1) placeholders
// in the phrase or its example, a concrete example sentence, and a short phrase.
function usableChunk(text, example) {
  const placeholder = (t) => /…|\.\.\.|\bX\b|\bY\b|\(\d\)|\betc\b/.test(t || "");
  if (!text || placeholder(text) || text.length > 45) return false;
  if (!example || placeholder(example) || example.length < 6) return false;
  return true;
}

function buildExpression() {
  const fnData = readJson("functional.json");
  const vi = readJson("functional-vi.json");
  const exVi = vi.examples ?? {};
  const seen = new Set();
  const rows = [];
  for (const f of fnData) {
    if (!usableChunk(f.chunk, f.example)) continue;
    if (!(f.chunkVi || "").trim()) continue;
    const level = CEFR_LEVEL[f.band] || "intermediate";
    const key = slug(f.chunk);
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({
      id: `exp_functional_${key}`,
      type: "expression",
      level,
      topic: "functional",
      status: "published",
      audio_url: null,
      content: {
        text: f.chunk,
        meaning_vi: (f.chunkVi || "").trim(),
        example: f.example || "",
        example_vi: (exVi[f.example] || "").trim() || undefined,
        category: "functional",
        cefr: f.band,
        fn: f.fn || undefined,
        register: f.register || undefined,
        source: "cambridge_functional",
      },
    });
  }
  writeBank("expression.json", rows);
}

// ---- grammar backbone (English Grammar Profile) ---------------------------

function buildGrammarEgp() {
  const egp = readJson("egp.json");
  const vi = readJson("egp-vi.json");
  const canDoVi = vi.canDo ?? {};
  const exVi = vi.examples ?? {};
  const rows = egp.map((g) => ({
    number: g.number,
    cefr: g.level,
    level: CEFR_LEVEL[g.level] || "intermediate",
    category: g.category,
    subCategory: g.subCategory || null,
    guideword: g.guideword,
    canDo: g.canDo,
    canDoVi: (canDoVi[g.canDo] || "").trim() || null,
    examples: g.examples || [],
    examplesVi: (g.examples || []).map((ex) => (exVi[ex] || "").trim() || null),
    lexicalRange: g.lexicalRange ?? null,
    source: "egp_cambridge",
  }));
  writeBank("grammar-egp.json", rows);
}

console.log(`Building committed banks from ${SRC}`);
buildVocab();
buildExpression();
buildGrammarEgp();
console.log("✅ banks built. Curated content/banks/grammar.json is left as-is.");
console.log("→ seed with: node scripts/seed-banks.mjs");
