import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { requireUid, noUser, badRequest } from "@/lib/api";
import { touchStreak, maybeInferLevel } from "@/lib/user";
import { logEvent } from "@/lib/analytics";
import { db, q1 } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Facebook-style reaction: click the same one again to remove it, or click the
// other to switch. Returns the reaction now stored (or null if cleared).
// Setting a reaction advances the daily streak (removing it does not).
export async function POST(req: NextRequest) {
  const uid = await requireUid();
  if (!uid) return noUser();

  const { cardId, reaction } = await req.json().catch(() => ({}));
  if (typeof cardId !== "string") return badRequest("cardId required");
  if (reaction !== "ok" && reaction !== "new")
    return badRequest("reaction must be 'ok' or 'new'");

  const existing = await q1<{ reaction: string }>(
    sql`SELECT reaction FROM card_reactions WHERE user_id = ${uid} AND card_id = ${cardId}`,
  );

  let current: string | null;
  if (existing?.reaction === reaction) {
    // Same reaction clicked again → toggle off.
    await db.execute(sql`DELETE FROM card_reactions WHERE user_id = ${uid} AND card_id = ${cardId}`);
    current = null;
    await logEvent(uid, cardId, "unreact", { reaction });
  } else if (existing) {
    // Switch to the other reaction.
    await db.execute(sql`UPDATE card_reactions SET reaction = ${reaction} WHERE user_id = ${uid} AND card_id = ${cardId}`);
    current = reaction;
    await logEvent(uid, cardId, "react", { reaction, switched: true });
  } else {
    await db.execute(sql`INSERT INTO card_reactions (user_id, card_id, reaction) VALUES (${uid}, ${cardId}, ${reaction})`);
    current = reaction;
    await logEvent(uid, cardId, "react", { reaction });
  }

  let streak: number | undefined;
  if (current) {
    streak = await touchStreak(uid);
    // Learn the user's level from their OK/New pattern (only while unset).
    await maybeInferLevel(uid);
  }
  return NextResponse.json({ ok: true, reaction: current, streak });
}
