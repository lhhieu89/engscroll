import { NextRequest, NextResponse } from "next/server";
import { getDeckMeta, getDeckCards } from "@/lib/decks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// All decks are open — nothing is locked.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const meta = await getDeckMeta(id);
  if (!meta) return NextResponse.json({ error: "not found" }, { status: 404 });

  return NextResponse.json({ deck: meta, locked: false, cards: await getDeckCards(id) });
}
