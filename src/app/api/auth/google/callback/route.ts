import { NextRequest, NextResponse } from "next/server";
import {
  googleConfigured,
  exchangeCode,
  fetchProfile,
} from "@/lib/google";
import { upsertGoogleUser, createSession } from "@/lib/auth";
import { getAnonUid } from "@/lib/user";
import { SESSION_COOKIE } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Google redirects back here with ?code&state. We verify state, exchange the
// code, upsert the account, start a session, and land the user on the feed.
export async function GET(req: NextRequest) {
  if (!googleConfigured())
    return NextResponse.redirect(new URL("/account?error=google_off", req.url));

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieState = req.cookies.get("g_state")?.value;

  if (!code || !state || !cookieState || state !== cookieState)
    return NextResponse.redirect(new URL("/account?error=state", req.url));

  try {
    const token = await exchangeCode(code, url.origin);
    const profile = await fetchProfile(token);
    if (!profile.email_verified)
      return NextResponse.redirect(new URL("/account?error=unverified", req.url));

    const anon = await getAnonUid();
    const acct = await upsertGoogleUser(profile.email, profile.name, anon);
    const session = await createSession(acct.id);

    const res = NextResponse.redirect(new URL("/", req.url));
    res.cookies.set(SESSION_COOKIE, session, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 90,
      path: "/",
    });
    res.cookies.delete("g_state");
    return res;
  } catch {
    return NextResponse.redirect(new URL("/account?error=google_failed", req.url));
  }
}
