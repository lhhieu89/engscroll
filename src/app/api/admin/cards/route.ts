import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db, q } from "@/lib/db";
import { checkAdmin } from "@/lib/admin";
import type { CardType, Level } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// List cards for the review queue, optionally filtered by status.
export async function GET(req: NextRequest) {
  const forbidden = checkAdmin(req);
  if (forbidden) return forbidden;

  const status = new URL(req.url).searchParams.get("status");
  const rows = await q(
    status
      ? sql`SELECT * FROM cards WHERE status = ${status} ORDER BY created_at DESC LIMIT 500`
      : sql`SELECT * FROM cards ORDER BY created_at DESC LIMIT 500`,
  );

  const cards = rows.map((r) => ({
    id: r.id,
    type: r.type,
    level: r.level,
    topic: r.topic,
    status: r.status,
    review_note: r.review_note,
    content: JSON.parse(String(r.content_json)),
    created_at: r.created_at,
  }));
  return NextResponse.json({ cards });
}

// Create a new DRAFT card (the "AI draft" step of the pipeline). Never
// auto-publishes — status is always 'draft' and must pass human review.
export async function POST(req: NextRequest) {
  const forbidden = checkAdmin(req);
  if (forbidden) return forbidden;

  const body = await req.json().catch(() => ({}));
  const type = body.type as CardType;
  const level = body.level as Level;
  const content = body.content;

  if (!["vocab", "grammar", "expression", "quiz", "quote", "video"].includes(type))
    return NextResponse.json({ error: "invalid type" }, { status: 400 });
  if (!["basic", "intermediate", "advanced"].includes(level))
    return NextResponse.json({ error: "invalid level" }, { status: 400 });
  if (!content || typeof content !== "object")
    return NextResponse.json({ error: "content required" }, { status: 400 });

  const id = `${type}_${Math.random().toString(36).slice(2, 10)}`;
  await db.execute(
    sql`INSERT INTO cards (id, type, level, topic, content_json, status)
        VALUES (${id}, ${type}, ${level}, ${body.topic ?? null}, ${JSON.stringify(content)}, 'draft')`,
  );

  return NextResponse.json({ ok: true, id, status: "draft" });
}
