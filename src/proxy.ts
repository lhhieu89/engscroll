import { NextRequest, NextResponse } from "next/server";

// Next 16 "proxy" convention (formerly middleware). Assign a stable anonymous
// user id cookie to every visitor so the feed, reactions and streaks work
// without login. The DB row is created lazily server-side on first use.
export function proxy(req: NextRequest) {
  const existing = req.cookies.get("eng_uid")?.value;
  const uid = existing ?? crypto.randomUUID();

  // Forward the id into THIS request's headers so the very first server render
  // already sees the user (no more "no level → onboarding gate" on load 1).
  const requestHeaders = new Headers(req.headers);
  if (!existing) {
    const cookie = req.headers.get("cookie");
    requestHeaders.set("cookie", (cookie ? cookie + "; " : "") + `eng_uid=${uid}`);
  }

  const res = NextResponse.next({ request: { headers: requestHeaders } });
  if (!existing) {
    res.cookies.set("eng_uid", uid, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365, // 1 year
      path: "/",
    });
  }
  return res;
}

export const config = {
  // Run on everything except static assets.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
