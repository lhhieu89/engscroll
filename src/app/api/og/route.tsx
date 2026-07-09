import type { NextRequest } from "next/server";
import { getLanding, KINDS, type Kind } from "../../../lib/seo";
import { renderOgImage } from "../../../lib/og";

// Dynamic 1200×630 social card for a landing page. Serves both the og:image
// link preview and the ShareBar "Lưu ảnh" (Save image) download, so the shared
// picture always matches the page.
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const kind = searchParams.get("kind") as Kind | null;
  const slug = searchParams.get("slug");

  if (!kind || !KINDS.includes(kind) || !slug) {
    return new Response("bad request", { status: 400 });
  }

  const l = await getLanding(kind, slug);
  if (!l) return new Response("not found", { status: 404 });

  return renderOgImage({
    eyebrow: l.eyebrow,
    title: l.term,
    subtitle: l.senses[0]?.meaning_vi,
    footnote: l.ipaUk
      ? `${l.ipaUk} · EngScroll`
      : "Meaning · Pronunciation · Examples · Quiz",
    cacheSeconds: 60 * 60 * 24 * 30,
  });
}
