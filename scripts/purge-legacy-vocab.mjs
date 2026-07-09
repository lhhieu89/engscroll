// One-off: make Oxford the SINGLE source of truth for vocabulary.
//
// Removes every hand-made / bank-generated vocab card (anything whose id is not
// an `oxf_*` Oxford import) from the DB, and strips vocab entries out of the
// seed file so a re-seed never reintroduces them. Grammar/quiz/quote/video are
// left untouched — this only touches "từ vựng".
//
//   node scripts/purge-legacy-vocab.mjs

import { DatabaseSync } from "node:sqlite";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const DB_PATH = path.join(ROOT, "data", "engscroll.db");
const CARDS_JSON = path.join(ROOT, "content", "cards.json");

const db = new DatabaseSync(DB_PATH);

// Legacy vocab = vocab cards that did NOT come from the Oxford importer.
const isLegacy = (id) => !id.startsWith("oxf_");
const legacy = db
  .prepare("SELECT id FROM cards WHERE type='vocab'")
  .all()
  .filter((r) => isLegacy(r.id))
  .map((r) => r.id);

const del = db.prepare("DELETE FROM cards WHERE id = ?");
const delDeck = db.prepare("DELETE FROM deck_cards WHERE card_id = ?");
const delSaved = db.prepare("DELETE FROM saved_cards WHERE card_id = ?");
const delReact = db.prepare("DELETE FROM card_reactions WHERE card_id = ?");
db.exec("BEGIN");
for (const id of legacy) {
  delDeck.run(id);
  delSaved.run(id);
  delReact.run(id);
  del.run(id);
}
db.exec("COMMIT");
console.log(`Deleted ${legacy.length} legacy vocab cards from DB (kept oxf_* only).`);

// Strip vocab out of the seed file so seeding can't bring them back.
const cards = JSON.parse(readFileSync(CARDS_JSON, "utf8"));
const kept = cards.filter((c) => c.type !== "vocab");
writeFileSync(CARDS_JSON, JSON.stringify(kept, null, 2) + "\n");
console.log(
  `content/cards.json: removed ${cards.length - kept.length} vocab entries (${kept.length} non-vocab kept).`,
);

const remaining = db.prepare("SELECT count(*) n FROM cards WHERE type='vocab'").get().n;
const oxf = db
  .prepare("SELECT count(*) n FROM cards WHERE type='vocab' AND status='published'")
  .get().n;
console.log(`\nVocab now: ${remaining} total · ${oxf} published — all Oxford.`);
db.close();
