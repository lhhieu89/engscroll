"use client";

import { useEffect, useRef, useState } from "react";
import {
  ThumbsUp,
  Lightbulb,
  Bookmark,
  Volume2,
  Check,
  X,
  BookOpen,
  SpellCheck,
  CircleHelp,
  Quote as QuoteIcon,
  Play,
  MessagesSquare,
  MoreHorizontal,
  type LucideIcon,
} from "lucide-react";
import type {
  ExpressionContent,
  FeedCard,
  GrammarContent,
  QuizContent,
  QuoteContent,
  Reaction,
  VideoContent,
  VocabContent,
} from "@/lib/types";
import ShareStrip from "./ShareStrip";

export const TYPE_META: Record<
  FeedCard["type"],
  { label: string; Icon: LucideIcon; color: string; bg: string }
> = {
  vocab: { label: "Từ vựng", Icon: BookOpen, color: "#1877f2", bg: "#e7f0fe" },
  grammar: { label: "Ngữ pháp", Icon: SpellCheck, color: "#e41e3f", bg: "#fdeaed" },
  expression: { label: "Mẫu câu", Icon: MessagesSquare, color: "#ea7317", bg: "#fdf0e3" },
  quiz: { label: "Quiz", Icon: CircleHelp, color: "#8b5cf6", bg: "#f0ebfe" },
  quote: { label: "Quote", Icon: QuoteIcon, color: "#0d9488", bg: "#e3f5f2" },
  video: { label: "Video", Icon: Play, color: "#db2777", bg: "#fce7f1" },
};

// CEFR badge value for the card meta line — vocab/expression/grammar carry it.
function cefrOf(card: FeedCard): string | null {
  if (card.type === "vocab") return (card.content as VocabContent).cefr ?? null;
  if (card.type === "expression") return (card.content as ExpressionContent).cefr ?? null;
  if (card.type === "grammar") return (card.content as GrammarContent).cefr ?? null;
  return null;
}

// On-demand neural TTS endpoint — synthesises + caches server-side, no
// pre-generated files needed. Deterministic URL → cached by the browser.
function ttsUrl(text: string, lang = "en-US") {
  const v = lang === "en-GB" ? "en-GB" : "en-US";
  return `/api/tts?t=${encodeURIComponent(text.slice(0, 200))}&v=${v}`;
}

// Speak: play a hosted MP3 when one is given (Oxford word audio, icspeak
// sentence audio…), otherwise stream neural audio from /api/tts. The browser's
// robotic speechSynthesis is only the last-ditch fallback if the network fails.
function speak(text: string, src?: string, lang = "en-US") {
  if (typeof window === "undefined") return;
  const a = new Audio(src ?? ttsUrl(text, lang));
  a.play().catch(() => speakTTS(text, lang));
}

function speakTTS(text: string, lang: string) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang;
  u.rate = 0.95;
  window.speechSynthesis.speak(u);
}

function Speaker({
  text,
  src,
  lang,
  label,
  color,
}: {
  text: string;
  src?: string;
  lang?: string;
  label?: string;
  // Accent-distinguishing tint (UK vs US). Falls back to the app accent for
  // plain speakers (example sentence, legacy cards).
  color?: string;
}) {
  return (
    <button
      onClick={() => speak(text, src, lang)}
      aria-label={label ? `Nghe phát âm ${label}` : "Nghe phát âm"}
      className="icon-btn inline-flex h-8 shrink-0 items-center gap-1 px-1.5"
    >
      <Volume2 size={16} style={{ color: color ?? "var(--accent)" }} />
      {label && (
        <span
          className="text-[11px] font-semibold"
          style={{ color: color ?? "var(--muted)" }}
        >
          {label}
        </span>
      )}
    </button>
  );
}

// Region tints for the pronunciation buttons — warm amber vs cool teal. Chosen
// to be instantly distinguishable yet gender-neutral (deliberately NOT blue/pink
// so they don't read as "male voice / female voice").
const UK_COLOR = "#c2410c"; // amber-700
const US_COLOR = "#0f766e"; // teal-700

export interface CardProps {
  card: FeedCard;
  onReact?: (reaction: Reaction) => void;
  onSave?: () => void;
  onAnswer?: (
    selected: number,
  ) => Promise<{ is_correct: boolean; correct: number; explain_vi: string }>;
  // Hide the bottom react/save bar — used when the card is embedded elsewhere
  // (e.g. the review flow, which has its own grading controls).
  hideActions?: boolean;
}

export default function Card({ card, onReact, onSave, onAnswer, hideActions }: CardProps) {
  const [reacted, setReacted] = useState<Reaction | null>(card.reacted);
  const [saved, setSaved] = useState(card.saved);
  const [answer, setAnswer] = useState(card.answered ?? null);
  const [quizResult, setQuizResult] = useState<{
    correct: number;
    explain_vi: string;
  } | null>(null);

  const [shareOpen, setShareOpen] = useState(false);
  const shareRef = useRef<HTMLDivElement | null>(null);

  const meta = TYPE_META[card.type];
  const isQuiz = card.type === "quiz";
  const canReact = !isQuiz || answer !== null; // quiz unlocks after answering

  // Close the share strip on outside-click / Escape.
  useEffect(() => {
    if (!shareOpen) return;
    function onDown(e: MouseEvent) {
      if (shareRef.current && !shareRef.current.contains(e.target as Node)) {
        setShareOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setShareOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [shareOpen]);

  function react(r: Reaction) {
    // Toggle off if already active, otherwise set/switch (FB-style).
    setReacted((cur) => (cur === r ? null : r));
    onReact?.(r);
  }
  function toggleSave() {
    setSaved((s) => !s);
    onSave?.();
  }
  async function pick(i: number) {
    if (answer || !onAnswer) return;
    const res = await onAnswer(i);
    setAnswer({ selected: i, is_correct: res.is_correct });
    setQuizResult({ correct: res.correct, explain_vi: res.explain_vi });
  }

  return (
    <article className="post fade-up">
      {/* header */}
      <div className="flex items-center gap-2.5 px-4 pt-3">
        <span
          className="flex h-9 w-9 items-center justify-center rounded-full"
          style={{ background: meta.bg }}
        >
          <meta.Icon size={18} style={{ color: meta.color }} />
        </span>
        <div className="leading-tight">
          <div className="text-sm font-semibold">{meta.label}</div>
          <div className="text-xs text-[var(--muted)]">
            {[
              cefrOf(card),
              card.level,
              card.topic,
            ]
              .filter(Boolean)
              .join(" · ")}
          </div>
        </div>
      </div>

      {/* body */}
      <div className="px-4 pb-3 pt-3">
        {card.type === "vocab" && <VocabBody c={card.content as VocabContent} />}
        {card.type === "grammar" && <GrammarBody c={card.content as GrammarContent} />}
        {card.type === "expression" && <ExpressionBody c={card.content as ExpressionContent} />}
        {card.type === "quote" && <QuoteBody c={card.content as QuoteContent} />}
        {card.type === "video" && <VideoBody c={card.content as VideoContent} />}
        {card.type === "quiz" && (
          <QuizBody
            c={card.content as QuizContent}
            answer={answer}
            result={quizResult}
            onPick={pick}
          />
        )}
      </div>

      {/* action bar: reactions (OK/Mới) left, save + share on the right. The
          share strip reveals horizontally below the bar (Facebook-style). */}
      {!hideActions && (
        <div ref={shareRef} data-noexport>
          <div className="flex items-center justify-between border-t border-[var(--border)] px-2 py-1">
            <div className="flex items-center gap-1">
              <ActionBtn
                disabled={!canReact}
                active={reacted === "ok"}
                onClick={() => react("ok")}
                Icon={ThumbsUp}
                label="Biết rồi"
                activeColor="var(--accent)"
              />
              <ActionBtn
                disabled={!canReact}
                active={reacted === "new"}
                onClick={() => react("new")}
                Icon={Lightbulb}
                label="Mới biết"
                activeColor="var(--amber)"
              />
            </div>
            <div className="flex items-center gap-0.5">
              <ActionBtn
                active={saved}
                onClick={toggleSave}
                Icon={Bookmark}
                label={saved ? "Đã lưu" : "Lưu"}
                activeColor="var(--save)"
                fillWhenActive
              />
              <button
                onClick={() => setShareOpen((o) => !o)}
                aria-haspopup="true"
                aria-expanded={shareOpen}
                aria-label="Chia sẻ"
                className="flex items-center justify-center rounded-lg px-3 py-2 transition hover:bg-[var(--hover)]"
                style={{ color: shareOpen ? "var(--accent)" : "var(--muted)" }}
              >
                <MoreHorizontal size={19} />
              </button>
            </div>
          </div>
          {shareOpen && (
            <ShareStrip card={card} onDone={() => setShareOpen(false)} />
          )}
        </div>
      )}
    </article>
  );
}

function ActionBtn({
  active,
  disabled,
  onClick,
  Icon,
  label,
  activeColor,
  fillWhenActive,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  Icon: LucideIcon;
  label: string;
  activeColor: string;
  fillWhenActive?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition hover:bg-[var(--hover)] disabled:cursor-default disabled:opacity-40"
      style={{ color: active ? activeColor : "var(--muted)" }}
    >
      <Icon
        size={19}
        className={active ? "pop" : ""}
        fill={active && fillWhenActive ? activeColor : "none"}
      />
      {label}
    </button>
  );
}

// ----- per-type bodies -----------------------------------------------------

function VocabBody({ c }: { c: VocabContent }) {
  const ipaUk = c.ipa_uk ?? c.ipa;
  const ipaUs = c.ipa_us;
  return (
    <div>
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <h2 className="text-2xl font-bold">{c.word}</h2>
        {c.pos && (
          <span className="text-sm italic text-[var(--muted)]">{c.pos}</span>
        )}
      </div>
      {/* Pronunciation row: UK & US IPA each with its own native-audio button. */}
      <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[var(--muted)]">
        {ipaUk && (
          <span className="inline-flex items-center gap-1">
            <span className="font-mono">{ipaUk}</span>
            <Speaker
              text={c.word}
              src={c.audio_uk}
              lang="en-GB"
              label="UK"
              color={UK_COLOR}
            />
          </span>
        )}
        {ipaUs && ipaUs !== ipaUk && (
          <span className="inline-flex items-center gap-1">
            <span className="font-mono">{ipaUs}</span>
            <Speaker
              text={c.word}
              src={c.audio_us}
              lang="en-US"
              label="US"
              color={US_COLOR}
            />
          </span>
        )}
        {/* Same IPA for both accents but distinct audio: show one US button. */}
        {ipaUs && ipaUs === ipaUk && c.audio_us && (
          <Speaker
            text={c.word}
            src={c.audio_us}
            lang="en-US"
            label="US"
            color={US_COLOR}
          />
        )}
        {/* Legacy cards with no IPA/audio at all still get a speaker. */}
        {!ipaUk && !ipaUs && <Speaker text={c.word} />}
      </div>
      <div className="mb-3 text-base">{c.meaning_vi}</div>
      {/* Many Oxford entries (numbers, function words…) ship no example — only
          render the example box when there's an actual sentence. */}
      {c.example?.trim() && (
        <div className="rounded-xl bg-[var(--hover)] p-3">
          <div className="flex items-center gap-2">
            <p className="italic">“{c.example}”</p>
            <Speaker text={c.example} src={c.example_audio} />
          </div>
          {c.example_vi && (
            <p className="mt-1 text-sm text-[var(--muted)]">{c.example_vi}</p>
          )}
        </div>
      )}
    </div>
  );
}

function ExpressionBody({ c }: { c: ExpressionContent }) {
  return (
    <div>
      <div className="mb-1 flex items-center gap-2">
        <h2 className="text-xl font-bold">{c.text}</h2>
        {/* Sentence sets have their own real MP3; functional chunks fall back to TTS. */}
        <Speaker text={c.text} src={c.audio} />
      </div>
      {c.pronounce && (
        <div className="mb-2 font-mono text-sm text-[var(--muted)]">
          {c.pronounce}
        </div>
      )}
      <div className="mb-3 text-base">{c.meaning_vi}</div>
      {c.example && (
        <div className="rounded-xl bg-[var(--hover)] p-3">
          <div className="flex items-center gap-2">
            <p className="italic">“{c.example}”</p>
            <Speaker text={c.example} src={c.example_audio} />
          </div>
          {c.example_vi && (
            <p className="mt-1 text-sm text-[var(--muted)]">{c.example_vi}</p>
          )}
        </div>
      )}
    </div>
  );
}

function GrammarBody({ c }: { c: GrammarContent }) {
  // Tip cards (EGP can-do + real examples) render differently from the ❌→✅
  // contrast pair.
  if (c.kind === "tip" || (!c.dont && !c.say)) {
    return (
      <div>
        {c.title && (
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--accent)]">
            {c.title}
          </div>
        )}
        <div className="mb-3 flex items-start gap-2">
          <Lightbulb size={18} className="mt-0.5 shrink-0 text-[var(--amber)]" />
          <p className="text-base font-medium">{c.explain_vi}</p>
        </div>
        {c.examples && c.examples.length > 0 && (
          <div className="flex flex-col gap-2">
            {c.examples.map((ex, i) => (
              <div key={i} className="rounded-xl bg-[var(--hover)] p-3">
                <div className="flex items-center gap-2">
                  <p className="italic">“{ex}”</p>
                  <Speaker text={ex} />
                </div>
                {c.examples_vi?.[i] && (
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    {c.examples_vi[i]}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-start gap-2 rounded-xl bg-[#fdeaed] p-3">
        <X size={18} className="mt-0.5 shrink-0 text-[var(--red)]" />
        <span className="text-base line-through decoration-[var(--red)]/50">
          {c.dont}
        </span>
      </div>
      <div className="flex items-start gap-2 rounded-xl bg-[#e6f4ea] p-3">
        <Check size={18} className="mt-0.5 shrink-0 text-[var(--green)]" />
        <span className="text-base font-medium">{c.say}</span>
      </div>
      <p className="text-sm text-[var(--muted)]">{c.explain_vi}</p>
    </div>
  );
}

function QuoteBody({ c }: { c: QuoteContent }) {
  return (
    <div>
      <div className="mb-2 flex items-start gap-2">
        <h2 className="text-xl font-semibold leading-snug">“{c.quote}”</h2>
        <Speaker text={c.quote} />
      </div>
      <div className="text-base">{c.meaning_vi}</div>
      {c.author && (
        <p className="mt-1 text-sm font-medium text-[var(--muted)]">
          — {c.author}
        </p>
      )}
      {c.context_vi && (
        <p className="mt-2 text-sm text-[var(--muted)]">{c.context_vi}</p>
      )}
    </div>
  );
}

// Turn a pasted YouTube / TikTok / Facebook / Instagram / Vimeo link into an
// embeddable iframe src. `vertical` marks 9:16 clips (Shorts/TikTok/Reels).
function videoEmbed(url?: string): { src: string; vertical: boolean } | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    if (host === "youtu.be") {
      const id = u.pathname.slice(1);
      return id ? { src: `https://www.youtube-nocookie.com/embed/${id}`, vertical: false } : null;
    }
    if (host.endsWith("youtube.com")) {
      let id = u.searchParams.get("v");
      let vertical = false;
      const shorts = u.pathname.match(/^\/shorts\/([^/]+)/);
      const embed = u.pathname.match(/^\/embed\/([^/]+)/);
      if (shorts) { id = shorts[1]; vertical = true; }
      else if (embed) id = embed[1];
      return id ? { src: `https://www.youtube-nocookie.com/embed/${id}`, vertical } : null;
    }
    if (host.endsWith("vimeo.com")) {
      const id = u.pathname.split("/").filter(Boolean)[0];
      return /^\d+$/.test(id) ? { src: `https://player.vimeo.com/video/${id}`, vertical: false } : null;
    }
    if (host.endsWith("tiktok.com")) {
      const m = u.pathname.match(/\/video\/(\d+)/);
      return m ? { src: `https://www.tiktok.com/embed/v2/${m[1]}`, vertical: true } : null;
    }
    if (host.endsWith("instagram.com")) {
      const m = u.pathname.match(/\/(p|reel|tv)\/([^/]+)/);
      return m ? { src: `https://www.instagram.com/${m[1]}/${m[2]}/embed`, vertical: true } : null;
    }
    if (host.endsWith("facebook.com") || host === "fb.watch") {
      return {
        src: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=false`,
        vertical: false,
      };
    }
    return null;
  } catch {
    return null;
  }
}

function VideoBody({ c }: { c: VideoContent }) {
  const embed = videoEmbed(c.url);
  return (
    <div>
      {embed ? (
        <div
          className={`mb-3 w-full overflow-hidden rounded-xl bg-black ${
            embed.vertical ? "mx-auto aspect-[9/16] max-w-[300px]" : "aspect-video"
          }`}
        >
          <iframe
            src={embed.src}
            title={c.title}
            className="h-full w-full"
            allow="autoplay; encrypted-media; picture-in-picture; clipboard-write; fullscreen"
            allowFullScreen
            loading="lazy"
          />
        </div>
      ) : c.src ? (
        <video
          src={c.src}
          poster={c.poster}
          controls
          playsInline
          preload="metadata"
          className="mb-3 max-h-[46vh] w-full rounded-xl bg-black"
        />
      ) : c.url ? (
        <a
          href={c.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mb-3 block rounded-xl bg-[var(--hover)] p-3 text-sm text-[var(--accent)]"
        >
          ▶ Mở video ({new URL(c.url).hostname.replace(/^www\./, "")})
        </a>
      ) : null}
      <h2 className="text-lg font-bold">{c.title}</h2>
      <p className="mt-1 text-[var(--muted)]">{c.meaning_vi}</p>
    </div>
  );
}

function QuizBody({
  c,
  answer,
  result,
  onPick,
}: {
  c: QuizContent;
  answer: { selected: number; is_correct: boolean } | null;
  result: { correct: number; explain_vi: string } | null;
  onPick: (i: number) => void;
}) {
  const correctIdx = result?.correct ?? (answer ? c.correct : -1);
  return (
    <div>
      <h2 className="mb-3 text-lg font-semibold">{c.question}</h2>
      <div className="flex flex-col gap-2">
        {c.options.map((opt, i) => {
          const chosen = answer?.selected === i;
          const isCorrect = answer !== null && i === correctIdx;
          const isWrongPick = chosen && !answer?.is_correct;
          let cls = "border-[var(--border)] bg-white hover:bg-[var(--hover)]";
          if (answer !== null) {
            if (isCorrect) cls = "border-[var(--green)] bg-[#e6f4ea]";
            else if (isWrongPick) cls = "border-[var(--red)] bg-[#fdeaed]";
            else cls = "border-[var(--border)] bg-white opacity-60";
          }
          return (
            <button
              key={i}
              onClick={() => onPick(i)}
              disabled={answer !== null}
              className={`flex items-center justify-between rounded-xl border px-3.5 py-2.5 text-left transition ${cls}`}
            >
              <span>{opt}</span>
              {answer !== null && isCorrect && (
                <Check size={18} className="text-[var(--green)]" />
              )}
              {isWrongPick && <X size={18} className="text-[var(--red)]" />}
            </button>
          );
        })}
      </div>
      {answer !== null && (
        <p className="fade-up mt-3 text-sm text-[var(--muted)]">
          {answer.is_correct ? "Chính xác! " : "Chưa đúng. "}
          {result?.explain_vi ?? c.explain_vi}
        </p>
      )}
    </div>
  );
}
