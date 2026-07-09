// Turns the committed English Grammar Profile backbone (grammar-egp.json) into
// card-ready "grammar tip" cards — a can-do statement (in Vietnamese) plus real
// EGP example sentences. Authentic reference content, NO fabricated errors, so
// it complements the curated ❌→✅ contrast cards and keeps the grammar feed rich.
//
//   node scripts/build-grammar-tips.mjs
//
// Self-contained: reads content/banks/grammar-egp.json (no english-app needed).
// Output: content/banks/grammar-tips.json

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BANKS = path.join(__dirname, "..", "content", "banks");

const CEFR_LEVEL = {
  A1: "basic", A2: "basic",
  B1: "intermediate", B2: "intermediate",
  C1: "advanced", C2: "advanced",
};

const egp = JSON.parse(readFileSync(path.join(BANKS, "grammar-egp.json"), "utf8"));

// Guideword like "FORM: COMBINING TWO ADJECTIVES WITH 'AND'" → drop the
// "FORM:"/"USE:" prefix for a cleaner title tag.
function cleanTitle(g) {
  return (g || "").replace(/^(FORM|USE|FORM\/USE)\s*[:\/]\s*/i, "").trim();
}

const rows = [];
for (const g of egp) {
  if (!g.canDoVi || !g.canDoVi.trim()) continue;
  if (!g.examples || !g.examples.length) continue;
  const examples = g.examples.slice(0, 2);
  const examples_vi = (g.examplesVi || []).slice(0, 2);
  rows.push({
    id: `grt_${g.number}`,
    type: "grammar",
    level: CEFR_LEVEL[g.cefr] || "intermediate",
    topic: "grammar-tip",
    status: "published",
    content: {
      kind: "tip",
      title: cleanTitle(g.guideword),
      explain_vi: g.canDoVi.trim(),
      examples,
      examples_vi: examples_vi.map((x) => x || null),
      cefr: g.cefr,
      category: g.category || undefined,
      source: "egp",
    },
  });
}

writeFileSync(path.join(BANKS, "grammar-tips.json"), JSON.stringify(rows, null, 0) + "\n");
console.log(`→ content/banks/grammar-tips.json: ${rows.length} tip cards`);
const byCefr = {};
for (const r of rows) byCefr[r.content.cefr] = (byCefr[r.content.cefr] || 0) + 1;
console.log("  by CEFR:", JSON.stringify(byCefr));
