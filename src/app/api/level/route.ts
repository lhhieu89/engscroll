import { NextRequest, NextResponse } from "next/server";
import { requireUid, noUser, badRequest } from "@/lib/api";
import { setLevel } from "@/lib/user";
import { logEvent } from "@/lib/analytics";
import type { Level } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LEVELS: Level[] = ["basic", "intermediate", "advanced"];

// Set the user's level from /account (or clear to null = auto-infer).
export async function POST(req: NextRequest) {
  const uid = await requireUid();
  if (!uid) return noUser();

  const { level } = await req.json().catch(() => ({}));
  // `null` = auto (let the feed infer level from reactions).
  if (level !== null && !LEVELS.includes(level)) return badRequest("invalid level");

  await setLevel(uid, level);
  await logEvent(uid, null, level === null ? "level_auto" : "level_set", { level });
  return NextResponse.json({ ok: true, level });
}
