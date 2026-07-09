import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { requireUid, noUser } from "@/lib/api";
import { q } from "@/lib/db";
import type { FeedCard } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// List the current user's saved cards (most recent first).
export async function GET() {
  const uid = await requireUid();
  if (!uid) return noUser();

  const rows = await q(sql`
    SELECT c.id, c.type, c.level, c.topic, c.content_json, c.audio_url
     FROM saved_cards s JOIN cards c ON c.id = s.card_id
     WHERE s.user_id = ${uid} AND c.status='published'
     ORDER BY s.created_at DESC`);

  const cards: FeedCard[] = rows.map((r) => ({
    id: String(r.id),
    type: r.type as FeedCard["type"],
    level: r.level as FeedCard["level"],
    topic: (r.topic as string) ?? null,
    content: JSON.parse(String(r.content_json)),
    audio_url: (r.audio_url as string) ?? null,
    reacted: null,
    saved: true,
  }));

  return NextResponse.json({ cards });
}
