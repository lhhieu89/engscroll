import { sql } from "drizzle-orm";
import { q } from "./db";
import { FEED_RATIO, type CardType, type FeedCard, type Level } from "./types";

interface CandidateRow {
  id: string;
  type: CardType;
  level: Level;
  topic: string | null;
  content_json: string;
  audio_url: string | null;
  reacted: string | null;
  saved: number;
  seen_count: number;
  sel_option: number | null;
  is_correct: number | null;
  global_seen: number;
  new_cnt: number;
  ok_cnt: number;
  save_cnt: number;
}

// Cold-start bias: when the level is unknown (no onboarding gate — a fresh user
// hasn't set/earned one yet), lean toward easier, high-frequency content so a
// beginner isn't flooded with C2 words, while still showing variety.
const COLD_START: Record<Level, number> = {
  basic: 1,
  intermediate: 0.6,
  advanced: 0.3,
};

// Level affinity as an ADDITIVE preference (the user's own level scores highest;
// asymmetric so the band one above is probed a bit more than the one below).
// Additive — not a multiplier — so it composes cleanly with the freshness and
// reaction terms (a multiplier on a possibly-negative score misbehaves).
const ORDER: Level[] = ["basic", "intermediate", "advanced"];
function levelBonus(cardLevel: Level, userLevel: Level | null): number {
  let w: number;
  if (!userLevel) w = COLD_START[cardLevel] ?? 0.6;
  else {
    const d = ORDER.indexOf(cardLevel) - ORDER.indexOf(userLevel);
    w = d === 0 ? 1 : d === 1 ? 0.6 : d === -1 ? 0.45 : 0.2;
  }
  return w * 1.5; // 0.3 … 1.5
}

// Adaptive rule-based score. Higher = show sooner. FRESHNESS dominates: cards
// the user hasn't seen float to the top and every repeat view sinks them, so a
// refresh (F5) surfaces new content instead of the same cards. Strong jitter
// then shuffles the large pool of unseen cards so each load differs.
function scoreCard(c: CandidateRow, userLevel: Level | null): number {
  // Rates are CLAMPED to [0,1]: reactions/saves persist while a "seen" event can
  // be lost/batched, so raw new_cnt/save_cnt can exceed global_seen and blow the
  // score up for a few cards (which then stick to the top of every refresh).
  const denom = Math.max(1, c.global_seen || 0);
  const newRate = Math.min(1, c.new_cnt / denom);
  const saveRate = Math.min(1, c.save_cnt / denom);

  let score = Math.random() * 2.0; // dominant shuffle → fresh cards each load
  score += levelBonus(c.level, userLevel); // prefer the right level

  // Freshness — the dominant term.
  if (c.seen_count === 0) score += 2.5; // never seen → float up
  else score -= Math.min(c.seen_count, 6) * 1.0; // each repeat view sinks it

  // Personal signal.
  if (c.reacted === "ok") score -= 2.0; // already known → rarely resurface
  else if (!c.reacted) score += 0.3;

  // Mild global-quality nudge — capped small so it never overrides freshness.
  score += (newRate + saveRate) * 0.4; // ≤ 0.8, well under the 2.0 jitter

  return score;
}

/**
 * Compose a feed page.
 * - Pulls published cards with per-user + global state.
 * - Scores them with the adaptive rules.
 * - Interleaves by the fixed 40/25/20/15 ratio using smooth weighted
 *   round-robin, guaranteeing no two same-type cards are adjacent (so never
 *   two quizzes in a row).
 */
export async function getFeed(
  uid: string,
  userLevel: Level | null,
  exclude: string[],
  limit: number,
): Promise<FeedCard[]> {
  const notIn = exclude.length
    ? sql`AND c.id NOT IN (${sql.join(
        exclude.map((e) => sql`${e}`),
        sql`, `,
      )})`
    : sql``;

  const rows = await q<CandidateRow>(sql`
      SELECT
        c.id, c.type, c.level, c.topic, c.content_json, c.audio_url,
        r.reaction                                   AS reacted,
        CASE WHEN s.card_id IS NULL THEN 0 ELSE 1 END AS saved,
        COALESCE(v.seen_count, 0)                    AS seen_count,
        qa.selected_option                           AS sel_option,
        qa.is_correct                                AS is_correct,
        (SELECT COUNT(*)::int FROM card_views  WHERE card_id = c.id) AS global_seen,
        (SELECT COUNT(*)::int FROM card_reactions WHERE card_id = c.id AND reaction='new') AS new_cnt,
        (SELECT COUNT(*)::int FROM card_reactions WHERE card_id = c.id AND reaction='ok')  AS ok_cnt,
        (SELECT COUNT(*)::int FROM saved_cards WHERE card_id = c.id) AS save_cnt
      FROM cards c
      LEFT JOIN card_reactions r ON r.card_id = c.id AND r.user_id = ${uid}
      LEFT JOIN saved_cards    s ON s.card_id = c.id AND s.user_id = ${uid}
      LEFT JOIN card_views     v ON v.card_id = c.id AND v.user_id = ${uid}
      LEFT JOIN quiz_answers   qa ON qa.card_id = c.id AND qa.user_id = ${uid}
      WHERE c.status = 'published' ${notIn}
  `);

  if (rows.length === 0) return [];

  // Bucket by type, each sorted by descending adaptive score.
  const types = Object.keys(FEED_RATIO) as CardType[];
  const buckets = Object.fromEntries(
    types.map((t) => [t, [] as CandidateRow[]]),
  ) as Record<CardType, CandidateRow[]>;
  const scores = new Map<string, number>();
  for (const r of rows) {
    scores.set(r.id, scoreCard(r, userLevel));
    (buckets[r.type] ??= []).push(r);
  }
  types.forEach((t) =>
    buckets[t].sort((a, b) => scores.get(b.id)! - scores.get(a.id)!),
  );

  // Smooth weighted round-robin interleave with no-adjacent-same-type.
  const credit = Object.fromEntries(types.map((t) => [t, 0])) as Record<
    CardType,
    number
  >;
  const out: CandidateRow[] = [];
  let last: CardType | null = null;

  while (out.length < limit) {
    for (const t of types) credit[t] += FEED_RATIO[t];

    // Candidate types: still have cards, and not equal to the previous type.
    let pick: CardType | null = null;
    let bestCredit = -Infinity;
    for (const t of types) {
      if (buckets[t].length === 0) continue;
      if (t === last && availableTypes(buckets) > 1) continue; // avoid adjacency
      if (credit[t] > bestCredit) {
        bestCredit = credit[t];
        pick = t;
      }
    }
    if (!pick) break; // nothing left to place

    credit[pick] -= 1;
    out.push(buckets[pick].shift()!);
    last = pick;
  }

  return out.map(toFeedCard);
}

function availableTypes(buckets: Record<CardType, CandidateRow[]>): number {
  return (Object.keys(buckets) as CardType[]).filter(
    (t) => buckets[t].length > 0,
  ).length;
}

// Distinct cards this user has seen today (UTC), so the "X thẻ hôm nay" counter
// survives navigation instead of resetting to 0 on every feed remount. Returns
// the ids (capped) — the client seeds them so re-views don't double-count.
export async function getSeenTodayIds(uid: string): Promise<string[]> {
  const rows = await q<{ card_id: string }>(sql`
    SELECT card_id FROM card_views
    WHERE user_id = ${uid}
      AND last_seen >= (to_char((now() AT TIME ZONE 'UTC'), 'YYYY-MM-DD') || ' 00:00:00')
    LIMIT 5000`);
  return rows.map((r) => r.card_id);
}

function toFeedCard(r: CandidateRow): FeedCard {
  return {
    id: r.id,
    type: r.type,
    level: r.level,
    topic: r.topic,
    content: JSON.parse(r.content_json),
    audio_url: r.audio_url,
    reacted: (r.reacted as FeedCard["reacted"]) ?? null,
    saved: r.saved === 1,
    answered:
      r.sel_option !== null
        ? { selected: r.sel_option, is_correct: r.is_correct === 1 }
        : null,
  };
}
