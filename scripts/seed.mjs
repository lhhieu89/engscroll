// Seed EngScroll content into the local SQLite DB.
// Run with: npm run seed   (uses node --experimental-sqlite)
//
// Idempotent: card ids are derived deterministically from their content, so
// re-running updates in place instead of duplicating. Also builds themed decks
// (Phase 2) by resolving each deck's `match` filter against published cards.

import { DatabaseSync } from "node:sqlite";
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const DATA_DIR = path.join(ROOT, "data");
const DB_PATH = path.join(DATA_DIR, "engscroll.db");

if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(DB_PATH);
db.exec("PRAGMA journal_mode = WAL;");

// Minimal schema (matches src/lib/db.ts) so seeding works before the app boots.
// `cards.type` has no CHECK so Phase-2 'video' cards seed cleanly.
db.exec(`
  CREATE TABLE IF NOT EXISTS cards (
    id TEXT PRIMARY KEY, type TEXT NOT NULL, level TEXT NOT NULL, topic TEXT,
    content_json TEXT NOT NULL, audio_url TEXT,
    status TEXT NOT NULL DEFAULT 'draft', review_note TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS decks (
    id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT, topic TEXT,
    level TEXT, is_premium INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS deck_cards (
    deck_id TEXT NOT NULL, card_id TEXT NOT NULL, position INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (deck_id, card_id)
  );
`);

function slug(s) {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function primaryText(type, content) {
  switch (type) {
    case "vocab": return content.word;
    case "grammar": return content.say;
    case "quiz": return content.question;
    case "quote": return content.quote;
    case "video": return content.title;
    default: return JSON.stringify(content);
  }
}

// ---- seed cards -----------------------------------------------------------

const cards = JSON.parse(readFileSync(path.join(ROOT, "content", "cards.json"), "utf8"));

const upsertCard = db.prepare(`
  INSERT INTO cards (id, type, level, topic, content_json, audio_url, status)
  VALUES (?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    type=excluded.type, level=excluded.level, topic=excluded.topic,
    content_json=excluded.content_json, status=excluded.status
`);

let published = 0, draft = 0;
for (const card of cards) {
  const id = `${card.type}_${slug(primaryText(card.type, card.content))}`;
  upsertCard.run(
    id, card.type, card.level, card.topic ?? null,
    JSON.stringify(card.content), card.audio_url ?? null, card.status ?? "draft",
  );
  (card.status ?? "draft") === "published" ? published++ : draft++;
}

// ---- seed decks (resolve match filters against published cards) -----------

const decks = JSON.parse(readFileSync(path.join(ROOT, "content", "decks.json"), "utf8"));

const upsertDeck = db.prepare(`
  INSERT INTO decks (id, title, description, topic, level, is_premium)
  VALUES (?, ?, ?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    title=excluded.title, description=excluded.description,
    topic=excluded.topic, level=excluded.level, is_premium=excluded.is_premium
`);
const clearDeckCards = db.prepare("DELETE FROM deck_cards WHERE deck_id = ?");
const addDeckCard = db.prepare(
  "INSERT OR IGNORE INTO deck_cards (deck_id, card_id, position) VALUES (?, ?, ?)",
);

function matches(card, m) {
  if (!m) return true;
  const inList = (val, spec) => Array.isArray(spec) ? spec.includes(val) : spec === val;
  if (m.topic !== undefined && !inList(card.topic, m.topic)) return false;
  if (m.level !== undefined && !inList(card.level, m.level)) return false;
  if (m.type !== undefined && !inList(card.type, m.type)) return false;
  return true;
}

const publishedCards = db
  .prepare("SELECT id, type, level, topic FROM cards WHERE status='published'")
  .all();

for (const d of decks) {
  upsertDeck.run(d.id, d.title, d.description ?? null, d.topic ?? null, d.level ?? null, d.is_premium ?? 0);
  clearDeckCards.run(d.id);
  let pos = 0;
  for (const c of publishedCards) {
    if (matches(c, d.match)) addDeckCard.run(d.id, c.id, pos++);
  }
}

const total = db.prepare("SELECT COUNT(*) AS n FROM cards").get().n;
const deckCount = db.prepare("SELECT COUNT(*) AS n FROM decks").get().n;
console.log(
  `✅ Seeded ${cards.length} cards (${published} published, ${draft} draft) + ${deckCount} decks. Total cards in DB: ${total}.`,
);
db.close();
