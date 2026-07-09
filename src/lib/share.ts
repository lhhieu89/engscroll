import type {
  FeedCard,
  VocabContent,
  ExpressionContent,
  GrammarContent,
  QuoteContent,
  QuizContent,
  VideoContent,
} from "./types";

// Client-safe share metadata for a feed card. Mirrors scripts/backfill-slugs.mjs
// so the computed landing path matches the SEO page's real URL.
function slugify(s: string): string {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export interface ShareInfo {
  eyebrow: string;
  title: string; // headword / phrase used in the share image
  text: string; // copy / share text
  path: string; // landing page path, or "/" when the card has no SEO page
  imagePath: string; // /api/og image URL (relative)
  imageName: string; // download filename (no extension)
}

const LABEL: Record<string, string> = {
  vocab: "Từ vựng",
  expression: "Mẫu câu",
  grammar: "Ngữ pháp",
  quiz: "Quiz",
  quote: "Quote",
  video: "Video",
};

// Build the /api/og freeform URL. Kept short; the route clamps lengths.
function ogFreeform(eyebrow: string, title: string, subtitle?: string): string {
  const p = new URLSearchParams({ eyebrow, title });
  if (subtitle) p.set("subtitle", subtitle);
  return `/api/og?${p.toString()}`;
}

export function shareInfoFor(card: FeedCard): ShareInfo {
  const eyebrow = LABEL[card.type] ?? "EngScroll";

  if (card.type === "vocab") {
    const c = card.content as VocabContent;
    const slug = slugify(c.word);
    return {
      eyebrow: "Từ vựng",
      title: c.word,
      text: `"${c.word}" nghĩa là ${c.meaning_vi}${c.example ? `\n\nVí dụ: ${c.example}` : ""}`,
      path: `/word/${slug}`,
      imagePath: `/api/og?kind=word&slug=${encodeURIComponent(slug)}`,
      imageName: slug,
    };
  }

  if (card.type === "expression") {
    const c = card.content as ExpressionContent;
    const slug = slugify(c.text);
    return {
      eyebrow,
      title: c.text,
      text: `"${c.text}" nghĩa là ${c.meaning_vi}`,
      path: `/phrase/${slug}`,
      imagePath: `/api/og?kind=phrase&slug=${encodeURIComponent(slug)}`,
      imageName: slug,
    };
  }

  if (card.type === "grammar") {
    const c = card.content as GrammarContent;
    const isTip = c.kind === "tip" || (!c.dont && !c.say);
    const title = isTip ? c.title || c.explain_vi : c.say || "";
    const slug = slugify(title);
    const text = isTip
      ? `${c.title ? c.title + ": " : ""}${c.explain_vi}`
      : `Nói đúng: "${c.say}" (không phải "${c.dont}") — ${c.explain_vi}`;
    return {
      eyebrow: "Ngữ pháp",
      title,
      text,
      path: `/grammar/${slug}`,
      imagePath: `/api/og?kind=grammar&slug=${encodeURIComponent(slug)}`,
      imageName: slug,
    };
  }

  // Types without a dedicated SEO landing page → share the app + a freeform
  // image built straight from the card content.
  if (card.type === "quote") {
    const c = card.content as QuoteContent;
    return {
      eyebrow: "Quote",
      title: c.quote,
      text: `"${c.quote}"${c.author ? ` — ${c.author}` : ""}\n${c.meaning_vi}`,
      path: "/",
      imagePath: ogFreeform("Quote", c.quote, c.author ? `— ${c.author}` : c.meaning_vi),
      imageName: slugify(c.quote) || "engscroll",
    };
  }

  if (card.type === "quiz") {
    const c = card.content as QuizContent;
    return {
      eyebrow: "Quiz",
      title: c.question,
      text: `${c.question}\n${c.options.map((o, i) => `${String.fromCharCode(65 + i)}. ${o}`).join("\n")}`,
      path: "/",
      imagePath: ogFreeform("Quiz", c.question, "Học tiếng Anh bằng cách lướt"),
      imageName: slugify(c.question) || "quiz",
    };
  }

  const c = card.content as VideoContent;
  return {
    eyebrow,
    title: c.title,
    text: `${c.title}\n${c.meaning_vi}`,
    path: "/",
    imagePath: ogFreeform(eyebrow, c.title, c.meaning_vi),
    imageName: slugify(c.title) || "engscroll",
  };
}
