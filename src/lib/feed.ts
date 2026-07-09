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

// Feed slug — MUST match scripts/seed-banks.mjs slug() so a quiz id derived from
// a word/sentence maps back to the same key as its source vocab/expression card.
function feedSlug(s: string): string {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 56);
}
// Quiz ids are `qz_<style>_<slug>` (see seed-banks.mjs emitQuiz). Strip the
// prefix to recover the source key. `vocabrev` before `vocab` (prefix overlap).
const QUIZ_KEY_PREFIX = /^qz_(?:vocabrev|cloze|vocab|grm|exp|sent|crz)_/;
// Recover the "topic key" shared between a source card and the quiz built from
// it, so spaced-pairing can place a quiz shortly AFTER its source in the page.
function cardKey(r: CandidateRow): string | null {
  if (r.type === "quiz") {
    const k = r.id.replace(QUIZ_KEY_PREFIX, "");
    return k && k !== r.id ? k : null;
  }
  try {
    const c = JSON.parse(r.content_json) as Record<string, unknown>;
    const src =
      r.type === "vocab" ? c.word
        : r.type === "expression" ? c.text
        : r.type === "grammar" ? c.say
        : null;
    return typeof src === "string" && src ? feedSlug(src) : null;
  } catch {
    return null;
  }
}
// Don't open a page with a quiz — show a few input cards first so recall has
// something to reinforce (input-first).
const QUIZ_WARMUP = 3;
// Ceiling on quiz share per page, enforced even when other buckets run dry (a
// heavy user's unseen pool skews quiz now that the quiz bank is large). Repeats
// of input cards are more on-brand than a quiz flood at the session tail.
const QUIZ_MAX_SHARE = 0.2;

/**
 * Compose a feed page.
 * - Pulls published cards with per-user + global state.
 * - Scores them with the adaptive rules.
 * - Interleaves by the fixed FEED_RATIO using smooth weighted round-robin,
 *   guaranteeing no two same-type cards are adjacent (so never two quizzes in a
 *   row).
 * - Caps quiz at QUIZ_MAX_SHARE of the page and prefers quizzes whose source
 *   card already appeared this page (spaced reinforcement), never leading the
 *   page with a quiz.
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

  // Smooth weighted round-robin interleave with no-adjacent-same-type, a quiz
  // display cap, and spaced-pairing (quiz after its source card).
  const credit = Object.fromEntries(types.map((t) => [t, 0])) as Record<
    CardType,
    number
  >;
  const out: CandidateRow[] = [];
  let last: CardType | null = null;
  const emittedKeys = new Set<string>(); // source keys already shown this page
  const maxQuiz = Math.max(1, Math.ceil(limit * QUIZ_MAX_SHARE));
  let quizPlaced = 0;

  // Index of the highest-scored quiz whose source already appeared this page
  // (bucket is score-sorted, so the first match is the best paired quiz).
  const pairedQuizIndex = () =>
    buckets.quiz.findIndex((r) => {
      const k = cardKey(r);
      return k !== null && emittedKeys.has(k);
    });

  while (out.length < limit) {
    for (const t of types) credit[t] += FEED_RATIO[t];

    // Candidate types: still have cards, not equal to the previous type, and —
    // for quiz — under the cap and either paired or past warmup.
    let pick: CardType | null = null;
    let bestCredit = -Infinity;
    for (const t of types) {
      if (buckets[t].length === 0) continue;
      if (t === last && availableTypes(buckets) > 1) continue; // avoid adjacency
      if (t === "quiz") {
        if (last === "quiz") continue; // HARD: never two quizzes in a row, even
        // when quiz is the only bucket left — end the page short instead of
        // dumping an adjacent quiz tail (client paginates).
        if (quizPlaced >= maxQuiz) continue; // hard display cap
        if (pairedQuizIndex() < 0 && out.length < QUIZ_WARMUP) continue; // input-first
      }
      if (credit[t] > bestCredit) {
        bestCredit = credit[t];
        pick = t;
      }
    }
    if (!pick) break; // nothing placeable (e.g. only capped quiz left)

    // For quiz, take the best paired one if any, else the top-scored (fallback).
    let idx = 0;
    if (pick === "quiz") {
      const pi = pairedQuizIndex();
      idx = pi >= 0 ? pi : 0;
      quizPlaced++;
    }
    credit[pick] -= 1;
    const chosen = buckets[pick].splice(idx, 1)[0];
    out.push(chosen);
    last = pick;
    if (pick !== "quiz") {
      const k = cardKey(chosen);
      if (k !== null) emittedKeys.add(k);
    }
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
