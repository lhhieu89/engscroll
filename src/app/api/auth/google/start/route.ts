import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { googleConfigured, buildAuthUrl } from "@/lib/google";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Kick off the Google OAuth flow. 404s cleanly if credentials aren't set.
export async function GET(req: NextRequest) {
  if (!googleConfigured())
    return NextResponse.json(
      { error: "Google login chưa được cấu hình" },
      { status: 404 },
    );

  const origin = new URL(req.url).origin;
  const state = randomBytes(16).toString("hex");
  const res = NextResponse.redirect(buildAuthUrl(state, origin));
  // Short-lived CSRF state cookie, verified on callback.
  res.cookies.set("g_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 600,
    path: "/",
  });
  return res;
}
