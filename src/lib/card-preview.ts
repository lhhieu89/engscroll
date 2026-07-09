import type { CardContent } from "./types";

// One-line title/subtitle for a card, used by the collapsed rows on the Saved
// and Activity pages. Each card type stores its headline under a different key.
export function cardTitle(content: CardContent): string {
  const c = content as unknown as Record<string, unknown>;
  return String(
    c.word ?? c.text ?? c.quote ?? c.say ?? c.question ?? c.title ?? "",
  );
}

export function cardSubtitle(content: CardContent): string {
  const c = content as unknown as Record<string, unknown>;
  return String(c.meaning_vi ?? c.explain_vi ?? c.context_vi ?? "");
}
