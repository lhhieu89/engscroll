import { sql } from "drizzle-orm";
import { db, q } from "./db";
import { cardTitle } from "./card-preview";
import type { FeedCard, Reaction } from "./types";

export type ActivityKind = "reaction" | "save" | "quiz";

export interface ActivityItem {
  kind: ActivityKind;
  cardId: string;
  cardType: string;
  preview: string;
  created_at: string; // UTC "YYYY-MM-DD HH:MM:SS"
  reaction?: "ok" | "new";
  is_correct?: boolean;
  selected?: string;
  // Full feed payload so the row can expand into the exact card the feed shows.
  card: FeedCard;
}

function preview(json: string): string {
  try {
    return cardTitle(JSON.parse(json));
  } catch {
    return "";
  }
}

// A unified activity timeline built from the STATEFUL action tables (reactions,
// saves, quiz answers) — so it reflects the user's current actions, exactly like
// Facebook's Activity Log shows your current likes/saves.
export async function getActivity(uid: string, limit = 300): Promise<ActivityItem[]> {
  type Draft = Omit<ActivityItem, "card">;
  const items: Draft[] = [];

  const reactions = await q(sql`
    SELECT r.card_id, r.reaction, r.created_at, c.type, c.content_json
     FROM card_reactions r JOIN cards c ON c.id = r.card_id
     WHERE r.user_id = ${uid}`);
  for (const r of reactions)
    items.push({
      kind: "reaction",
      cardId: String(r.card_id),
      cardType: String(r.type),
      preview: preview(String(r.content_json)),
      created_at: String(r.created_at),
      reaction: r.reaction as "ok" | "new",
    });

  const saves = await q(sql`
    SELECT s.card_id, s.created_at, c.type, c.content_json
     FROM saved_cards s JOIN cards c ON c.id = s.card_id
     WHERE s.user_id = ${uid}`);
  for (const s of saves)
    items.push({
      kind: "save",
      cardId: String(s.card_id),
      cardType: String(s.type),
      preview: preview(String(s.content_json)),
      created_at: String(s.created_at),
    });

  const quizzes = await q(sql`
    SELECT q.card_id, q.selected_option, q.is_correct, q.created_at, c.type, c.content_json
     FROM quiz_answers q JOIN cards c ON c.id = q.card_id
     WHERE q.user_id = ${uid}`);
  for (const qz of quizzes) {
    let selected: string | undefined;
    try {
      const c = JSON.parse(String(qz.content_json));
      selected = c.options?.[Number(qz.selected_option)];
    } catch {
      /* ignore */
    }
    items.push({
      kind: "quiz",
      cardId: String(qz.card_id),
      cardType: String(qz.type),
      preview: preview(String(qz.content_json)),
      created_at: String(qz.created_at),
      is_correct: Number(qz.is_correct) === 1,
      selected,
    });
  }

  items.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  const page = items.slice(0, limit);

  const cards = await feedCardsById(uid, [...new Set(page.map((i) => i.cardId))]);
  return page
    .filter((i) => cards.has(i.cardId))
    .map((i) => ({ ...i, card: cards.get(i.cardId)! }));
}

// Hydrate the full feed payload (with this user's reaction/save/quiz state) for
// a set of card ids, in one query.
async function feedCardsById(
  uid: string,
  ids: string[],
): Promise<Map<string, FeedCard>> {
  if (ids.length === 0) return new Map();
  const rows = await q(sql`
    SELECT c.id, c.type, c.level, c.topic, c.content_json, c.audio_url,
           r.reaction AS reacted,
           CASE WHEN sv.card_id IS NULL THEN 0 ELSE 1 END AS saved,
           qa.selected_option AS sel_option,
           qa.is_correct      AS is_correct
     FROM cards c
     LEFT JOIN card_reactions r  ON r.card_id  = c.id AND r.user_id  = ${uid}
     LEFT JOIN saved_cards    sv ON sv.card_id = c.id AND sv.user_id = ${uid}
     LEFT JOIN quiz_answers   qa ON qa.card_id = c.id AND qa.user_id = ${uid}
     WHERE c.id IN (${sql.join(
       ids.map((i) => sql`${i}`),
       sql`, `,
     )})`);

  return new Map(
    rows.map((r) => [
      String(r.id),
      {
        id: String(r.id),
        type: r.type as FeedCard["type"],
        level: r.level as FeedCard["level"],
        topic: (r.topic as string) ?? null,
        content: JSON.parse(String(r.content_json)),
        audio_url: (r.audio_url as string) ?? null,
        reacted: (r.reacted as Reaction) ?? null,
        saved: Number(r.saved) === 1,
        answered:
          r.sel_option !== null && r.sel_option !== undefined
            ? { selected: Number(r.sel_option), is_correct: Number(r.is_correct) === 1 }
            : null,
      } satisfies FeedCard,
    ]),
  );
}

// Delete ONE activity entry. Facebook-parity: removing a reaction/save/quiz from
// the log removes the underlying action (un-reacts / un-saves / clears the
// answer) — the history IS the action state.
export async function deleteActivity(uid: string, kind: ActivityKind, cardId: string) {
  const table =
    kind === "reaction"
      ? sql`card_reactions`
      : kind === "save"
        ? sql`saved_cards`
        : sql`quiz_answers`;
  await db.execute(
    sql`DELETE FROM ${table} WHERE user_id = ${uid} AND card_id = ${cardId}`,
  );
}

// Clear the entire activity history — removes all reactions, saves and quiz
// answers for the user (like Facebook's "Clear history").
export async function clearActivity(uid: string) {
  await db.execute(sql`DELETE FROM card_reactions WHERE user_id = ${uid}`);
  await db.execute(sql`DELETE FROM saved_cards WHERE user_id = ${uid}`);
  await db.execute(sql`DELETE FROM quiz_answers WHERE user_id = ${uid}`);
}
