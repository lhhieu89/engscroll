"use client";

import ExpandableCard from "./ExpandableCard";
import { TYPE_META } from "./Card";
import { cardTitle, cardSubtitle } from "@/lib/card-preview";
import type { FeedCard } from "@/lib/types";

export default function SavedList({ cards }: { cards: FeedCard[] }) {
  return (
    <ul className="flex flex-col gap-3">
      {cards.map((card) => {
        const meta = TYPE_META[card.type];
        const title = cardTitle(card.content);
        const subtitle = cardSubtitle(card.content);
        return (
          <li key={card.id}>
            <ExpandableCard
              card={card}
              summary={
                <>
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                    style={{ background: meta.bg }}
                  >
                    <meta.Icon size={18} style={{ color: meta.color }} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{title}</span>
                    {subtitle && (
                      <span className="block truncate text-sm text-[var(--muted)]">
                        {subtitle}
                      </span>
                    )}
                    <span className="block text-xs text-[var(--muted)]">
                      {meta.label} · {card.level}
                      {card.topic ? ` · ${card.topic}` : ""}
                    </span>
                  </span>
                </>
              }
            />
          </li>
        );
      })}
    </ul>
  );
}
