import { NextRequest, NextResponse } from "next/server";
import { requireUid, noUser, badRequest } from "@/lib/api";
import { getActivity, deleteActivity, clearActivity, type ActivityKind } from "@/lib/activity";
import { logEvent } from "@/lib/analytics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KINDS: ActivityKind[] = ["reaction", "save", "quiz"];

export async function GET() {
  const uid = await requireUid();
  if (!uid) return noUser();
  return NextResponse.json({ items: await getActivity(uid) });
}

// DELETE — one entry ({kind, cardId}) or the whole history ({clearAll:true}).
// Removing an entry also undoes the action (Facebook behavior).
export async function DELETE(req: NextRequest) {
  const uid = await requireUid();
  if (!uid) return noUser();

  const body = await req.json().catch(() => ({}));
  if (body.clearAll === true) {
    await clearActivity(uid);
    await logEvent(uid, null, "activity_clear_all");
    return NextResponse.json({ ok: true, cleared: "all" });
  }

  const { kind, cardId } = body;
  if (!KINDS.includes(kind)) return badRequest("invalid kind");
  if (typeof cardId !== "string") return badRequest("cardId required");

  await deleteActivity(uid, kind, cardId);
  await logEvent(uid, cardId, "activity_delete", { kind });
  return NextResponse.json({ ok: true });
}
