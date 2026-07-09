import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { sql } from "drizzle-orm";
import { db, q1, NOW_TEXT } from "./db";
import type { Level } from "./types";

export interface Account {
  id: string;
  email: string | null;
  name: string | null;
  provider: string;
  is_premium: number;
  level: Level | null;
  level_locked: number;
  streak: number;
}

const SESSION_DAYS = 90;
export const SESSION_COOKIE = "eng_sid";

// --- password hashing (scrypt, no external deps) ---------------------------

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const test = scryptSync(password, salt, 64);
  const orig = Buffer.from(hash, "hex");
  return test.length === orig.length && timingSafeEqual(test, orig);
}

// --- sessions --------------------------------------------------------------

export async function createSession(userId: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const expires = sql`to_char(((now() + (${SESSION_DAYS} * interval '1 day')) AT TIME ZONE 'UTC'), 'YYYY-MM-DD HH24:MI:SS')`;
  await db.execute(
    sql`INSERT INTO sessions (id, user_id, expires_at) VALUES (${token}, ${userId}, ${expires})`,
  );
  return token;
}

// Resolve a session token to a user id if it exists and hasn't expired.
export async function userIdForSession(
  token: string | undefined,
): Promise<string | null> {
  if (!token) return null;
  const row = await q1<{ user_id: string }>(
    sql`SELECT user_id FROM sessions WHERE id = ${token} AND expires_at > ${NOW_TEXT}`,
  );
  return row?.user_id ?? null;
}

export async function destroySession(token: string | undefined) {
  if (!token) return;
  await db.execute(sql`DELETE FROM sessions WHERE id = ${token}`);
}

export async function getAccount(userId: string): Promise<Account | null> {
  const row = await q1<Account>(
    sql`SELECT id, email, name, provider, is_premium, level, level_locked, streak FROM users WHERE id = ${userId}`,
  );
  return row ?? null;
}

// --- account creation / lookup ---------------------------------------------

export class AuthError extends Error {}

// Migrate anonymous progress (reactions, saves, quiz, views, events, saved-card
// review state) onto a real account. This is the "save sync" on login/register.
export async function mergeAnonInto(anonId: string, userId: string) {
  if (!anonId || anonId === userId) return;
  // Reassign rows, dropping ones that would collide on the unique keys.
  await db.execute(sql`DELETE FROM card_reactions WHERE user_id = ${userId} AND card_id IN (SELECT card_id FROM card_reactions WHERE user_id = ${anonId})`);
  await db.execute(sql`UPDATE card_reactions SET user_id = ${userId} WHERE user_id = ${anonId}`);
  await db.execute(sql`DELETE FROM saved_cards WHERE user_id = ${userId} AND card_id IN (SELECT card_id FROM saved_cards WHERE user_id = ${anonId})`);
  await db.execute(sql`UPDATE saved_cards SET user_id = ${userId} WHERE user_id = ${anonId}`);
  await db.execute(sql`UPDATE quiz_answers SET user_id = ${userId} WHERE user_id = ${anonId}`);
  await db.execute(sql`DELETE FROM card_views WHERE user_id = ${userId} AND card_id IN (SELECT card_id FROM card_views WHERE user_id = ${anonId})`);
  await db.execute(sql`UPDATE card_views SET user_id = ${userId} WHERE user_id = ${anonId}`);
  await db.execute(sql`UPDATE events SET user_id = ${userId} WHERE user_id = ${anonId}`);

  // Carry level/streak over if the account hasn't set them yet.
  const acct = await q1<{ level: string | null; streak: number }>(sql`SELECT level, streak FROM users WHERE id = ${userId}`);
  const anon = await q1<{ level: string | null; streak: number }>(sql`SELECT level, streak FROM users WHERE id = ${anonId}`);
  if (anon && acct) {
    if (!acct.level && anon.level)
      await db.execute(sql`UPDATE users SET level = ${anon.level} WHERE id = ${userId}`);
    if (anon.streak > acct.streak)
      await db.execute(sql`UPDATE users SET streak = ${anon.streak} WHERE id = ${userId}`);
    await db.execute(sql`DELETE FROM users WHERE id = ${anonId} AND provider = 'anon'`);
  }
}

export async function registerWithEmail(
  email: string,
  password: string,
  name: string | null,
  anonId: string | null,
): Promise<Account> {
  const normEmail = email.trim().toLowerCase();
  const exists = await q1(sql`SELECT 1 AS x FROM users WHERE email = ${normEmail}`);
  if (exists) throw new AuthError("Email đã được đăng ký");

  // Fresh account id (distinct from the anonymous uid, so logout truly logs
  // out); anonymous progress is merged in.
  const id = randomId();
  await db.execute(sql`INSERT INTO users (id, provider) VALUES (${id}, 'email')`);
  await db.execute(
    sql`UPDATE users SET email = ${normEmail}, password_hash = ${hashPassword(password)}, name = ${name} WHERE id = ${id}`,
  );
  if (anonId) await mergeAnonInto(anonId, id);

  return (await getAccount(id))!;
}

export async function loginWithEmail(
  email: string,
  password: string,
  anonId: string | null,
): Promise<Account> {
  const normEmail = email.trim().toLowerCase();
  const row = await q1<{ id: string; password_hash: string }>(
    sql`SELECT id, password_hash FROM users WHERE email = ${normEmail}`,
  );
  if (!row || !row.password_hash || !verifyPassword(password, row.password_hash))
    throw new AuthError("Email hoặc mật khẩu không đúng");

  if (anonId) await mergeAnonInto(anonId, row.id);
  return (await getAccount(row.id))!;
}

// Google OAuth: find-or-create by verified email.
export async function upsertGoogleUser(
  email: string,
  name: string | null,
  anonId: string | null,
): Promise<Account> {
  const normEmail = email.trim().toLowerCase();
  const existing = await q1<{ id: string }>(
    sql`SELECT id FROM users WHERE email = ${normEmail}`,
  );

  if (existing) {
    if (anonId) await mergeAnonInto(anonId, existing.id);
    return (await getAccount(existing.id))!;
  }

  const id = randomId();
  await db.execute(sql`INSERT INTO users (id, provider) VALUES (${id}, 'google')`);
  await db.execute(sql`UPDATE users SET email = ${normEmail}, name = ${name} WHERE id = ${id}`);
  if (anonId) await mergeAnonInto(anonId, id);
  return (await getAccount(id))!;
}

function randomId(): string {
  return randomBytes(16).toString("hex");
}
