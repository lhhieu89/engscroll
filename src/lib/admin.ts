import { NextResponse } from "next/server";

// Lightweight admin gate for the content pipeline. If ADMIN_KEY is set in the
// environment, requests must send a matching `x-admin-key` header (or ?key=).
// If unset (local dev), the admin tools are open. Good enough for Phase 1's
// soft launch; swap for real auth before public scale.
export function checkAdmin(req: Request): NextResponse | null {
  const key = process.env.ADMIN_KEY;
  if (!key) return null;
  const url = new URL(req.url);
  const provided = req.headers.get("x-admin-key") ?? url.searchParams.get("key");
  if (provided === key) return null;
  return NextResponse.json({ error: "forbidden" }, { status: 403 });
}
