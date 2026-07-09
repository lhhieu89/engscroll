import { NextRequest, NextResponse } from "next/server";
import { checkAdmin } from "@/lib/admin";
import { cardStats, overviewStats } from "@/lib/analytics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Analytics dashboard data: product overview + per-card OK/New/Save rates.
export async function GET(req: NextRequest) {
  const forbidden = checkAdmin(req);
  if (forbidden) return forbidden;
  return NextResponse.json({
    overview: await overviewStats(),
    cards: await cardStats(),
  });
}
