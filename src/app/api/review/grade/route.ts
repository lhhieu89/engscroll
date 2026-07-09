import { NextRequest, NextResponse } from "next/server";
import { requireUid, noUser, badRequest } from "@/lib/api";
import { gradeCard, dueCount, type Grade } from "@/lib/review";
import { logEvent } from "@/lib/analytics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GRADES: Grade[] = ["again", "hard", "good", "easy"];

export async function POST(req: NextRequest) {
  const uid = await requireUid();
  if (!uid) return noUser();

  const { cardId, grade } = await req.json().catch(() => ({}));
  if (typeof cardId !== "string") return badRequest("cardId required");
  if (!GRADES.includes(grade)) return badRequest("invalid grade");

  const state = await gradeCard(uid, cardId, grade);
  await logEvent(uid, cardId, "review_grade", { grade });
  return NextResponse.json({ ok: true, ...state, due: await dueCount(uid) });
}
