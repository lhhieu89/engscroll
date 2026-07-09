import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { requireUid, noUser, badRequest } from "@/lib/api";
import { logEvent } from "@/lib/analytics";
import { db, q1 } from "@/lib/db";
import type { QuizContent } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Grade a quiz answer server-side (never trust the client for correctness).
// Only the first answer per user/card is recorded.
export async function POST(req: NextRequest) {
  const uid = await requireUid();
  if (!uid) return noUser();

  const { cardId, selected } = await req.json().catch(() => ({}));
  if (typeof cardId !== "string") return badRequest("cardId required");
  if (typeof selected !== "number") return badRequest("selected index required");

  const card = await q1<{ content_json: string; type: string }>(
    sql`SELECT content_json, type FROM cards WHERE id = ${cardId} AND status='published'`,
  );
  if (!card || card.type !== "quiz") return badRequest("quiz card not found");

  const content = JSON.parse(card.content_json) as QuizContent;
  if (selected < 0 || selected >= content.options.length)
    return badRequest("selected out of range");

  const isCorrect = selected === content.correct;

  const already = await q1(
    sql`SELECT 1 AS x FROM quiz_answers WHERE user_id = ${uid} AND card_id = ${cardId}`,
  );
  if (!already) {
    await db.execute(
      sql`INSERT INTO quiz_answers (user_id, card_id, selected_option, is_correct) VALUES (${uid}, ${cardId}, ${selected}, ${isCorrect ? 1 : 0})`,
    );
    await logEvent(uid, cardId, "quiz_answer", { selected, isCorrect });
  }

  return NextResponse.json({
    ok: true,
    is_correct: isCorrect,
    correct: content.correct,
    explain_vi: content.explain_vi,
  });
}
