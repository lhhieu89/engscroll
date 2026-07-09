import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { q } from "@/lib/db";
import { checkAdmin } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Human review action. Only 'approve' moves a card to 'published' (the sole
// status the feed serves). 'reject' stores a note and keeps it out of the feed.
export async function POST(req: NextRequest) {
  const forbidden = checkAdmin(req);
  if (forbidden) return forbidden;

  const { cardId, action, note } = await req.json().catch(() => ({}));
  if (typeof cardId !== "string")
    return NextResponse.json({ error: "cardId required" }, { status: 400 });
  if (action !== "approve" && action !== "reject" && action !== "unpublish")
    return NextResponse.json({ error: "invalid action" }, { status: 400 });

  const status =
    action === "approve" ? "published" : action === "reject" ? "rejected" : "draft";

  const updated = await q(
    sql`UPDATE cards SET status = ${status}, review_note = ${typeof note === "string" ? note : null} WHERE id = ${cardId} RETURNING id`,
  );

  if (updated.length === 0)
    return NextResponse.json({ error: "card not found" }, { status: 404 });

  return NextResponse.json({ ok: true, status });
}
