import { NextResponse } from "next/server";
import { requireUid } from "@/lib/api";
import { listDecks, isPremiumUser } from "@/lib/decks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const uid = await requireUid();
  return NextResponse.json({
    decks: await listDecks(),
    isPremium: await isPremiumUser(uid),
  });
}
