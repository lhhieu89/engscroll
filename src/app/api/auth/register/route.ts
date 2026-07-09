import { NextRequest, NextResponse } from "next/server";
import { registerWithEmail, createSession, AuthError } from "@/lib/auth";
import { getAnonUid } from "@/lib/user";
import { setSessionCookie } from "@/lib/session-cookie";
import { publicUser } from "@/lib/public-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { email, password, name } = await req.json().catch(() => ({}));
  if (typeof email !== "string" || !/^\S+@\S+\.\S+$/.test(email))
    return NextResponse.json({ error: "Email không hợp lệ" }, { status: 400 });
  if (typeof password !== "string" || password.length < 6)
    return NextResponse.json(
      { error: "Mật khẩu tối thiểu 6 ký tự" },
      { status: 400 },
    );

  try {
    const anon = await getAnonUid();
    const acct = await registerWithEmail(email, password, name ?? null, anon);
    await setSessionCookie(await createSession(acct.id));
    return NextResponse.json({ ok: true, user: publicUser(acct) });
  } catch (e) {
    if (e instanceof AuthError)
      return NextResponse.json({ error: e.message }, { status: 409 });
    throw e;
  }
}
