import type { NextRequest } from "next/server";
import { getLanding, KINDS, type Kind } from "../../../lib/seo";
import { renderOgImage } from "../../../lib/og";

// Dynamic 1200×630 social card for a landing page. Serves both the og:image
// link preview and the ShareBar "Lưu ảnh" (Save image) download, so the shared
// picture always matches the page.
export const runtime = "nodejs";

const MONTH = 60 * 60 * 24 * 30;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const kind = searchParams.get("kind") as Kind | null;
  const slug = searchParams.get("slug");

  // Landing mode: rich card built from the DB (used by page og:image).
  if (kind && KINDS.includes(kind) && slug) {
    const l = await getLanding(kind, slug);
    if (!l) return new Response("not found", { status: 404 });
    return renderOgImage({
      eyebrow: l.eyebrow,
      title: l.term,
      subtitle: l.senses[0]?.meaning_vi,
      footnote: l.ipaUk
        ? `${l.ipaUk} · EngScroll`
        : "Meaning · Pronunciation · Examples · Quiz",
      cacheSeconds: MONTH,
    });
  }

  // Freeform mode: any feed card can build a share image straight from its
  // content, no landing page required (quiz/quote/video included).
  const title = searchParams.get("title");
  if (title) {
    return renderOgImage({
      eyebrow: searchParams.get("eyebrow") || undefined,
      title: title.slice(0, 120),
      subtitle: searchParams.get("subtitle")?.slice(0, 160) || undefined,
      footnote: searchParams.get("footnote")?.slice(0, 80) || undefined,
      cacheSeconds: MONTH,
    });
  }

  return new Response("bad request", { status: 400 });
}
