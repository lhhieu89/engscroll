import { NextResponse } from "next/server";
import { requireUid, noUser } from "@/lib/api";
import { getAccount } from "@/lib/auth";
import { grantPremium, isPremiumUser } from "@/lib/decks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Demo entitlement: grant premium to the current (logged-in) user. In a real
// product this endpoint would be a payment webhook, not a direct grant.
export async function POST() {
  const uid = await requireUid();
  if (!uid) return noUser();
  const acct = await getAccount(uid);
  if (!acct || acct.provider === "anon")
    return NextResponse.json(
      { error: "Cần đăng nhập để mở Premium" },
      { status: 401 },
    );
  await grantPremium(uid);
  return NextResponse.json({ ok: true, isPremium: await isPremiumUser(uid) });
}
