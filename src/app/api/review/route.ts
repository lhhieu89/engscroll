import { NextResponse } from "next/server";
import { requireUid, noUser } from "@/lib/api";
import { getDueCards, dueCount } from "@/lib/review";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Fetch the due review queue (saved cards scheduled for today).
export async function GET() {
  const uid = await requireUid();
  if (!uid) return noUser();
  return NextResponse.json({ cards: await getDueCards(uid), due: await dueCount(uid) });
}
