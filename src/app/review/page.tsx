"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Sprout, CheckCircle2 } from "lucide-react";
import AppShell from "@/components/AppShell";
import Card, { TYPE_META } from "@/components/Card";
import type { CardContent, FeedCard, QuizContent } from "@/lib/types";

type Grade = "again" | "hard" | "good" | "easy";

interface RCard {
  id: string;
  type: FeedCard["type"];
  level: FeedCard["level"];
  content: CardContent;
  audio_url: string | null;
}

const GRADES: { g: Grade; label: string; cls: string }[] = [
  { g: "again", label: "Again", cls: "bg-[var(--red)]" },
  { g: "hard", label: "Hard", cls: "bg-[var(--amber)]" },
  { g: "good", label: "Good", cls: "bg-[var(--green)]" },
  { g: "easy", label: "Easy", cls: "bg-[var(--accent)]" },
];

// The recall prompt shown on the front — deliberately NOT the answer. For a
// grammar "contrast" card that's the wrong sentence (recall the fix); otherwise
// the headword / sentence / question.
function promptOf(c: Record<string, unknown>): string {
  return String(
    c.word ?? c.text ?? c.quote ?? c.question ?? c.dont ?? c.title ?? "",
  );
}

function toFeedCard(r: RCard): FeedCard {
  return {
    id: r.id,
    type: r.type,
    level: r.level,
    topic: null,
    content: r.content,
    audio_url: r.audio_url,
    reacted: null,
    saved: true,
    answered: null,
  };
}

export default function ReviewPage() {
  const [cards, setCards] = useState<RCard[] | null>(null);
  const [i, setI] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [done, setDone] = useState(0);

  const load = useCallback(async () => {
    const res = await fetch("/api/review");
    if (res.status === 401) { setCards([]); return; }
    const data = await res.json();
    setCards(data.cards ?? []);
    setI(0);
    setRevealed(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function grade(g: Grade) {
    const card = cards![i];
    await fetch("/api/review/grade", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ cardId: card.id, grade: g }),
    });
    setDone((n) => n + 1);
    setRevealed(false);
    setI((n) => n + 1);
  }

  if (cards === null) return <Centered>Đang tải…</Centered>;

  if (cards.length === 0)
    return (
      <Centered>
        <Sprout size={40} className="text-[var(--green)]" />
        <p className="mt-3 max-w-xs text-[var(--muted)]">
          Chưa có thẻ nào để ôn. Lướt feed và bấm <b>Lưu</b> để giữ lại từ/câu đáng nhớ — chúng
          sẽ xuất hiện ở đây theo lịch ôn tập.
        </p>
        <Link href="/" className="mt-5 inline-flex items-center gap-1 text-[var(--accent)]">
          <ArrowLeft size={16} /> Về feed
        </Link>
      </Centered>
    );

  if (i >= cards.length)
    return (
      <Centered>
        <CheckCircle2 size={48} className="text-[var(--green)]" />
        <h2 className="mt-3 text-2xl font-bold">Xong {done} thẻ!</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">Hết thẻ cần ôn hôm nay. Quay lại ngày mai nhé.</p>
        <Link href="/" className="mt-5 inline-flex items-center gap-1 text-[var(--accent)]">
          <ArrowLeft size={16} /> Về feed
        </Link>
      </Centered>
    );

  const card = cards[i];
  const meta = TYPE_META[card.type];
  const prompt = promptOf(card.content as unknown as Record<string, unknown>);
  const fc = toFeedCard(card);

  return (
    <AppShell>
      <div className="flex min-h-[72vh] flex-col px-2 py-4 sm:px-0">
        <div className="mb-4 flex items-center justify-between text-sm">
          <Link href="/" className="inline-flex items-center gap-1 text-[var(--accent)]">
            <ArrowLeft size={16} /> Feed
          </Link>
          <span className="text-[var(--muted)]">{i + 1}/{cards.length} · ôn tập</span>
        </div>

        <div className="flex flex-1 flex-col justify-center">
          {revealed ? (
            // Answer = the exact feed card (rich: audio, IPA, examples), minus
            // the react/save bar (grading below replaces it).
            <div className="fade-up">
              <Card
                card={fc}
                hideActions
                onAnswer={async (sel) => {
                  const q = fc.content as QuizContent;
                  return { is_correct: sel === q.correct, correct: q.correct, explain_vi: q.explain_vi };
                }}
              />
            </div>
          ) : (
            // Recall prompt — same header style as the feed card, answer hidden.
            <div className="post p-6">
              <div className="mb-4 flex items-center gap-2.5">
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-full"
                  style={{ background: meta.bg }}
                >
                  <meta.Icon size={18} style={{ color: meta.color }} />
                </span>
                <div className="text-xs text-[var(--muted)]">
                  {meta.label} · {card.level}
                </div>
              </div>
              <div className="py-6 text-center text-2xl font-bold">{prompt}</div>
              <p className="text-center text-xs text-[var(--muted)]">
                Nhớ lại nghĩa/cách dùng, rồi bấm để kiểm tra.
              </p>
            </div>
          )}
        </div>

        <div className="mt-6">
          {!revealed ? (
            <button onClick={() => setRevealed(true)} className="w-full rounded-lg bg-white border border-[var(--border)] px-4 py-3.5 font-semibold hover:bg-[var(--hover)]">
              Hiện đáp án
            </button>
          ) : (
            <div className="grid grid-cols-4 gap-2">
              {GRADES.map((x) => (
                <button key={x.g} onClick={() => grade(x.g)} className={`rounded-lg px-2 py-3 text-sm font-semibold text-white ${x.cls}`}>
                  {x.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <AppShell>
      <div className="flex min-h-[72vh] flex-col items-center justify-center px-6 text-center">
        {children}
      </div>
    </AppShell>
  );
}
