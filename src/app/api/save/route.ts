import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { requireUid, noUser, badRequest } from "@/lib/api";
import { logEvent } from "@/lib/analytics";
import { db, q1 } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Toggle save/unsave for a card. Save is a separate action from reactions.
export async function POST(req: NextRequest) {
  const uid = await requireUid();
  if (!uid) return noUser();

  const { cardId } = await req.json().catch(() => ({}));
  if (typeof cardId !== "string") return badRequest("cardId required");

  const existing = await q1(
    sql`SELECT 1 AS x FROM saved_cards WHERE user_id = ${uid} AND card_id = ${cardId}`,
  );

  let saved: boolean;
  if (existing) {
    await db.execute(sql`DELETE FROM saved_cards WHERE user_id = ${uid} AND card_id = ${cardId}`);
    saved = false;
  } else {
    await db.execute(sql`INSERT INTO saved_cards (user_id, card_id) VALUES (${uid}, ${cardId})`);
    saved = true;
  }

  await logEvent(uid, cardId, saved ? "save" : "unsave");
  return NextResponse.json({ ok: true, saved });
}
