"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Library } from "lucide-react";
import AppShell from "@/components/AppShell";

interface Deck {
  id: string;
  title: string;
  description: string | null;
  topic: string | null;
  level: string | null;
  card_count: number;
}

export default function DecksPage() {
  const [decks, setDecks] = useState<Deck[]>([]);

  useEffect(() => {
    fetch("/api/decks").then((r) => r.json()).then((d) => setDecks(d.decks ?? []));
  }, []);

  return (
    <AppShell>
      <div className="px-2 py-4 sm:px-0">
      <h1 className="mb-5 inline-flex items-center gap-2 px-1 text-xl font-bold">
        <Library size={22} className="text-[var(--accent)]" /> Decks theo chủ đề
      </h1>

      <ul className="flex flex-col gap-3">
        {decks.map((d) => (
          <li key={d.id}>
            <Link href={`/decks/${d.id}`} className="post block p-4 transition hover:bg-[var(--hover)]">
              <span className="font-semibold">{d.title}</span>
              {d.description && <p className="mt-1 text-sm text-[var(--muted)]">{d.description}</p>}
              <div className="mt-2 text-xs text-[var(--muted)]">
                {d.card_count} thẻ{d.level ? ` · ${d.level}` : ""}{d.topic ? ` · ${d.topic}` : ""}
              </div>
            </Link>
          </li>
        ))}
      </ul>
      </div>
    </AppShell>
  );
}
