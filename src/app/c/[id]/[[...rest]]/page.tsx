import { notFound, permanentRedirect } from "next/navigation";
import type { Metadata } from "next";
import { getCardById, pathFor, TYPE_KIND } from "@/lib/seo";
import { shareInfoFor } from "@/lib/share";
import CardPermalink from "@/components/CardPermalink";

// Universal per-card permalink: /c/<id> (optional readable slug segments after
// it are ignored — the id is the key). SEO-typed cards (vocab/expression/grammar)
// 301 to their keyword URL; the rest (quiz/quote/video) render here, noindex.
export const revalidate = 3600;
export const dynamicParams = true;
export function generateStaticParams() {
  return [];
}

type Props = { params: Promise<{ id: string; rest?: string[] }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const found = await getCardById(id);
  if (!found) return {};
  const share = shareInfoFor(found.card);
  const description = share.text.replace(/\s+/g, " ").trim().slice(0, 160);
  return {
    title: `${share.title} · EngScroll`,
    description,
    robots: { index: false, follow: true }, // app permalink, not an SEO page
    openGraph: {
      title: share.title,
      description,
      images: [{ url: share.imagePath, width: 1200, height: 630, alt: share.title }],
    },
    twitter: {
      card: "summary_large_image",
      title: share.title,
      description,
      images: [share.imagePath],
    },
  };
}

export default async function Page({ params }: Props) {
  const { id } = await params;
  const found = await getCardById(id);
  if (!found) notFound();

  // SEO-typed card → send it to its canonical keyword URL.
  const kind = TYPE_KIND[found.type];
  if (kind && found.slug) permanentRedirect(pathFor(kind, found.slug));

  return <CardPermalink card={found.card} />;
}
