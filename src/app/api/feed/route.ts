import { NextRequest, NextResponse } from "next/server";
import { requireUid, noUser } from "@/lib/api";
import { ensureUser } from "@/lib/user";
import { getFeed } from "@/lib/feed";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const uid = await requireUid();
  if (!uid) return noUser();
  const user = await ensureUser(uid);

  const body = await req.json().catch(() => ({}));
  const exclude: string[] = Array.isArray(body.exclude)
    ? body.exclude.filter((x: unknown) => typeof x === "string").slice(0, 2000)
    : [];
  const limit = Math.min(Math.max(Number(body.limit) || 10, 1), 30);

  const cards = await getFeed(uid, user.level, exclude, limit);
  return NextResponse.json({ cards, level: user.level, streak: user.streak });
}
