import { NextResponse } from "next/server";
import { destroySession } from "@/lib/auth";
import { readSessionToken, clearSessionCookie } from "@/lib/session-cookie";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  destroySession(await readSessionToken());
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}
