import type { NextRequest } from "next/server";
import { sql } from "drizzle-orm";
import { q1 } from "../../../lib/db";
import { renderCardImage } from "../../../lib/card-image";
import type { CardType, CardContent } from "../../../lib/types";

// PNG of a card that looks exactly like the feed card. Powers the ShareBar
// "Tải ảnh" download. Keyed by card id so any feed card (incl. quiz/quote/video)
// can be saved.
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return new Response("bad request", { status: 400 });

  const row = await q1<{ type: string; level: string | null; topic: string | null; content_json: string }>(sql`
    SELECT type, level, topic, content_json FROM cards
    WHERE id = ${id} AND status = 'published' LIMIT 1`);
  if (!row) return new Response("not found", { status: 404 });

  let content: CardContent;
  try {
    content = JSON.parse(row.content_json);
  } catch {
    return new Response("bad content", { status: 500 });
  }
  return renderCardImage(row.type as CardType, content, {
    level: row.level,
    topic: row.topic,
  });
}
