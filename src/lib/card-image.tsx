import { ImageResponse } from "next/og";
import { BrandMark } from "./brand";
import type {
  CardType,
  CardContent,
  VocabContent,
  ExpressionContent,
  GrammarContent,
  QuoteContent,
  QuizContent,
  VideoContent,
} from "./types";

// Social image that mirrors the feed <Card> 1:1 — same chip, colours and layout —
// so "Tải ảnh" saves exactly what the learner sees. Width is fixed; the height
// fits the card content (the card sitting on the grey feed), instead of a forced
// square, so the download matches the on-screen proportions.
const IMG_W = 1080;
const OUTER_X = 24; // grey feed margin left/right
const OUTER_Y = 28; // grey feed margin top/bottom
const CARD_PAD = 56;
const CONTENT_W = IMG_W - 2 * OUTER_X - 2 * CARD_PAD; // usable text width
const EXBOX_INNER = CONTENT_W - 2 * 28; // example box has its own padding

const META: Record<CardType, { label: string; color: string; bg: string; icon: string[] }> = {
  vocab: {
    label: "Từ vựng",
    color: "#1877f2",
    bg: "#e7f0fe",
    icon: ["M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z", "M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"],
  },
  grammar: {
    label: "Ngữ pháp",
    color: "#e41e3f",
    bg: "#fdeaed",
    icon: ["m6 16 6-12 6 12", "M8 12h8", "m16 20 2 2 4-4"],
  },
  expression: {
    label: "Mẫu câu",
    color: "#ea7317",
    bg: "#fdf0e3",
    icon: [
      "M14 9a2 2 0 0 1-2 2H6l-4 4V4c0-1.1.9-2 2-2h8a2 2 0 0 1 2 2z",
      "M18 9h2a2 2 0 0 1 2 2v11l-4-4h-6a2 2 0 0 1-2-2v-1",
    ],
  },
  quiz: {
    label: "Quiz",
    color: "#8b5cf6",
    bg: "#f0ebfe",
    icon: ["M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3", "M12 17h.01", "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z"],
  },
  quote: {
    label: "Quote",
    color: "#0d9488",
    bg: "#e3f5f2",
    icon: ["M3 21c3 0 7-1 7-8V5c0-1.25-.75-2-2-2H4c-1.25 0-2 .75-2 2v6c0 1.25.75 2 2 2h3", "M15 21c3 0 7-1 7-8V5c0-1.25-.75-2-2-2h-4c-1.25 0-2 .75-2 2v6c0 1.25.75 2 2 2h3"],
  },
  video: {
    label: "Video",
    color: "#db2777",
    bg: "#fce7f1",
    icon: ["M6 3v18l14-9z"],
  },
};

const LIGHTBULB = ["M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5", "M9 18h6", "M10 22h4"];

const INK = "#050505";
const MUTED = "#65676b";
const HOVER = "#f0f2f5";
const BORDER = "#e4e6eb";

function Glyph({ paths, color, size }: { paths: string[]; color: string; size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}

function headline(text: string): number {
  if (text.length > 60) return 44;
  if (text.length > 32) return 56;
  if (text.length > 18) return 68;
  return 84;
}

function ExampleBox({ en, vi }: { en: string; vi?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", background: HOVER, borderRadius: 20, padding: "24px 28px", marginTop: 28 }}>
      <span style={{ fontSize: 38, fontStyle: "italic", color: INK }}>“{en}”</span>
      {vi ? <span style={{ fontSize: 30, color: MUTED, marginTop: 8 }}>{vi}</span> : null}
    </div>
  );
}

function Body({ type, content }: { type: CardType; content: CardContent }) {
  if (type === "vocab") {
    const c = content as VocabContent;
    const ipaUk = c.ipa_uk ?? c.ipa;
    return (
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 16 }}>
          <span style={{ fontSize: headline(c.word), fontWeight: 800, color: INK }}>{c.word}</span>
          {c.pos ? <span style={{ fontSize: 34, fontStyle: "italic", color: MUTED }}>{c.pos}</span> : null}
        </div>
        {ipaUk || c.ipa_us ? (
          <span style={{ fontSize: 34, color: MUTED, fontFamily: "monospace", marginTop: 12 }}>
            {ipaUk || c.ipa_us}
          </span>
        ) : null}
        <span style={{ fontSize: 44, color: INK, marginTop: 18 }}>{c.meaning_vi}</span>
        {c.example?.trim() ? <ExampleBox en={c.example} vi={c.example_vi} /> : null}
      </div>
    );
  }

  if (type === "expression") {
    const c = content as ExpressionContent;
    return (
      <div style={{ display: "flex", flexDirection: "column" }}>
        <span style={{ fontSize: headline(c.text), fontWeight: 800, color: INK }}>{c.text}</span>
        {c.pronounce ? <span style={{ fontSize: 32, color: MUTED, fontFamily: "monospace", marginTop: 10 }}>{c.pronounce}</span> : null}
        <span style={{ fontSize: 44, color: INK, marginTop: 18 }}>{c.meaning_vi}</span>
        {c.example ? <ExampleBox en={c.example} vi={c.example_vi} /> : null}
      </div>
    );
  }

  if (type === "grammar") {
    const c = content as GrammarContent;
    const isTip = c.kind === "tip" || (!c.dont && !c.say);
    if (isTip) {
      return (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {c.title ? <span style={{ fontSize: 28, fontWeight: 700, letterSpacing: 1, color: "#1877f2", textTransform: "uppercase", marginBottom: 12 }}>{c.title}</span> : null}
          <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
            <Glyph paths={LIGHTBULB} color="#f7b928" size={44} />
            <span style={{ fontSize: 46, fontWeight: 600, color: INK }}>{c.explain_vi}</span>
          </div>
          {c.examples?.[0] ? <ExampleBox en={c.examples[0]} vi={c.examples_vi?.[0]} /> : null}
        </div>
      );
    }
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, background: "#fdeaed", borderRadius: 20, padding: "22px 26px" }}>
          <Glyph paths={["M18 6 6 18", "m6 6 12 12"]} color="#e41e3f" size={40} />
          <span style={{ fontSize: 42, color: INK, textDecoration: "line-through" }}>{c.dont}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16, background: "#e6f4ea", borderRadius: 20, padding: "22px 26px" }}>
          <Glyph paths={["M20 6 9 17l-5-5"]} color="#31a24c" size={40} />
          <span style={{ fontSize: 42, color: INK, fontWeight: 600 }}>{c.say}</span>
        </div>
        <span style={{ fontSize: 34, color: MUTED }}>{c.explain_vi}</span>
      </div>
    );
  }

  if (type === "quote") {
    const c = content as QuoteContent;
    return (
      <div style={{ display: "flex", flexDirection: "column" }}>
        <span style={{ fontSize: headline(c.quote), fontWeight: 700, color: INK, lineHeight: 1.2 }}>“{c.quote}”</span>
        <span style={{ fontSize: 40, color: INK, marginTop: 18 }}>{c.meaning_vi}</span>
        {c.author ? <span style={{ fontSize: 32, fontWeight: 600, color: MUTED, marginTop: 12 }}>— {c.author}</span> : null}
      </div>
    );
  }

  if (type === "quiz") {
    const c = content as QuizContent;
    return (
      <div style={{ display: "flex", flexDirection: "column" }}>
        <span style={{ fontSize: 50, fontWeight: 700, color: INK }}>{c.question}</span>
        <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 26 }}>
          {c.options.slice(0, 4).map((opt, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", border: `2px solid ${BORDER}`, borderRadius: 16, padding: "18px 24px" }}>
              <span style={{ fontSize: 36, color: INK }}>{String.fromCharCode(65 + i)}. {opt}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const c = content as VideoContent;
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <span style={{ fontSize: headline(c.title), fontWeight: 800, color: INK }}>{c.title}</span>
      <span style={{ fontSize: 40, color: MUTED, marginTop: 16 }}>{c.meaning_vi}</span>
    </div>
  );
}

// --- height estimation, so the image fits the card instead of a forced square -
function estLines(text: string, fs: number, width: number): number {
  const len = String(text || "").length;
  const cpl = Math.max(1, Math.floor(width / (fs * 0.54)));
  return Math.max(1, Math.ceil(len / cpl));
}
function estText(text: string, fs: number, width: number, lh = 1.32): number {
  return estLines(text, fs, width) * fs * lh;
}
function estBox(en: string, vi?: string): number {
  return 28 + 48 + estText(en, 38, EXBOX_INNER, 1.35) + (vi ? 8 + estText(vi, 30, EXBOX_INNER) : 0);
}
function estimateBody(type: CardType, content: CardContent): number {
  try {
    if (type === "vocab") {
      const c = content as VocabContent;
      let h = headline(c.word) * 1.2;
      if (c.ipa_uk || c.ipa || c.ipa_us) h += 14 + 34 * 1.32;
      h += 18 + estText(c.meaning_vi, 44, CONTENT_W);
      if (c.example?.trim()) h += estBox(c.example, c.example_vi);
      return h;
    }
    if (type === "expression") {
      const c = content as ExpressionContent;
      let h = headline(c.text) * 1.2;
      if (c.pronounce) h += 10 + estText(c.pronounce, 32, CONTENT_W);
      h += 18 + estText(c.meaning_vi, 44, CONTENT_W);
      if (c.example) h += estBox(c.example, c.example_vi);
      return h;
    }
    if (type === "grammar") {
      const c = content as GrammarContent;
      const isTip = c.kind === "tip" || (!c.dont && !c.say);
      if (isTip) {
        let h = 0;
        if (c.title) h += 12 + 28 * 1.3;
        h += estText(c.explain_vi, 46, CONTENT_W - 60, 1.3);
        if (c.examples?.[0]) h += estBox(c.examples[0], c.examples_vi?.[0]);
        return h;
      }
      let h = 44 + estText(c.dont || "", 42, CONTENT_W - 60);
      h += 18 + 44 + estText(c.say || "", 42, CONTENT_W - 60);
      h += 18 + estText(c.explain_vi, 34, CONTENT_W);
      return h;
    }
    if (type === "quote") {
      const c = content as QuoteContent;
      let h = estText(c.quote, headline(c.quote), CONTENT_W, 1.2);
      h += 18 + estText(c.meaning_vi, 40, CONTENT_W);
      if (c.author) h += 12 + 32 * 1.3;
      return h;
    }
    if (type === "quiz") {
      const c = content as QuizContent;
      let h = estText(c.question, 50, CONTENT_W, 1.25) + 26;
      for (const o of c.options.slice(0, 4)) h += 36 + estText(o, 36, CONTENT_W - 48) + 14;
      return h;
    }
    const c = content as VideoContent;
    return headline(c.title) * 1.2 + 16 + estText(c.meaning_vi, 40, CONTENT_W);
  } catch {
    return 520;
  }
}

export function renderCardImage(
  type: CardType,
  content: CardContent,
  meta2: { level?: string | null; topic?: string | null } = {},
) {
  const meta = META[type] ?? META.vocab;
  const cefr = (content as { cefr?: string }).cefr;
  // Mirror the feed card's meta line exactly: cefr · level · topic.
  const sub = [cefr, meta2.level, meta2.topic].filter(Boolean).join(" · ");

  // Fit the image to the card: card padding + header + body + footer, plus the
  // grey feed margin. A small safety buffer avoids clipping tall content.
  const HEADER_H = 96 + 36;
  const FOOTER_H = 28 + 28 + 48; // marginTop + paddingTop + mark
  const bodyH = estimateBody(type, content) * 1.04 + 16;
  const cardH = CARD_PAD * 2 + HEADER_H + bodyH + FOOTER_H;
  const height = Math.round(Math.min(1500, Math.max(560, cardH + 2 * OUTER_Y)));

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          background: "#e9ebee",
          padding: `${OUTER_Y}px ${OUTER_X}px`,
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            width: "100%",
            background: "#ffffff",
            borderRadius: 32,
            border: `1px solid ${BORDER}`,
            boxShadow: "0 8px 30px rgba(0,0,0,0.08)",
            padding: CARD_PAD,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column" }}>
            {/* header — mirrors the feed card chip */}
            <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 36 }}>
              <div style={{ display: "flex", width: 96, height: 96, borderRadius: 9999, background: meta.bg, alignItems: "center", justifyContent: "center" }}>
                <Glyph paths={meta.icon} color={meta.color} size={48} />
              </div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: 36, fontWeight: 700, color: INK }}>{meta.label}</span>
                <span style={{ fontSize: 26, color: MUTED }}>{sub}</span>
              </div>
            </div>

            <Body type={type} content={content} />
          </div>

          {/* footer wordmark pinned to the card bottom */}
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 28, paddingTop: 28, borderTop: `1px solid ${BORDER}` }}>
            <BrandMark size={48} />
            <span style={{ fontSize: 30, fontWeight: 800, color: INK }}>
              <span style={{ color: "#1877f2" }}>Eng</span>Scroll
            </span>
            <span style={{ fontSize: 26, color: MUTED, marginLeft: "auto" }}>engscroll.com</span>
          </div>
        </div>
      </div>
    ),
    {
      width: IMG_W,
      height,
      headers: {
        "cache-control": "public, immutable, no-transform, max-age=2592000, s-maxage=2592000",
      },
    },
  );
}
