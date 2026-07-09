import { cache } from "react";
import type { Metadata } from "next";
import { sql } from "drizzle-orm";
import { q, q1 } from "./db";
import { abs } from "./site";
import type {
  VocabContent,
  ExpressionContent,
  GrammarContent,
  QuizContent,
  FeedCard,
  CardType,
  Level,
} from "./types";

// ---------------------------------------------------------------------------
// SEO landing pages. Every published card becomes (part of) a keyword-rich
// page under one of three namespaces, keyed by (type, slug):
//   /word/<slug>    ← vocab      (aggregates a word's part-of-speech senses)
//   /phrase/<slug>  ← expression (idioms, phrasal verbs, daily sentences…)
//   /grammar/<slug> ← grammar    (contrast fixes + EGP tips)
// ---------------------------------------------------------------------------

export type Kind = "word" | "phrase" | "grammar";

export const KIND_TYPE: Record<Kind, string> = {
  word: "vocab",
  phrase: "expression",
  grammar: "grammar",
};

// Inverse of KIND_TYPE — the SEO card types that own a keyword landing page.
// Types absent here (quiz/quote/video) live only at the /c/<id> permalink.
export const TYPE_KIND: Record<string, Kind> = {
  vocab: "word",
  expression: "phrase",
  grammar: "grammar",
};

export const KIND_LABEL: Record<Kind, string> = {
  word: "Từ vựng",
  phrase: "Mẫu câu",
  grammar: "Ngữ pháp",
};

export const KINDS: Kind[] = ["word", "phrase", "grammar"];

// Transliterate first so Vietnamese/accented text keeps its letters as ASCII
// (không dấu) instead of losing them: "Bạn khỏe không" → "ban-khoe-khong", not
// "b-n-kh-e-kh-ng". Pure-ASCII English is unchanged. MUST stay identical to the
// copies in src/lib/share.ts and scripts/backfill-slugs.mjs.
export function slugify(s: string): string {
  return String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip combining diacritics (incl. horn)
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function pathFor(kind: Kind, slug: string): string {
  return `/${kind}/${slug}`;
}

// --- view models -----------------------------------------------------------

export interface Sense {
  pos?: string;
  cefr?: string;
  meaning_vi: string;
  meaning_en?: string;
}
export interface Example {
  en: string;
  vi?: string;
  audio?: string;
}
export interface RelatedLink {
  term: string;
  href: string;
}
export interface FaqItem {
  q: string;
  a: string;
}

export interface Landing {
  kind: Kind;
  slug: string;
  path: string;
  canonical: string;
  // The primary card rendered exactly like a feed card at the top of the page.
  card: FeedCard;
  eyebrow: string; // human category shown as a chip
  term: string; // the display headword / phrase
  headline: string; // H1
  tldr: string; // 1-line answer (AEO)
  senses: Sense[];
  ipaUk?: string;
  ipaUs?: string;
  audioUk?: string;
  audioUs?: string;
  examples: Example[];
  quiz?: QuizContent;
  related: RelatedLink[];
  faq: FaqItem[];
  metaTitle: string;
  metaDescription: string;
}

interface CardRow {
  id: string;
  type: string;
  level: string;
  topic: string | null;
  content_json: string;
  audio_url: string | null;
  slug: string;
}

// Fields the per-kind builders produce; the rest (card, related, quiz, faq,
// canonical, path, slug, kind) are attached in getLanding.
type LandingBase = Omit<
  Landing,
  "card" | "related" | "quiz" | "faq" | "canonical" | "path" | "slug" | "kind"
>;

function clip(s: string, n: number): string {
  s = (s || "").replace(/\s+/g, " ").trim();
  return s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s;
}

// Fetch every published card sharing a (type, slug) so a page can aggregate
// senses. Ordered so the "primary" card (with audio / lower CEFR) tends first.
async function rowsFor(kind: Kind, slug: string): Promise<CardRow[]> {
  const type = KIND_TYPE[kind];
  return q<CardRow>(sql`
    SELECT id, type, level, topic, content_json, audio_url, slug
    FROM cards
    WHERE status = 'published' AND type = ${type} AND slug = ${slug}
    ORDER BY (audio_url IS NULL), id
    LIMIT 12`);
}

// Alphabetical neighbours → internal-linking "Related" block + crawl paths.
async function neighbours(
  kind: Kind,
  slug: string,
): Promise<RelatedLink[]> {
  const type = KIND_TYPE[kind];
  const after = await q<{ slug: string; content_json: string }>(sql`
    SELECT DISTINCT ON (slug) slug, content_json FROM cards
    WHERE status='published' AND type=${type} AND slug > ${slug}
    ORDER BY slug LIMIT 5`);
  const before = await q<{ slug: string; content_json: string }>(sql`
    SELECT DISTINCT ON (slug) slug, content_json FROM cards
    WHERE status='published' AND type=${type} AND slug < ${slug}
    ORDER BY slug DESC LIMIT 4`);
  return [...before.reverse(), ...after].map((r) => ({
    term: termOf(kind, r.content_json) || r.slug,
    href: pathFor(kind, r.slug),
  }));
}

function termOf(kind: Kind, contentJson: string): string {
  try {
    const c = JSON.parse(contentJson);
    if (kind === "word") return c.word || "";
    if (kind === "phrase") return c.text || "";
    return c.title || c.say || "";
  } catch {
    return "";
  }
}

async function relatedQuiz(slug: string): Promise<QuizContent | undefined> {
  const row = await q1<{ content_json: string }>(sql`
    SELECT content_json FROM cards
    WHERE status='published' AND type='quiz' AND id = ${"qz_vocab_" + slug}
    LIMIT 1`);
  if (!row) return undefined;
  try {
    return JSON.parse(row.content_json) as QuizContent;
  } catch {
    return undefined;
  }
}

// --- per-kind builders -----------------------------------------------------

function buildWord(slug: string, rows: CardRow[]): LandingBase {
  const contents = rows.map((r) => JSON.parse(r.content_json) as VocabContent);
  const first = contents[0];
  const term = first.word;
  const senses: Sense[] = contents.map((c) => ({
    pos: c.pos,
    cefr: c.cefr,
    meaning_vi: c.meaning_vi,
    meaning_en: c.meaning_en,
  }));
  const examples: Example[] = contents
    .filter((c) => c.example)
    .map((c) => ({ en: c.example, vi: c.example_vi, audio: c.example_audio }));
  const meanings = senses.map((s) => s.meaning_vi).filter(Boolean);
  const tldr = `"${term}" nghĩa là ${meanings.join("; ")}.`;
  return {
    eyebrow: KIND_LABEL.word,
    term,
    headline: `${term} nghĩa là gì?`,
    tldr,
    senses,
    ipaUk: first.ipa_uk || first.ipa,
    ipaUs: first.ipa_us || first.ipa,
    audioUk: first.audio_uk,
    audioUs: first.audio_us,
    examples,
    metaTitle: `${term} nghĩa là gì? Nghĩa, phát âm, ví dụ`,
    metaDescription: clip(
      `${term}${first.ipa_uk ? ` ${first.ipa_uk}` : ""} — ${tldr} Xem cách phát âm UK/US, ví dụ có audio và quiz kiểm tra.`,
      160,
    ),
  };
}

function buildPhrase(slug: string, rows: CardRow[]): LandingBase {
  const c = JSON.parse(rows[0].content_json) as ExpressionContent;
  const catLabel: Record<string, string> = {
    idiom: "Idiom",
    phrasal_verb: "Phrasal verb",
    daily_sentence: "Mẫu câu giao tiếp",
    crazy_english: "Mẫu câu",
    functional: "Mẫu câu giao tiếp",
  };
  const eyebrow = catLabel[c.category] || KIND_LABEL.phrase;
  const term = c.text;
  const tldr = `"${term}" nghĩa là ${c.meaning_vi}.`;
  const examples: Example[] = [];
  if (c.example) examples.push({ en: c.example, vi: c.example_vi, audio: c.example_audio });
  // Sentence-type cards ARE the example; give the audio a home too.
  const senses: Sense[] = [{ meaning_vi: c.meaning_vi, cefr: c.cefr }];
  return {
    eyebrow,
    term,
    headline: `${term} nghĩa là gì?`,
    tldr,
    senses,
    ipaUk: c.pronounce,
    ipaUs: c.pronounce,
    audioUk: c.audio || rows[0].audio_url || undefined,
    audioUs: undefined,
    examples,
    metaTitle: `"${term}" nghĩa là gì? Cách dùng & ví dụ`,
    metaDescription: clip(
      `${tldr} Nghĩa tiếng Việt, cách dùng, ví dụ${c.audio ? " có audio" : ""} và các mẫu câu liên quan.`,
      160,
    ),
  };
}

function buildGrammar(slug: string, rows: CardRow[]): LandingBase {
  const c = JSON.parse(rows[0].content_json) as GrammarContent;
  if (c.kind === "tip" || c.title) {
    const term = c.title || slug;
    const examples: Example[] = (c.examples || []).map((en, i) => ({
      en,
      vi: c.examples_vi?.[i],
    }));
    return {
      eyebrow: `Ngữ pháp${c.cefr ? " · " + c.cefr : ""}`,
      term,
      headline: term,
      tldr: c.explain_vi,
      senses: [{ meaning_vi: c.explain_vi, cefr: c.cefr }],
      examples,
      metaTitle: `${term} — ngữ pháp tiếng Anh (ví dụ)`,
      metaDescription: clip(`${c.explain_vi} Ví dụ thực tế và cách dùng.`, 160),
    };
  }
  // contrast: ❌ dont / ✅ say
  const term = c.say || slug;
  const tldr = `Nói đúng: "${c.say}" — không nói "${c.dont}". ${c.explain_vi}`;
  return {
    eyebrow: "Ngữ pháp · Sửa lỗi",
    term,
    headline: `"${c.dont}" hay "${c.say}"?`,
    tldr,
    senses: [{ meaning_vi: c.explain_vi, cefr: c.cefr }],
    examples: [{ en: c.say || "" }],
    metaTitle: `"${c.dont}" hay "${c.say}"? Cách nói đúng`,
    metaDescription: clip(tldr, 160),
  };
}

// --- FAQ (AEO) -------------------------------------------------------------

function buildFaq(v: { term: string; tldr: string; ipaUk?: string; examples: Example[]; kind: Kind }): FaqItem[] {
  const faq: FaqItem[] = [
    { q: `${v.term} nghĩa là gì?`, a: v.tldr },
  ];
  if (v.ipaUk) {
    faq.push({
      q: `${v.term} phát âm như thế nào?`,
      a: `Phiên âm: ${v.ipaUk}. Nghe audio phát âm chuẩn ngay trên trang.`,
    });
  }
  if (v.examples[0]?.en) {
    faq.push({
      q: `Ví dụ với "${v.term}"?`,
      a: v.examples[0].vi
        ? `${v.examples[0].en} (${v.examples[0].vi})`
        : v.examples[0].en,
    });
  }
  return faq;
}

// --- public API ------------------------------------------------------------

// Cached per request so the page, generateMetadata and the OG route share one
// DB round-trip.
export const getLanding = cache(_getLanding);

async function _getLanding(kind: Kind, slug: string): Promise<Landing | null> {
  const rows = await rowsFor(kind, slug);
  if (!rows.length) return null;

  const base =
    kind === "word"
      ? buildWord(slug, rows)
      : kind === "phrase"
        ? buildPhrase(slug, rows)
        : buildGrammar(slug, rows);

  const [related, quiz] = await Promise.all([
    neighbours(kind, slug),
    kind === "word" ? relatedQuiz(slug) : Promise.resolve(undefined),
  ]);

  const faq = buildFaq({ ...base, kind });

  // Primary card, shaped exactly like a feed card so the detail page reuses the
  // feed <Card>. Per-user state isn't hydrated here (it's a public entry point).
  const primary = rows[0];
  const card: FeedCard = {
    id: primary.id,
    type: primary.type as CardType,
    level: primary.level as Level,
    topic: primary.topic,
    content: JSON.parse(primary.content_json),
    audio_url: primary.audio_url,
    reacted: null,
    saved: false,
    answered: null,
  };

  return {
    ...base,
    kind,
    slug,
    path: pathFor(kind, slug),
    canonical: abs(pathFor(kind, slug)),
    card,
    related,
    quiz,
    faq,
  };
}

// A single published card by id, shaped like a feed card, for the universal
// /c/<id> permalink. Also returns its slug so the route can 301 SEO-typed cards
// to their keyword URL. Cached per request (metadata + page share one query).
export interface CardById {
  card: FeedCard;
  type: CardType;
  slug: string | null;
}
export const getCardById = cache(_getCardById);
async function _getCardById(id: string): Promise<CardById | null> {
  const row = await q1<CardRow>(sql`
    SELECT id, type, level, topic, content_json, audio_url, slug
    FROM cards WHERE id = ${id} AND status = 'published' LIMIT 1`);
  if (!row) return null;
  return {
    type: row.type as CardType,
    slug: row.slug || null,
    card: {
      id: row.id,
      type: row.type as CardType,
      level: row.level as Level,
      topic: row.topic,
      content: JSON.parse(row.content_json),
      audio_url: row.audio_url,
      reacted: null,
      saved: false,
      answered: null,
    },
  };
}

// Distinct published slugs for a kind (hub pages + sitemap). Ordered for stable
// pagination.
export async function listSlugs(
  kind: Kind,
  opts: { limit?: number; offset?: number; prefix?: string } = {},
): Promise<{ slug: string; term: string }[]> {
  const type = KIND_TYPE[kind];
  const limit = opts.limit ?? 500;
  const offset = opts.offset ?? 0;
  const prefix = opts.prefix
    ? sql`AND slug LIKE ${opts.prefix + "%"}`
    : sql``;
  const rows = await q<{ slug: string; content_json: string }>(sql`
    SELECT DISTINCT ON (slug) slug, content_json FROM cards
    WHERE status='published' AND type=${type} AND slug IS NOT NULL ${prefix}
    ORDER BY slug
    LIMIT ${limit} OFFSET ${offset}`);
  return rows.map((r) => ({ slug: r.slug, term: termOf(kind, r.content_json) || r.slug }));
}

// --- JSON-LD ---------------------------------------------------------------

export function jsonLd(l: Landing): object[] {
  const graph: object[] = [];

  graph.push({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "EngScroll", item: abs("/") },
      { "@type": "ListItem", position: 2, name: l.term, item: l.canonical },
    ],
  });

  if (l.kind === "word") {
    graph.push({
      "@context": "https://schema.org",
      "@type": "DefinedTerm",
      name: l.term,
      description: l.senses.map((s) => s.meaning_vi).join("; "),
      inDefinedTermSet: {
        "@type": "DefinedTermSet",
        name: "EngScroll — Từ điển tiếng Anh",
        url: abs("/"),
      },
      url: l.canonical,
    });
  }

  graph.push({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: l.faq.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  });

  return graph;
}

// Next Metadata for a landing page (canonical + OG + Twitter + dynamic image).
export function landingMetadata(l: Landing): Metadata {
  const image = `/api/og?kind=${l.kind}&slug=${encodeURIComponent(l.slug)}`;
  return {
    title: l.metaTitle,
    description: l.metaDescription,
    alternates: { canonical: l.path },
    openGraph: {
      type: "article",
      url: l.path,
      title: l.metaTitle,
      description: l.metaDescription,
      images: [{ url: image, width: 1200, height: 630, alt: l.term }],
    },
    twitter: {
      card: "summary_large_image",
      title: l.metaTitle,
      description: l.metaDescription,
      images: [image],
    },
  };
}
