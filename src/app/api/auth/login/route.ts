import { NextRequest, NextResponse } from "next/server";
import { loginWithEmail, createSession, AuthError } from "@/lib/auth";
import { getAnonUid } from "@/lib/user";
import { setSessionCookie } from "@/lib/session-cookie";
import { publicUser } from "@/lib/public-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { email, password } = await req.json().catch(() => ({}));
  if (typeof email !== "string" || typeof password !== "string")
    return NextResponse.json({ error: "Thiếu email/mật khẩu" }, { status: 400 });

  try {
    const anon = await getAnonUid();
    const acct = await loginWithEmail(email, password, anon);
    await setSessionCookie(await createSession(acct.id));
    return NextResponse.json({ ok: true, user: publicUser(acct) });
  } catch (e) {
    if (e instanceof AuthError)
      return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
}
