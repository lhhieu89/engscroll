import { cookies } from "next/headers";
import { sql } from "drizzle-orm";
import { db, q, q1 } from "./db";
import { userIdForSession, SESSION_COOKIE } from "./auth";
import type { Level } from "./types";

export interface UserRow {
  id: string;
  level: Level | null;
  streak: number;
  last_active: string | null;
  created_at: string;
}

// Resolve the effective user id for the request: a logged-in account (via the
// session cookie) takes precedence; otherwise the anonymous uid set by the
// proxy. Returns null only if neither is present.
export async function getUid(): Promise<string | null> {
  const store = await cookies();
  const sessionUid = await userIdForSession(store.get(SESSION_COOKIE)?.value);
  if (sessionUid) return sessionUid;
  return store.get("eng_uid")?.value ?? null;
}

// The raw anonymous uid (ignores any logged-in session). Used at login/register
// time to merge anonymous progress into the account.
export async function getAnonUid(): Promise<string | null> {
  const store = await cookies();
  return store.get("eng_uid")?.value ?? null;
}

// Ensure a users row exists for this uid and return it.
export async function ensureUser(uid: string): Promise<UserRow> {
  await db.execute(
    sql`INSERT INTO users (id) VALUES (${uid}) ON CONFLICT (id) DO NOTHING`,
  );
  return (await q1<UserRow>(sql`SELECT * FROM users WHERE id = ${uid}`))!;
}

export async function getCurrentUser(): Promise<UserRow | null> {
  const uid = await getUid();
  if (!uid) return null;
  return ensureUser(uid);
}

// Set the level. A real level LOCKS it (manual choice is authoritative); null
// unlocks it and hands control back to continuous auto-inference.
export async function setLevel(uid: string, level: Level | null) {
  await ensureUser(uid);
  const locked = level ? 1 : 0;
  await db.execute(
    sql`UPDATE users SET level = ${level}, level_locked = ${locked} WHERE id = ${uid}`,
  );
}

// Continuously estimate the user's level from their RECENT OK/New reactions and
// keep it up to date — it can rise as they improve and fall if content gets too
// hard. Skipped entirely when the level is locked (manually chosen). "OK" = they
// already knew the card, "New" = it was new to them.
//
// Uses a sliding window of the latest reactions so it tracks current ability,
// not all-time history. The assigned level is the HARDEST band the user still
// mostly knows; the feed's adjacent-level weighting keeps probing one band up,
// so a genuinely stronger user climbs naturally (and a struggling one drops).
const INFER_WINDOW = 40; // recent reactions considered
const INFER_MIN_TOTAL = 8; // need at least this many before assigning
const INFER_MIN_BAND = 4; // reactions at a band before trusting its rate
const INFER_KNOW_RATE = 0.6; // OK-rate to count a band as "known"
const INFER_STRUGGLE_RATE = 0.3; // OK-rate at/below which a band is "too hard"

export async function maybeInferLevel(uid: string): Promise<void> {
  const user = await q1<{ level: Level | null; level_locked: number }>(
    sql`SELECT level, level_locked FROM users WHERE id = ${uid}`,
  );
  if (!user || user.level_locked) return; // manual choice is authoritative

  const rows = await q<{ level: Level; reaction: string; n: number }>(sql`
    SELECT c.level, r.reaction, count(*)::int AS n
    FROM (
      SELECT card_id, reaction FROM card_reactions
      WHERE user_id = ${uid} ORDER BY created_at DESC LIMIT ${INFER_WINDOW}
    ) r JOIN cards c ON c.id = r.card_id
    GROUP BY c.level, r.reaction`);

  const tally: Record<Level, { ok: number; nw: number }> = {
    basic: { ok: 0, nw: 0 },
    intermediate: { ok: 0, nw: 0 },
    advanced: { ok: 0, nw: 0 },
  };
  let total = 0;
  for (const r of rows) {
    if (!tally[r.level]) continue;
    if (r.reaction === "ok") tally[r.level].ok += r.n;
    else if (r.reaction === "new") tally[r.level].nw += r.n;
    total += r.n;
  }
  if (total < INFER_MIN_TOTAL) return;

  const bandTotal = (lvl: Level) => tally[lvl].ok + tally[lvl].nw;
  const knows = (lvl: Level) => {
    const t = bandTotal(lvl);
    return t >= INFER_MIN_BAND && tally[lvl].ok / t >= INFER_KNOW_RATE;
  };
  const struggles = (lvl: Level) => {
    const t = bandTotal(lvl);
    return t >= INFER_MIN_BAND && tally[lvl].ok / t <= INFER_STRUGGLE_RATE;
  };
  const order: Level[] = ["basic", "intermediate", "advanced"];

  // Rise to the hardest band they still mostly know…
  let target: Level | null = knows("advanced")
    ? "advanced"
    : knows("intermediate")
      ? "intermediate"
      : knows("basic")
        ? "basic"
        : null;

  // …otherwise, only move if the CURRENT band is clearly too hard — step down
  // one band (gentle), never slam to basic. If nothing is conclusive, hold.
  if (target === null) {
    const cur: Level = user.level ?? "basic";
    if (struggles(cur)) target = order[Math.max(0, order.indexOf(cur) - 1)];
    else return;
  }

  if (target !== user.level) {
    await db.execute(sql`UPDATE users SET level = ${target} WHERE id = ${uid}`);
  }
}

// Streak logic (Phase 1, deliberately minimal):
//   - counts up when the user is active on consecutive calendar days
//   - resets to 1 after a gap
//   - called whenever the user reacts to >= 1 card that day
// Returns the streak value after applying today's activity.
export async function touchStreak(uid: string): Promise<number> {
  const user = await ensureUser(uid);
  const today = todayStr();
  if (user.last_active === today) return user.streak; // already counted today

  let streak = 1;
  if (user.last_active === yesterdayStr()) {
    streak = user.streak + 1; // consecutive day
  }
  await db.execute(
    sql`UPDATE users SET streak = ${streak}, last_active = ${today} WHERE id = ${uid}`,
  );
  return streak;
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function yesterdayStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}
