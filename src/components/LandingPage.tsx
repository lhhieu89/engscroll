import Link from "next/link";
import { ChevronRight, Sparkles } from "lucide-react";
import { BrandMark } from "../lib/brand";
import {
  KIND_LABEL,
  jsonLd,
  type Landing,
} from "../lib/seo";
import { abs } from "../lib/site";
import AudioButton from "./AudioButton";
import ShareBar from "./ShareBar";

// Shared renderer for /word, /phrase, /grammar landing pages. Structure mirrors
// the "How are you doing?" template the SEO plan calls for:
// Answer (TL;DR) → Pronunciation → Meaning → Examples → Quiz → Related → FAQ.
export default function LandingPage({ l }: { l: Landing }) {
  const ogUrl = `/api/og?kind=${l.kind}&slug=${encodeURIComponent(l.slug)}`;
  const section = "rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 sm:p-6";
  const h2 = "text-sm font-bold uppercase tracking-wide text-[var(--muted)]";

  return (
    <div className="min-h-dvh bg-[var(--bg)]">
      {/* JSON-LD for SEO/AEO (Breadcrumb + DefinedTerm + FAQPage) */}
      {jsonLd(l).map((node, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(node) }}
        />
      ))}

      {/* Brand header */}
      <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--card)]">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
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

      <main className="mx-auto max-w-3xl px-4 py-6">
        {/* Breadcrumb */}
        <nav className="mb-4 flex flex-wrap items-center gap-1 text-sm text-[var(--muted)]">
          <Link href="/" className="hover:underline">Trang chủ</Link>
          <ChevronRight size={14} />
          <Link href={`/${l.kind}`} className="hover:underline">{KIND_LABEL[l.kind]}</Link>
          <ChevronRight size={14} />
          <span className="text-[var(--fg)]">{l.term}</span>
        </nav>

        <article className="space-y-4">
          {/* Hero + TL;DR answer (AEO) */}
          <div className={section}>
            <span className="chip inline-block rounded-full px-3 py-1 text-xs">
              {l.eyebrow}
            </span>
            <h1 className="mt-3 text-3xl font-extrabold leading-tight sm:text-4xl">
              {l.headline}
            </h1>
            <p className="mt-3 text-lg leading-relaxed text-[var(--fg)]">
              {l.tldr}
            </p>
            <div className="mt-4">
              <ShareBar
                title={`${l.term} — EngScroll`}
                text={l.tldr}
                url={l.canonical}
                imageUrl={ogUrl}
                imageName={l.slug}
              />
            </div>
          </div>

          {/* Pronunciation */}
          {(l.ipaUk || l.audioUk || l.audioUs) && (
            <div className={section}>
              <h2 className={h2}>Phát âm</h2>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                {l.ipaUk && (
                  <span className="font-mono text-lg text-[var(--fg)]">
                    {l.ipaUk}
                  </span>
                )}
                {l.audioUk && <AudioButton src={l.audioUk} label="UK" />}
                {l.audioUs && l.audioUs !== l.audioUk && (
                  <AudioButton src={l.audioUs} label="US" />
                )}
              </div>
            </div>
          )}

          {/* Meaning */}
          <div className={section}>
            <h2 className={h2}>Nghĩa</h2>
            <ul className="mt-3 space-y-3">
              {l.senses.map((s, i) => (
                <li key={i} className="border-l-2 border-[var(--chip)] pl-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {s.pos && (
                      <span className="rounded bg-[var(--hover)] px-2 py-0.5 text-xs font-semibold text-[var(--muted)]">
                        {s.pos}
                      </span>
                    )}
                    {s.cefr && (
                      <span className="rounded bg-[var(--chip)] px-2 py-0.5 text-xs font-bold text-[var(--accent)]">
                        {s.cefr}
                      </span>
                    )}
                    <span className="text-base font-semibold">{s.meaning_vi}</span>
                  </div>
                  {s.meaning_en && (
                    <p className="mt-1 text-sm text-[var(--muted)]">{s.meaning_en}</p>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Examples */}
          {l.examples.length > 0 && (
            <div className={section}>
              <h2 className={h2}>Ví dụ</h2>
              <ul className="mt-3 space-y-4">
                {l.examples.map((ex, i) => (
                  <li key={i}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-base font-medium">“{ex.en}”</span>
                      {ex.audio && <AudioButton src={ex.audio} label="Nghe" />}
                    </div>
                    {ex.vi && (
                      <p className="mt-0.5 text-sm text-[var(--muted)]">{ex.vi}</p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Quiz — static <details> so the answer stays crawlable & JS-free */}
          {l.quiz && (
            <div className={section}>
              <h2 className={h2}>Quiz</h2>
              <p className="mt-3 text-base font-semibold">{l.quiz.question}</p>
              <ul className="mt-3 space-y-2">
                {l.quiz.options.map((opt, i) => (
                  <li
                    key={i}
                    className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
                  >
                    {String.fromCharCode(65 + i)}. {opt}
                  </li>
                ))}
              </ul>
              <details className="mt-3">
                <summary className="text-sm font-semibold text-[var(--accent)]">
                  Xem đáp án
                </summary>
                <p className="mt-2 text-sm">
                  <strong>
                    Đáp án: {String.fromCharCode(65 + l.quiz.correct)}.{" "}
                    {l.quiz.options[l.quiz.correct]}
                  </strong>
                  {" — "}
                  {l.quiz.explain_vi}
                </p>
              </details>
            </div>
          )}

          {/* Related — internal links for crawl depth + navigation */}
          {l.related.length > 0 && (
            <div className={section}>
              <h2 className={h2}>Liên quan</h2>
              <div className="mt-3 flex flex-wrap gap-2">
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
            </div>
          )}

          {/* FAQ — mirrors the FAQPage JSON-LD, visible on the page */}
          {l.faq.length > 0 && (
            <div className={section}>
              <h2 className={h2}>Câu hỏi thường gặp</h2>
              <div className="mt-3 space-y-3">
                {l.faq.map((f, i) => (
                  <div key={i}>
                    <p className="font-semibold">{f.q}</p>
                    <p className="mt-0.5 text-[var(--muted)]">{f.a}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CTA into the app */}
          <Link
            href="/"
            className="flex items-center justify-between rounded-2xl bg-[var(--accent)] p-5 text-white hover:brightness-110"
          >
            <span>
              <span className="block text-lg font-extrabold">
                Học tiếng Anh bằng cách lướt
              </span>
              <span className="text-sm text-white/85">
                Feed từ vựng, mẫu câu &amp; ngữ pháp — 3–5 phút mỗi ngày.
              </span>
            </span>
            <ChevronRight size={28} />
          </Link>
        </article>

        {/* Footer with hub links */}
        <footer className="mt-10 border-t border-[var(--border)] pt-6 text-sm text-[var(--muted)]">
          <div className="flex flex-wrap gap-4">
            <Link href="/word" className="hover:underline">Từ vựng</Link>
            <Link href="/phrase" className="hover:underline">Mẫu câu &amp; Idiom</Link>
            <Link href="/grammar" className="hover:underline">Ngữ pháp</Link>
            <Link href="/" className="hover:underline">Trang chủ</Link>
          </div>
          <p className="mt-3">
            © EngScroll ·{" "}
            <a href={abs("/")} className="hover:underline">
              engscroll
            </a>
          </p>
        </footer>
      </main>
    </div>
  );
}
