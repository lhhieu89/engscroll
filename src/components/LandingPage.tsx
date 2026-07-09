import Link from "next/link";
import { ChevronRight } from "lucide-react";
import AppShell from "./AppShell";
import DetailCard from "./DetailCard";
import { jsonLd, type Landing } from "../lib/seo";

// Landing / detail page. Structurally identical to the feed: the same AppShell
// frame with the card rendered by the same feed <Card>. Everything not part of
// the card (Related, FAQ) sits below. Goal is to pull the visitor INTO the feed,
// not to expose an index of everything we have.
export default function LandingPage({ l }: { l: Landing }) {
  return (
    <AppShell>
      {/* JSON-LD for SEO/AEO (Breadcrumb + DefinedTerm + FAQPage) */}
      {jsonLd(l).map((node, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(node) }}
        />
      ))}

      <div className="px-2 pt-3 sm:px-0">
        {/* Keyword-rich H1 for SEO, visually hidden so the page reads like feed. */}
        <h1 className="sr-only">{l.headline}</h1>

        {/* The card — exactly like a feed card (audio, react, save, share menu). */}
        <DetailCard card={l.card} />

        {/* Related — internal links to other detail pages (crawl + browse). */}
        {l.related.length > 0 && (
          <section className="post fade-up p-4">
            <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-[var(--muted)]">
              Liên quan
            </h2>
            <div className="flex flex-wrap gap-2">
              {l.related.map((r) => (
                <Link
                  key={r.href}
                  href={r.href}
                  className="rounded-full border border-[var(--border)] bg-[var(--hover)] px-3 py-1.5 text-sm hover:bg-[var(--card)]"
                >
                  {r.term}
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* FAQ — mirrors the FAQPage JSON-LD, visible on the page. */}
        {l.faq.length > 0 && (
          <section className="post p-4">
            <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-[var(--muted)]">
              Câu hỏi thường gặp
            </h2>
            <div className="space-y-3">
              {l.faq.map((f, i) => (
                <div key={i}>
                  <p className="font-semibold">{f.q}</p>
                  <p className="mt-0.5 text-sm text-[var(--muted)]">{f.a}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* CTA — pull them into the feed. */}
        <Link
          href="/"
          className="post flex items-center justify-between p-4 text-[var(--accent)] hover:bg-[var(--hover)]"
        >
          <span className="font-semibold">
            Lướt tiếp để học thêm — mở feed EngScroll
          </span>
          <ChevronRight size={22} />
        </Link>
      </div>
    </AppShell>
  );
}
