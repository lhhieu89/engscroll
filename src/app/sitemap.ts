import type { MetadataRoute } from "next";
import { abs } from "../lib/site";
import { listSlugs, pathFor, KINDS, type Kind } from "../lib/seo";

// Chunked sitemap: id 0 = static + hubs, id 1/2/3 = word/phrase/grammar landing
// pages. Next exposes each at /sitemap/<id>.xml and auto-generates the index at
// /sitemap.xml. Chunking keeps each file well under the 50k-URL limit as the
// content library grows past hundreds of thousands of pages.
export async function generateSitemaps() {
  return [{ id: 0 }, { id: 1 }, { id: 2 }, { id: 3 }];
}

export default async function sitemap(props: {
  id: number | Promise<number>;
}): Promise<MetadataRoute.Sitemap> {
  // Next 16 passes the chunk id as a Promise.
  const id = Number(await props.id);
  if (id === 0) {
    // No hub/index pages — we surface content through the feed, not a directory.
    // Only the home feed plus the per-card detail pages (chunks 1–3) are indexed.
    return [{ url: abs("/"), changeFrequency: "daily", priority: 1 }];
  }

  const kind: Kind = KINDS[id - 1];
  if (!kind) return [];
  const entries = await listSlugs(kind, { limit: 50000 });
  return entries.map((e) => ({
    url: abs(pathFor(kind, e.slug)),
    changeFrequency: "monthly",
    priority: 0.6,
  }));
}
