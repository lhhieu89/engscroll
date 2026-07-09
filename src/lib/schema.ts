import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  integer,
  serial,
  real,
  index,
  uniqueIndex,
  primaryKey,
} from "drizzle-orm/pg-core";

// Timestamps are stored as TEXT in the SQLite-era "YYYY-MM-DD HH:MM:SS" (UTC)
// format so the app's string handling/sorting stays identical after the move
// to Postgres. These defaults reproduce SQLite's datetime('now') / date('now').
const nowText = sql`to_char((now() AT TIME ZONE 'UTC'), 'YYYY-MM-DD HH24:MI:SS')`;
const todayText = sql`to_char((now() AT TIME ZONE 'UTC'), 'YYYY-MM-DD')`;

// Booleans are kept as integer 0/1 (as in the SQLite schema) to avoid touching
// the app's `=== 1` comparisons.

export const cards = pgTable(
  "cards",
  {
    id: text("id").primaryKey(),
    type: text("type").notNull(),
    level: text("level").notNull(),
    topic: text("topic"),
    contentJson: text("content_json").notNull(),
    audioUrl: text("audio_url"),
    status: text("status").notNull().default("draft"),
    reviewNote: text("review_note"),
    // URL-safe canonical slug of the card's headword/phrase/title. Multiple
    // cards can share a slug (e.g. a word's noun + verb entries) — the SEO
    // landing page at /word/<slug> aggregates them. Backfilled by
    // scripts/backfill-slugs.mjs; NULL for cards with no landing page.
    slug: text("slug"),
    createdAt: text("created_at").notNull().default(nowText),
  },
  (t) => [
    index("idx_cards_status_type").on(t.status, t.type),
    // Landing-page lookups and sitemap enumeration hit (status, type, slug).
    index("idx_cards_seo").on(t.status, t.type, t.slug),
  ],
);

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  level: text("level"),
  streak: integer("streak").notNull().default(0),
  lastActive: text("last_active"),
  email: text("email").unique(),
  passwordHash: text("password_hash"),
  name: text("name"),
  provider: text("provider").notNull().default("anon"),
  isPremium: integer("is_premium").notNull().default(0),
  // 1 = level chosen manually (frozen); 0 = auto (inferred & kept up to date).
  levelLocked: integer("level_locked").notNull().default(0),
  createdAt: text("created_at").notNull().default(nowText),
});

export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    createdAt: text("created_at").notNull().default(nowText),
    expiresAt: text("expires_at").notNull(),
  },
  (t) => [index("idx_sessions_user").on(t.userId)],
);

export const cardReactions = pgTable(
  "card_reactions",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    cardId: text("card_id").notNull(),
    reaction: text("reaction").notNull(),
    createdAt: text("created_at").notNull().default(nowText),
  },
  (t) => [
    uniqueIndex("uq_reactions_user_card").on(t.userId, t.cardId),
    index("idx_reactions_card").on(t.cardId),
  ],
);

export const savedCards = pgTable(
  "saved_cards",
  {
    userId: text("user_id").notNull(),
    cardId: text("card_id").notNull(),
    createdAt: text("created_at").notNull().default(nowText),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.cardId] }),
    index("idx_saved_user").on(t.userId),
  ],
);

export const quizAnswers = pgTable("quiz_answers", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  cardId: text("card_id").notNull(),
  selectedOption: integer("selected_option").notNull(),
  isCorrect: integer("is_correct").notNull(),
  createdAt: text("created_at").notNull().default(nowText),
});

export const cardViews = pgTable(
  "card_views",
  {
    userId: text("user_id").notNull(),
    cardId: text("card_id").notNull(),
    seenCount: integer("seen_count").notNull().default(0),
    lastSeen: text("last_seen").notNull().default(nowText),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.cardId] }),
    index("idx_views_user").on(t.userId),
  ],
);

export const events = pgTable(
  "events",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id"),
    cardId: text("card_id"),
    type: text("type").notNull(),
    metaJson: text("meta_json"),
    createdAt: text("created_at").notNull().default(nowText),
  },
  (t) => [index("idx_events_type").on(t.type)],
);

export const decks = pgTable("decks", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  topic: text("topic"),
  level: text("level"),
  isPremium: integer("is_premium").notNull().default(0),
  createdAt: text("created_at").notNull().default(nowText),
});

export const deckCards = pgTable(
  "deck_cards",
  {
    deckId: text("deck_id").notNull(),
    cardId: text("card_id").notNull(),
    position: integer("position").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.deckId, t.cardId] })],
);

export const reviewState = pgTable(
  "review_state",
  {
    userId: text("user_id").notNull(),
    cardId: text("card_id").notNull(),
    ease: real("ease").notNull().default(2.5),
    intervalDays: integer("interval_days").notNull().default(0),
    reps: integer("reps").notNull().default(0),
    dueDate: text("due_date").notNull().default(todayText),
    lastReviewed: text("last_reviewed"),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.cardId] }),
    index("idx_review_due").on(t.userId, t.dueDate),
  ],
);
