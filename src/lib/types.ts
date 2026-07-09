export type CardType =
  | "vocab"
  | "grammar"
  | "expression"
  | "quiz"
  | "quote"
  | "video";
export type Level = "basic" | "intermediate" | "advanced";
export type CardStatus = "draft" | "published" | "rejected";
export type Reaction = "ok" | "new";

// --- content_json shapes, one per card type -------------------------------

// CEFR level of a word, per the Oxford 3000/5000 / English Vocabulary Profile.
export type CefrLevel = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";

export interface VocabContent {
  word: string;
  pos?: string; // part of speech, e.g. "verb", "noun"
  cefr?: CefrLevel; // Oxford/EVP level; drives the level badge for imported words
  // `ipa` is kept for legacy hand-made cards; Oxford imports use ipa_uk/ipa_us.
  ipa?: string;
  ipa_uk?: string;
  ipa_us?: string;
  // Word-pronunciation audio. Oxford imports point at the dictionary's hosted
  // MP3s (real human voices); may be absent for legacy cards.
  audio_uk?: string;
  audio_us?: string;
  meaning_vi: string;
  meaning_en?: string; // English definition (Oxford)
  example: string;
  example_vi?: string;
  // Neural TTS (Edge TTS) MP3 for the example sentence, served from /audio/ex/.
  example_audio?: string;
}

// Grammar cards come in two shapes, told apart by `kind`:
//   - "contrast" (default): a ❌ Don't / ✅ Say pair (engaging error correction).
//   - "tip": an English Grammar Profile can-do statement + real examples
//     (authentic reference content, no fabricated error).
export interface GrammarContent {
  kind?: "contrast" | "tip";
  explain_vi: string; // contrast: 1-line reason · tip: the can-do statement (VN)
  // contrast fields
  dont?: string; // ❌ Don't say
  say?: string; //  ✅ Say
  // tip fields
  title?: string; // EGP guideword, e.g. "PAST SIMPLE"
  examples?: string[]; // real EGP example sentences
  examples_vi?: string[]; // their Vietnamese translations
  cefr?: CefrLevel; // grounded on the English Grammar Profile level
  category?: string; // EGP category, e.g. "VERBS", "ADJECTIVES"
  source?: string; // provenance: "curated" | "egp" | "user:<id>"
}

// A multi-word expression the learner acquires as a chunk. One flexible type
// covers several `category` values so future sets (idioms, everyday sentences,
// phrasal verbs) slot in without a new card type or UI:
//   - "functional"     → communicative chunks (Cambridge functional language)
//   - "idiom"          → idiomatic expressions (future)
//   - "daily_sentence" → ready-to-use everyday sentences (future)
export interface ExpressionContent {
  text: string; // the chunk/phrase/sentence itself
  meaning_vi: string;
  category: string; // discriminator, see above
  cefr?: CefrLevel;
  // Sentence sets (daily_sentence / crazy_english) carry whole-sentence
  // phonetics + their own real audio; `text` IS the content, no example.
  pronounce?: string; // IPA of the whole sentence
  audio?: string; // hosted MP3 of the sentence itself
  // Functional chunks illustrate usage with an example instead.
  example?: string;
  example_vi?: string;
  example_audio?: string; // optional neural TTS for the example
  fn?: string; // communicative function label (functional), e.g. "opinion"
  register?: string; // "neutral" | "formal" | "informal"
  source?: string;
}

export interface QuizContent {
  question: string;
  options: string[]; // 3–4 choices
  correct: number; // index into options
  explain_vi: string; // 1-line explanation shown after answering
}

export interface QuoteContent {
  quote: string;
  meaning_vi: string;
  context_vi?: string;
  author?: string; // attribution, e.g. "Nelson Mandela"
  source?: string; // provenance, e.g. "wikiquote" | "curated" | "user:<id>"
}

// A short video takeaway. Either self-hosted (`src`) OR an embedded clip pasted
// from YouTube / TikTok / Facebook / Instagram / Vimeo (`url`). At least one of
// `src` / `url` should be present; the renderer prefers `url` when embeddable.
export interface VideoContent {
  title: string;
  meaning_vi: string;
  url?: string; // external clip link (youtube/tiktok/facebook/instagram/vimeo)
  src?: string; // self-hosted mp4/webm URL (creator-permitted)
  poster?: string;
  source?: string;
}

export type CardContent =
  | VocabContent
  | GrammarContent
  | ExpressionContent
  | QuizContent
  | QuoteContent
  | VideoContent;

// --- API-facing card shape -------------------------------------------------

export interface FeedCard {
  id: string;
  type: CardType;
  level: Level;
  topic: string | null;
  content: CardContent;
  audio_url: string | null;
  // Per-user state hydrated into the feed payload:
  reacted: Reaction | null;
  saved: boolean;
  answered?: { selected: number; is_correct: boolean } | null;
}

// Phase-1 ratio was 40/25/20/15 (vocab/grammar/quiz/quote). Phase 2 folds in a
// light sprinkle of video without disturbing the relative mix.
export const FEED_RATIO: Record<CardType, number> = {
  vocab: 0.34,
  grammar: 0.2,
  expression: 0.16,
  quiz: 0.16,
  quote: 0.1,
  video: 0.04,
};
