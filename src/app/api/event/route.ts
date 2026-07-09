import { NextRequest, NextResponse } from "next/server";
import { requireUid } from "@/lib/api";
import { logEvent } from "@/lib/analytics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Generic analytics sink. Accepts a single event or a batch.
// Event types used by the client: seen, session_start, session_end.
export async function POST(req: NextRequest) {
  const uid = await requireUid();
  const body = await req.json().catch(() => ({}));
  const list = Array.isArray(body.events) ? body.events : [body];

  for (const e of list.slice(0, 200)) {
    if (!e || typeof e.type !== "string") continue;
    await logEvent(uid, typeof e.cardId === "string" ? e.cardId : null, e.type, e.meta);
  }
  return NextResponse.json({ ok: true, count: list.length });
}
