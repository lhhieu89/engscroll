"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import Card from "./Card";
import type { FeedCard, Reaction } from "@/lib/types";

async function postJson(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json().catch(() => null);
}

/**
 * A collapsed one-line row that expands into the EXACT same card the feed
 * renders — same layout, same audio, same reaction/save/quiz actions. Used by
 * the Saved and Activity pages so every surface shares one card style.
 *
 * `summary` is the collapsed row content (differs per page); `right` holds any
 * trailing controls (e.g. delete) that must not trigger the expand.
 */
export default function ExpandableCard({
  card,
  summary,
  right,
}: {
  card: FeedCard;
  summary: ReactNode;
  right?: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  if (open) {
    return (
      <div className="relative">
        {/* Controls sit top-right, exactly where they are on the collapsed row. */}
        <div className="absolute right-3 top-3 z-10 flex items-center gap-1">
          <button
            onClick={() => setOpen(false)}
            aria-label="Thu gọn"
            title="Thu gọn"
            className="icon-btn h-8 w-8"
          >
            <ChevronUp size={18} className="text-[var(--muted)]" />
          </button>
          {right}
        </div>
        <Card
          card={card}
          onReact={(r: Reaction) => {
            void postJson("/api/react", { cardId: card.id, reaction: r });
          }}
          onSave={() => {
            void postJson("/api/save", { cardId: card.id });
          }}
          onAnswer={(selected: number) =>
            postJson("/api/quiz", { cardId: card.id, selected })
          }
        />
      </div>
    );
  }

  return (
    <div className="post flex items-center gap-3 p-3">
      <button
        onClick={() => setOpen(true)}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
      >
        {summary}
        <ChevronDown size={18} className="ml-auto shrink-0 text-[var(--muted)]" />
      </button>
      {right}
    </div>
  );
}
