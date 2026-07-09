import { sql } from "drizzle-orm";
import { db, q, q1, TODAY_TEXT } from "./db";
import type { CardContent, CardType, Level } from "./types";

export type Grade = "again" | "hard" | "good" | "easy";

export interface ReviewCard {
  id: string;
  type: CardType;
  level: Level;
  content: CardContent;
  audio_url: string | null;
  reps: number;
  due_date: string | null;
}

// Cards eligible for review = the user's saved cards whose SR due date has
// arrived (or that have never been reviewed). Ordered soonest-due first.
export async function getDueCards(uid: string, limit = 20): Promise<ReviewCard[]> {
  const rows = await q(sql`
    SELECT c.id, c.type, c.level, c.content_json, c.audio_url,
            COALESCE(rs.reps, 0) AS reps, rs.due_date AS due_date
     FROM saved_cards s
     JOIN cards c ON c.id = s.card_id AND c.status = 'published'
     LEFT JOIN review_state rs ON rs.user_id = ${uid} AND rs.card_id = c.id
     WHERE rs.due_date IS NULL OR rs.due_date <= ${TODAY_TEXT}
     ORDER BY COALESCE(rs.due_date, '0000-00-00') ASC, s.created_at ASC
     LIMIT ${limit}`);

  return rows.map((r) => ({
    id: String(r.id),
    type: r.type as CardType,
    level: r.level as Level,
    content: JSON.parse(String(r.content_json)),
    audio_url: (r.audio_url as string) ?? null,
    reps: Number(r.reps) || 0,
    due_date: (r.due_date as string) ?? null,
  }));
}

export async function dueCount(uid: string): Promise<number> {
  const row = await q1<{ n: number }>(sql`
    SELECT COUNT(*)::int AS n
     FROM saved_cards s
     JOIN cards c ON c.id = s.card_id AND c.status = 'published'
     LEFT JOIN review_state rs ON rs.user_id = ${uid} AND rs.card_id = c.id
     WHERE rs.due_date IS NULL OR rs.due_date <= ${TODAY_TEXT}`);
  return Number(row?.n) || 0;
}

// SM-2-lite scheduling. Keeps ease in [1.3, 3.0]; maps four grades to the next
// interval. Deliberately gentle (Phase 2 "spaced repetition nhẹ").
export async function gradeCard(uid: string, cardId: string, grade: Grade) {
  const cur = await q1<{ ease: number; interval_days: number; reps: number }>(
    sql`SELECT ease, interval_days, reps FROM review_state WHERE user_id = ${uid} AND card_id = ${cardId}`,
  );

  let ease = cur?.ease ?? 2.5;
  let interval = cur?.interval_days ?? 0;
  let reps = cur?.reps ?? 0;

  switch (grade) {
    case "again":
      ease = Math.max(1.3, ease - 0.2);
      interval = 0; // due again today
      reps = 0;
      break;
    case "hard":
      ease = Math.max(1.3, ease - 0.15);
      interval = Math.max(1, Math.round((interval || 1) * 1.2));
      reps += 1;
      break;
    case "good":
      interval = reps === 0 ? 1 : reps === 1 ? 3 : Math.round(interval * ease);
      reps += 1;
      break;
    case "easy":
      ease = Math.min(3.0, ease + 0.15);
      interval = reps === 0 ? 2 : Math.round((interval || 1) * ease * 1.3);
      reps += 1;
      break;
  }
  interval = Math.min(interval, 365);

  const due = sql`to_char(((now() + (${interval} * interval '1 day')) AT TIME ZONE 'UTC'), 'YYYY-MM-DD')`;
  await db.execute(sql`
    INSERT INTO review_state (user_id, card_id, ease, interval_days, reps, due_date, last_reviewed)
     VALUES (${uid}, ${cardId}, ${ease}, ${interval}, ${reps}, ${due}, ${sql`to_char((now() AT TIME ZONE 'UTC'), 'YYYY-MM-DD HH24:MI:SS')`})
     ON CONFLICT (user_id, card_id) DO UPDATE SET
       ease = excluded.ease,
       interval_days = excluded.interval_days,
       reps = excluded.reps,
       due_date = excluded.due_date,
       last_reviewed = excluded.last_reviewed`);

  return { ease, interval, reps };
}
