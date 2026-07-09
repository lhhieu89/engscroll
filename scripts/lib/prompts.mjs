// Standard content-generation prompts + JSON schemas for EngScroll.
// Based on the user's 5 canonical prompts (vocab / mini_quiz / grammar_tip /
// quote / video_script), adapted to emit app-native `content` fields directly
// (so generated cards render without a lossy adapter) plus a `react_hint`.
//
// Model: claude-opus-4-8. Output is forced to JSON via structured outputs.

export const LEVELS = ["A2", "B1", "B2"];
export const TOPICS = [
  "đời sống",
  "công việc",
  "giao tiếp",
  "mạng xã hội",
  "phim ảnh",
  "suy nghĩ",
];

// A2/B1/B2 (CEFR, used in the prompts) → app levels.
export const LEVEL_MAP = { A2: "basic", B1: "intermediate", B2: "advanced" };

// user's card_type → app card type.
export const TYPE_MAP = {
  vocab: "vocab",
  mini_quiz: "quiz",
  grammar_tip: "grammar",
  quote: "quote",
  video_script: "video",
};
// reverse: app type → generator card_type
export const APP_TO_GEN = {
  vocab: "vocab",
  quiz: "mini_quiz",
  grammar: "grammar_tip",
  quote: "quote",
  video: "video_script",
};

// Standard react_hint defaults per type (from the user's prompt spec).
export const REACT_HINTS = {
  vocab: { ok_reason: "User already knows or uses this", new_reason: "User sees this for the first time" },
  quiz: { ok_reason: "User chose correctly or found it easy", new_reason: "User learned something new" },
  grammar: { ok_reason: "User already avoids this mistake", new_reason: "User realizes a new mistake" },
  quote: { ok_reason: "User likes or already uses this kind of sentence", new_reason: "User wants to remember and reuse this" },
  video: { ok_reason: "User understood it easily", new_reason: "User found it new or fast" },
};

const reactHintSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    ok_reason: { type: "string" },
    new_reason: { type: "string" },
  },
  required: ["ok_reason", "new_reason"],
};

function arrayOf(cardSchema) {
  return {
    type: "object",
    additionalProperties: false,
    properties: { cards: { type: "array", items: cardSchema } },
    required: ["cards"],
  };
}

const COMMON = `You are an English content creator for a Vietnamese social-learning app (vibe: scroll a feed, react 👍 OK / 🆕 New).
Rules for EVERY card:
- Real, natural English that native speakers actually use in daily life. NOT textbook/academic.
- Short — readable in 5-7 seconds.
- Vietnamese meanings must be short, natural, and correct (no machine-translationese).
- Each card teaches exactly ONE small "aha". No card repeats another.
Output JSON only (no prose) matching the schema: an object { "cards": [ ... ] }.`;

// --- per-type specs --------------------------------------------------------

export const SPECS = {
  vocab: {
    genType: "vocab",
    schema: arrayOf({
      type: "object",
      additionalProperties: false,
      properties: {
        word: { type: "string" },
        ipa: { type: "string" },
        meaning_vi: { type: "string" },
        example: { type: "string" },
        example_vi: { type: "string" },
        usage_note: { type: "string" },
        react_hint: reactHintSchema,
      },
      required: ["word", "ipa", "meaning_vi", "example", "example_vi", "usage_note", "react_hint"],
    }),
    prompt: (n, level, topic) => `${COMMON}
Generate ${n} DISTINCT English vocabulary/idiom/phrasal-verb cards.
Level: ${level}. Topic: ${topic}.
For each card:
- "word": the word or phrase (commonly used by natives, not a basic textbook word)
- "ipa": IPA pronunciation
- "meaning_vi": short Vietnamese meaning
- "example": ONE short natural sentence using it
- "example_vi": Vietnamese translation of the example
- "usage_note": a 1-line English note on when/how to use it
- "react_hint": { "ok_reason", "new_reason" }`,
  },

  quiz: {
    genType: "mini_quiz",
    schema: arrayOf({
      type: "object",
      additionalProperties: false,
      properties: {
        question: { type: "string" },
        options: { type: "array", items: { type: "string" } },
        correct: { type: "integer" },
        explain_vi: { type: "string" },
        react_hint: reactHintSchema,
      },
      required: ["question", "options", "correct", "explain_vi", "react_hint"],
    }),
    prompt: (n, level, topic) => `${COMMON}
Generate ${n} DISTINCT mini English quiz cards for fast scrolling.
Level: ${level}. Topic: ${topic}.
Rules: very short question; 2-4 options; EXACTLY ONE correct answer; distractors must be plausible (not silly); useful for daily English.
For each card:
- "question": the short question
- "options": array of 2-4 answer strings
- "correct": the 0-based index of the correct option
- "explain_vi": 1-line Vietnamese explanation of why it's correct
- "react_hint": { "ok_reason", "new_reason" }`,
  },

  grammar: {
    genType: "grammar_tip",
    schema: arrayOf({
      type: "object",
      additionalProperties: false,
      properties: {
        dont: { type: "string" },
        say: { type: "string" },
        explain_vi: { type: "string" },
        react_hint: reactHintSchema,
      },
      required: ["dont", "say", "explain_vi", "react_hint"],
    }),
    prompt: (n, level, topic) => `${COMMON}
Generate ${n} DISTINCT grammar tips, each based on ONE common mistake made by Vietnamese English learners.
Level: ${level}. Topic: ${topic}.
Rules: focus on ONE mistake only; show wrong vs right clearly; simple language; no grammar jargon; no exceptions/edge cases.
For each card:
- "dont": the WRONG sentence a learner might say
- "say": the CORRECT version
- "explain_vi": 1-line Vietnamese rule explanation
- "react_hint": { "ok_reason", "new_reason" }`,
  },

  quote: {
    genType: "quote",
    schema: arrayOf({
      type: "object",
      additionalProperties: false,
      properties: {
        quote: { type: "string" },
        meaning_vi: { type: "string" },
        context_vi: { type: "string" },
        react_hint: reactHintSchema,
      },
      required: ["quote", "meaning_vi", "context_vi", "react_hint"],
    }),
    prompt: (n, level, topic) => `${COMMON}
Generate ${n} DISTINCT short, meaningful English sentences/quotes people can actually reuse in real life or social media.
Level: ${level}. Topic: ${topic}.
Rules: sounds natural (spoken or written); ≤ 90 characters; NOT a famous attributed quote; usable in real conversation.
For each card:
- "quote": the sentence
- "meaning_vi": short Vietnamese meaning
- "context_vi": 1-line Vietnamese note on when to use it
- "react_hint": { "ok_reason", "new_reason" }`,
  },

  video: {
    genType: "video_script",
    schema: arrayOf({
      type: "object",
      additionalProperties: false,
      properties: {
        title: { type: "string" },
        meaning_vi: { type: "string" },
        script_en: { type: "string" },
        context_vi: { type: "string" },
        react_hint: reactHintSchema,
      },
      required: ["title", "meaning_vi", "script_en", "context_vi", "react_hint"],
    }),
    prompt: (n, level, topic) => `${COMMON}
Generate ${n} DISTINCT short spoken-English scripts suitable for a 10-15 second video.
Level: ${level}. Topic: ${topic}.
Rules: conversational tone; 1-2 sentences max; a common daily situation; no slang overload.
For each card:
- "title": a short English title/phrase for the clip
- "meaning_vi": short Vietnamese meaning/summary
- "script_en": the 1-2 sentence spoken script
- "context_vi": 1-line Vietnamese note on the situation
- "react_hint": { "ok_reason", "new_reason" }
NOTE: these are scripts only — a real creator-permitted video clip (src) is attached by a human before publishing.`,
  },
};

// Map a generated raw card (app-native fields) → the app's content_json object.
// Video keeps the script; `src` is left null until a human attaches a clip.
export function toAppContent(appType, raw) {
  switch (appType) {
    case "vocab":
      return {
        word: raw.word,
        ipa: raw.ipa || undefined,
        meaning_vi: raw.meaning_vi,
        example: raw.example,
        example_vi: raw.example_vi || undefined,
        usage_note: raw.usage_note || undefined,
        react_hint: raw.react_hint,
      };
    case "grammar":
      return { dont: raw.dont, say: raw.say, explain_vi: raw.explain_vi, react_hint: raw.react_hint };
    case "quiz":
      return {
        question: raw.question,
        options: raw.options,
        correct: raw.correct,
        explain_vi: raw.explain_vi,
        react_hint: raw.react_hint,
      };
    case "quote":
      return { quote: raw.quote, meaning_vi: raw.meaning_vi, context_vi: raw.context_vi || undefined, react_hint: raw.react_hint };
    case "video":
      return {
        src: null,
        title: raw.title,
        meaning_vi: raw.meaning_vi,
        script_en: raw.script_en,
        context_vi: raw.context_vi || undefined,
        react_hint: raw.react_hint,
      };
    default:
      return raw;
  }
}

// Normalized dedup key. For quiz, the question text alone isn't distinguishing
// (e.g. many share "Which is correct?"), so fold in the correct answer.
export function dedupKey(appType, content) {
  let t = content.word || content.say || content.question || content.quote || content.title || "";
  if (appType === "quiz" && Array.isArray(content.options))
    t += " || " + (content.options[content.correct] ?? "");
  return `${appType}:${String(t).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()}`;
}
