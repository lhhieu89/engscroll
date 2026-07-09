import { NextResponse } from "next/server";
import { getAccount } from "@/lib/auth";
import { getUid } from "@/lib/user";
import { publicUser } from "@/lib/public-user";
import { googleConfigured } from "@/lib/google";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Current auth state + whether Google login is configured (so the UI can decide
// whether to show the Google button).
export async function GET() {
  const uid = await getUid();
  const acct = uid ? await getAccount(uid) : null;
  const user =
    acct && acct.provider !== "anon" ? publicUser(acct) : null;
  // `level` is exposed for everyone (incl. anonymous) so the settings selector
  // works without an account. null = auto (inferred from reactions).
  return NextResponse.json({
    user,
    level: acct?.level ?? null,
    levelLocked: acct?.level_locked === 1,
    googleEnabled: googleConfigured(),
  });
}
