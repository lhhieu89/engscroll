import Link from "next/link";
import { ChevronRight, Sparkles } from "lucide-react";
import { BrandMark } from "../lib/brand";
import { KIND_LABEL, pathFor, type Kind } from "../lib/seo";

// Index / hub page for a namespace: a keyword-rich intro + an A–Z browse wall of
// internal links so crawlers reach the long tail and learners can navigate.
export default function HubPage({
  kind,
  title,
  intro,
  count,
  entries,
}: {
  kind: Kind;
  title: string;
  intro: string;
  count: number;
  entries: { slug: string; term: string }[];
}) {
  // Group alphabetically for jump-nav + scannability.
  const groups = new Map<string, { slug: string; term: string }[]>();
  for (const e of entries) {
    const ch = (e.term || e.slug).charAt(0).toUpperCase();
    const key = /[A-Z]/.test(ch) ? ch : "#";
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(e);
  }
  const letters = [...groups.keys()].sort();

  return (
    <div className="min-h-dvh bg-[var(--bg)]">
      <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--card)]">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2" aria-label="EngScroll">
            <BrandMark size={26} />
            <span className="text-lg font-extrabold tracking-tight">
              <span className="text-[var(--accent)]">Eng</span>Scroll
            </span>
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-bold text-white hover:brightness-110"
          >
            <Sparkles size={16} /> Học bằng cách lướt
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6">
        <nav className="mb-4 flex items-center gap-1 text-sm text-[var(--muted)]">
          <Link href="/" className="hover:underline">Trang chủ</Link>
          <ChevronRight size={14} />
          <span className="text-[var(--fg)]">{KIND_LABEL[kind]}</span>
        </nav>

        <h1 className="text-3xl font-extrabold sm:text-4xl">{title}</h1>
        <p className="mt-3 max-w-2xl text-lg text-[var(--muted)]">{intro}</p>
        <p className="mt-1 text-sm text-[var(--muted)]">
          {count.toLocaleString("vi-VN")} mục · duyệt A–Z
        </p>

        {/* Letter jump nav */}
        <div className="mt-5 flex flex-wrap gap-1.5">
          {letters.map((L) => (
            <a
              key={L}
              href={`#${L}`}
              className="rounded-md bg-[var(--hover)] px-2.5 py-1 text-sm font-bold text-[var(--accent)] hover:bg-[var(--chip)]"
            >
              {L}
            </a>
          ))}
        </div>

        {/* A–Z groups */}
        <div className="mt-6 space-y-6">
          {letters.map((L) => (
            <section key={L} id={L} className="scroll-mt-16">
              <h2 className="mb-2 text-lg font-extrabold text-[var(--accent)]">{L}</h2>
              <div className="flex flex-wrap gap-2">
                {groups.get(L)!.map((e) => (
                  <Link
                    key={e.slug}
                    href={pathFor(kind, e.slug)}
                    className="rounded-full border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-sm hover:bg-[var(--hover)]"
                  >
                    {e.term}
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>

        <footer className="mt-10 border-t border-[var(--border)] pt-6 text-sm text-[var(--muted)]">
          <div className="flex flex-wrap gap-4">
            <Link href="/word" className="hover:underline">Từ vựng</Link>
            <Link href="/phrase" className="hover:underline">Mẫu câu &amp; Idiom</Link>
            <Link href="/grammar" className="hover:underline">Ngữ pháp</Link>
            <Link href="/" className="hover:underline">Trang chủ</Link>
          </div>
        </footer>
      </main>
    </div>
  );
}
