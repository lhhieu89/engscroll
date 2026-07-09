import { NextResponse } from "next/server";
import { getUid, ensureUser } from "./user";

// Resolve the anonymous uid for an API request, creating the user row.
// Returns null when no cookie is present (should not happen behind middleware).
export async function requireUid(): Promise<string | null> {
  const uid = await getUid();
  if (uid) await ensureUser(uid);
  return uid;
}

export function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function noUser() {
  return NextResponse.json({ error: "no user session" }, { status: 401 });
}
