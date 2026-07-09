"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { BarChart3, ArrowRight, AlertTriangle, Check, X, Film } from "lucide-react";

interface AdminCard {
  id: string;
  type: string;
  level: string;
  status: string;
  topic: string | null;
  review_note: string | null;
  content: Record<string, unknown>;
}

const STATUSES = ["draft", "published", "rejected", "all"] as const;
type StatusFilter = (typeof STATUSES)[number];

export default function AdminPage() {
  const [filter, setFilter] = useState<StatusFilter>("draft");
  const [cards, setCards] = useState<AdminCard[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const qs = filter === "all" ? "" : `?status=${filter}`;
    const res = await fetch(`/api/admin/cards${qs}`);
    const data = await res.json();
    setCards(data.cards ?? []);
    setLoading(false);
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  async function review(cardId: string, action: string, note?: string) {
    await fetch("/api/admin/review", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ cardId, action, note }) });
    load();
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">Content Review</h1>
        <div className="flex items-center gap-4 text-sm">
          <Link href="/admin/stats" className="inline-flex items-center gap-1 text-[var(--accent)]">
            <BarChart3 size={16} /> Analytics
          </Link>
          <Link href="/" className="inline-flex items-center gap-1 text-[var(--muted)]">
            Feed <ArrowRight size={16} />
          </Link>
        </div>
      </div>

      <p className="post mb-4 flex items-center gap-2 bg-[#fff9ec] p-3 text-xs text-[#8a6d00]">
        <AlertTriangle size={15} className="text-[var(--amber)]" />
        Quy tắc bất di bất dịch: chỉ card <b>Approve</b> mới vào feed. Không auto-publish.
      </p>

      <div className="mb-5 flex gap-2">
        {STATUSES.map((s) => (
          <button key={s} onClick={() => setFilter(s)}
            className={`rounded-full px-3 py-1 text-sm capitalize ${filter === s ? "bg-[var(--accent)] text-white" : "bg-[var(--hover)] text-[var(--muted)]"}`}>
            {s}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-[var(--muted)]">Đang tải…</p>
      ) : cards.length === 0 ? (
        <p className="text-[var(--muted)]">Không có card nào ở trạng thái này.</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {cards.map((c) => <ReviewRow key={c.id} card={c} onReview={review} />)}
        </ul>
      )}
    </main>
  );
}

function ReviewRow({ card, onReview }: { card: AdminCard; onReview: (id: string, action: string, note?: string) => void }) {
  const [note, setNote] = useState("");
  const c = card.content as Record<string, string> & { options?: string[] };

  const statusCls =
    card.status === "published" ? "bg-[#e6f4ea] text-[var(--green)]"
    : card.status === "rejected" ? "bg-[#fdeaed] text-[var(--red)]"
    : "bg-[var(--hover)] text-[var(--muted)]";

  return (
    <li className="post p-4">
      <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wider text-[var(--muted)]">
        <span className="rounded-full bg-[var(--hover)] px-2 py-0.5">{card.type}</span>
        <span>{card.level}</span>
        {card.topic && <span>· {card.topic}</span>}
        <span className={`ml-auto rounded-full px-2 py-0.5 ${statusCls}`}>{card.status}</span>
      </div>

      <div className="mb-3 text-sm">
        {card.type === "vocab" && (<><div className="font-semibold">{c.word}</div><div className="text-[var(--muted)]">{c.meaning_vi}</div><div className="italic">“{c.example}”</div></>)}
        {card.type === "grammar" && (<><div className="text-[var(--red)] line-through">{c.dont}</div><div className="text-[var(--green)]">{c.say}</div><div className="text-[var(--muted)]">{c.explain_vi}</div></>)}
        {card.type === "quiz" && (<><div className="font-semibold">{c.question}</div><ul className="ml-4 list-disc">{c.options?.map((o, i) => <li key={i} className={i === Number(c.correct) ? "text-[var(--green)]" : ""}>{o}</li>)}</ul><div className="text-[var(--muted)]">{c.explain_vi}</div></>)}
        {card.type === "quote" && (<><div className="font-semibold">“{c.quote}”</div><div className="text-[var(--muted)]">{c.meaning_vi}</div></>)}
        {card.type === "video" && (<><div className="inline-flex items-center gap-1 font-semibold"><Film size={14} /> {c.title}</div><div className="text-[var(--muted)]">{c.meaning_vi}</div><div className="truncate text-xs text-[var(--muted)]">{c.src || "(chưa có src — cần gắn clip)"}</div></>)}
      </div>

      {card.review_note && <div className="mb-2 text-xs text-[var(--red)]">Note: {card.review_note}</div>}

      <div className="flex flex-wrap items-center gap-2">
        {card.status !== "published" && (
          <button onClick={() => onReview(card.id, "approve")} className="inline-flex items-center gap-1 rounded-lg bg-[var(--green)] px-3 py-1.5 text-sm font-semibold text-white">
            <Check size={15} /> Approve
          </button>
        )}
        {card.status === "published" && (
          <button onClick={() => onReview(card.id, "unpublish")} className="rounded-lg bg-[var(--hover)] px-3 py-1.5 text-sm">Unpublish</button>
        )}
        {card.status !== "rejected" && (
          <>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="lý do reject…"
              className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-white px-2 py-1.5 text-sm" />
            <button onClick={() => onReview(card.id, "reject", note)} className="inline-flex items-center gap-1 rounded-lg bg-[var(--red)] px-3 py-1.5 text-sm font-semibold text-white">
              <X size={15} /> Reject
            </button>
          </>
        )}
      </div>
    </li>
  );
}
