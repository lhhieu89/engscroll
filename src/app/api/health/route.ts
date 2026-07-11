import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

// Liveness probe for Docker HEALTHCHECK / nginx / uptime monitors.
//
//   GET /api/health         → { ok: true } as long as the server responds
//                             (no DB touch, so a DB blip won't restart the app)
//   GET /api/health?db=1    → also pings Postgres; 503 if the DB is unreachable
//
// Always uncached so probes see live state.
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const deep = new URL(req.url).searchParams.get("db") === "1";
  if (!deep) {
    return NextResponse.json({ ok: true, status: "live" });
  }

  try {
    await db.execute(sql`select 1`);
    return NextResponse.json({ ok: true, status: "ready", db: "up" });
  } catch (err) {
    return NextResponse.json(
      { ok: false, status: "degraded", db: "down", error: String(err) },
      { status: 503 },
    );
  }
}
