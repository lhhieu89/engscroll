"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import AppShell from "@/components/AppShell";

interface Deck {
  id: string;
  title: string;
  description: string | null;
  card_count: number;
}
interface DCard {
  id: string;
  type: string;
  level: string;
  content: Record<string, string>;
}

export default function DeckDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [deck, setDeck] = useState<Deck | null>(null);
  const [cards, setCards] = useState<DCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/decks/${id}`)
      .then((r) => r.json())
      .then((data) => {
        setDeck(data.deck ?? null);
        setCards(data.cards ?? []);
        setLoading(false);
      });
  }, [id]);

  if (loading) return <Wrap>Đang tải…</Wrap>;
  if (!deck) return <Wrap>Không tìm thấy deck.</Wrap>;

  return (
    <AppShell>
      <div className="px-2 py-4 sm:px-0">
      <Link href="/decks" className="mb-4 inline-flex items-center gap-1 text-sm text-[var(--accent)]">
        <ArrowLeft size={16} /> Decks
      </Link>
      <h1 className="text-2xl font-bold">{deck.title}</h1>
      {deck.description && <p className="mt-1 text-sm text-[var(--muted)]">{deck.description}</p>}
      <div className="mt-1 text-xs text-[var(--muted)]">{deck.card_count} thẻ</div>

      <ul className="mt-6 flex flex-col gap-3">
        {cards.map((c) => (
          <li key={c.id} className="post p-4">
            <div className="mb-1 text-xs uppercase tracking-wider text-[var(--muted)]">{c.type} · {c.level}</div>
            <div className="font-semibold">
              {c.content.word || c.content.text || c.content.quote || c.content.say || c.content.question || c.content.title}
            </div>
            {(c.content.meaning_vi || c.content.explain_vi) && (
              <div className="mt-1 text-sm text-[var(--muted)]">{c.content.meaning_vi || c.content.explain_vi}</div>
            )}
          </li>
        ))}
      </ul>
      </div>
    </AppShell>
  );
}

function Wrap({ children }: { children: React.ReactNode }) {
  return (
    <AppShell>
      <div className="flex min-h-[50vh] items-center justify-center px-6 text-[var(--muted)]">{children}</div>
    </AppShell>
  );
}
