"use client";

import Card from "./Card";
import type { FeedCard, Reaction } from "@/lib/types";

// Renders a single card exactly like the feed does — same component, same
// react / save / quiz wiring — so a landing page's detail card behaves like a
// feed card (the visitor already has an anon session via proxy.ts).
export default function DetailCard({ card }: { card: FeedCard }) {
  async function react(reaction: Reaction) {
    await fetch("/api/react", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ cardId: card.id, reaction }),
    }).catch(() => {});
  }
  async function save() {
    await fetch("/api/save", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ cardId: card.id }),
    }).catch(() => {});
  }
  async function answer(selected: number) {
    const res = await fetch("/api/quiz", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ cardId: card.id, selected }),
    });
    return res.json();
  }

  return (
    <Card card={card} onReact={react} onSave={save} onAnswer={answer} />
  );
}
