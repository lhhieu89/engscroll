import { sql } from "drizzle-orm";
import { db, q, q1 } from "./db";
import type { CardContent, CardType, Level } from "./types";

export interface DeckMeta {
  id: string;
  title: string;
  description: string | null;
  topic: string | null;
  level: Level | null;
  is_premium: boolean;
  card_count: number;
}

export interface DeckCard {
  id: string;
  type: CardType;
  level: Level;
  content: CardContent;
  audio_url: string | null;
}

export async function listDecks(): Promise<DeckMeta[]> {
  const rows = await q(sql`
    SELECT d.*, (SELECT COUNT(*)::int FROM deck_cards dc
                  JOIN cards c ON c.id = dc.card_id AND c.status='published'
                  WHERE dc.deck_id = d.id) AS card_count
     FROM decks d ORDER BY d.is_premium ASC, d.created_at ASC`);
  return rows.map(toMeta);
}

export async function getDeckMeta(id: string): Promise<DeckMeta | null> {
  const row = await q1(sql`
    SELECT d.*, (SELECT COUNT(*)::int FROM deck_cards dc
                  JOIN cards c ON c.id = dc.card_id AND c.status='published'
                  WHERE dc.deck_id = d.id) AS card_count
     FROM decks d WHERE d.id = ${id}`);
  return row ? toMeta(row) : null;
}

export async function getDeckCards(id: string): Promise<DeckCard[]> {
  const rows = await q(sql`
    SELECT c.id, c.type, c.level, c.content_json, c.audio_url
     FROM deck_cards dc
     JOIN cards c ON c.id = dc.card_id AND c.status='published'
     WHERE dc.deck_id = ${id}
     ORDER BY dc.position ASC`);
  return rows.map((r) => ({
    id: String(r.id),
    type: r.type as CardType,
    level: r.level as Level,
    content: JSON.parse(String(r.content_json)),
    audio_url: (r.audio_url as string) ?? null,
  }));
}

export async function isPremiumUser(uid: string | null): Promise<boolean> {
  if (!uid) return false;
  const row = await q1<{ is_premium: number }>(
    sql`SELECT is_premium FROM users WHERE id = ${uid}`,
  );
  return Number(row?.is_premium) === 1;
}

// Demo-only entitlement grant (real product: gate behind payment).
export async function grantPremium(uid: string) {
  await db.execute(sql`UPDATE users SET is_premium = 1 WHERE id = ${uid}`);
}

function toMeta(r: Record<string, unknown>): DeckMeta {
  return {
    id: String(r.id),
    title: String(r.title),
    description: (r.description as string) ?? null,
    topic: (r.topic as string) ?? null,
    level: (r.level as Level) ?? null,
    is_premium: Number(r.is_premium) === 1,
    card_count: Number(r.card_count) || 0,
  };
}
