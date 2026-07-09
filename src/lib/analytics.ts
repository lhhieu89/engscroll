import { sql } from "drizzle-orm";
import { db, q, q1 } from "./db";

// Log a raw analytics event. Also maintains the per-user/per-card view counter
// used by the adaptive feed when the event is a "seen".
export async function logEvent(
  uid: string | null,
  cardId: string | null,
  type: string,
  meta?: Record<string, unknown>,
) {
  await db.execute(
    sql`INSERT INTO events (user_id, card_id, type, meta_json) VALUES (${uid}, ${cardId}, ${type}, ${meta ? JSON.stringify(meta) : null})`,
  );

  if (type === "seen" && uid && cardId) {
    await db.execute(sql`
      INSERT INTO card_views (user_id, card_id, seen_count, last_seen)
       VALUES (${uid}, ${cardId}, 1, ${sql`to_char((now() AT TIME ZONE 'UTC'), 'YYYY-MM-DD HH24:MI:SS')`})
       ON CONFLICT (user_id, card_id)
       DO UPDATE SET seen_count = card_views.seen_count + 1, last_seen = excluded.last_seen`);
  }
}

export interface CardStat {
  id: string;
  type: string;
  level: string;
  status: string;
  seen: number;
  ok_rate: number;
  new_rate: number;
  save_rate: number;
  preview: string;
}

// Per-card OK / New / Save rates + seen count (section 8).
export async function cardStats(): Promise<CardStat[]> {
  const rows = await q(sql`
    SELECT c.id, c.type, c.level, c.status, c.content_json,
      (SELECT COUNT(*)::int FROM card_views v WHERE v.card_id = c.id) AS seen,
      (SELECT COUNT(*)::int FROM card_reactions r WHERE r.card_id = c.id AND r.reaction='ok')  AS ok,
      (SELECT COUNT(*)::int FROM card_reactions r WHERE r.card_id = c.id AND r.reaction='new') AS nw,
      (SELECT COUNT(*)::int FROM saved_cards s WHERE s.card_id = c.id) AS sv
    FROM cards c
    ORDER BY seen DESC, c.created_at DESC`);

  return rows.map((r) => {
    const seen = Number(r.seen) || 0;
    const denom = seen || 1;
    return {
      id: String(r.id),
      type: String(r.type),
      level: String(r.level),
      status: String(r.status),
      seen,
      ok_rate: Number(r.ok) / denom,
      new_rate: Number(r.nw) / denom,
      save_rate: Number(r.sv) / denom,
      preview: previewOf(String(r.content_json)),
    };
  });
}

export interface OverviewStat {
  totalPublished: number;
  totalDraft: number;
  totalUsers: number;
  totalReactions: number;
  totalSaves: number;
  avgCardsPerSession: number;
}

// Product-level overview for the analytics dashboard.
export async function overviewStats(): Promise<OverviewStat> {
  const one = async (query: import("drizzle-orm").SQL) =>
    Number((await q1<{ n: number }>(query))?.n) || 0;

  const sessions = await one(sql`SELECT COUNT(*)::int AS n FROM events WHERE type='session_end'`);
  const cardsSeen = await one(sql`SELECT COUNT(*)::int AS n FROM events WHERE type='seen'`);

  return {
    totalPublished: await one(sql`SELECT COUNT(*)::int AS n FROM cards WHERE status='published'`),
    totalDraft: await one(sql`SELECT COUNT(*)::int AS n FROM cards WHERE status='draft'`),
    totalUsers: await one(sql`SELECT COUNT(*)::int AS n FROM users`),
    totalReactions: await one(sql`SELECT COUNT(*)::int AS n FROM card_reactions`),
    totalSaves: await one(sql`SELECT COUNT(*)::int AS n FROM saved_cards`),
    avgCardsPerSession: sessions ? Math.round((cardsSeen / sessions) * 10) / 10 : 0,
  };
}

function previewOf(json: string): string {
  try {
    const c = JSON.parse(json);
    return c.word || c.text || c.quote || c.question || c.say || c.dont || "";
  } catch {
    return "";
  }
}
