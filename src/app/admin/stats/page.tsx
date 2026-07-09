"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, BarChart3 } from "lucide-react";

interface Overview {
  totalPublished: number;
  totalDraft: number;
  totalUsers: number;
  totalReactions: number;
  totalSaves: number;
  totalDownloads: number;
  totalShares: number;
  avgCardsPerSession: number;
}
interface CardStat {
  id: string;
  type: string;
  level: string;
  status: string;
  seen: number;
  ok_rate: number;
  new_rate: number;
  save_rate: number;
  downloads: number;
  shares: number;
  preview: string;
}

export default function StatsPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [cards, setCards] = useState<CardStat[]>([]);

  useEffect(() => {
    fetch("/api/admin/stats").then((r) => r.json()).then((d) => {
      setOverview(d.overview);
      setCards(d.cards ?? []);
    });
  }, []);

  const pct = (x: number) => `${Math.round(x * 100)}%`;

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="inline-flex items-center gap-2 text-xl font-bold">
          <BarChart3 size={22} className="text-[var(--accent)]" /> Analytics
        </h1>
        <Link href="/admin" className="inline-flex items-center gap-1 text-sm text-[var(--accent)]">
          <ArrowLeft size={16} /> Review
        </Link>
      </div>

      {overview && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Stat label="Published cards" value={overview.totalPublished} />
          <Stat label="Draft cards" value={overview.totalDraft} />
          <Stat label="Users" value={overview.totalUsers} />
          <Stat label="Reactions" value={overview.totalReactions} />
          <Stat label="Saves" value={overview.totalSaves} />
          <Stat label="Tải ảnh" value={overview.totalDownloads} />
          <Stat label="Lượt chia sẻ" value={overview.totalShares} />
          <Stat label="Avg cards / session" value={overview.avgCardsPerSession} hint="North Star ≥ 15" />
        </div>
      )}

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">Per-card rates</h2>
      <div className="post overflow-x-auto p-2">
        <table className="w-full min-w-[680px] text-sm">
          <thead className="text-left text-xs uppercase text-[var(--muted)]">
            <tr>
              <th className="py-2 pl-2">Card</th><th>Type</th>
              <th className="text-right">Seen</th><th className="text-right">OK</th>
              <th className="text-right">New</th><th className="text-right">Save</th>
              <th className="text-right">Tải</th><th className="text-right pr-2">Share</th>
            </tr>
          </thead>
          <tbody>
            {cards.map((c) => (
              <tr key={c.id} className="border-t border-[var(--border)]">
                <td className="max-w-[200px] truncate py-2 pl-2 pr-2">{c.preview}</td>
                <td className="text-[var(--muted)]">{c.type}</td>
                <td className="text-right">{c.seen}</td>
                <td className="text-right">{pct(c.ok_rate)}</td>
                <td className="text-right text-[var(--accent)]">{pct(c.new_rate)}</td>
                <td className="text-right text-[var(--green)]">{pct(c.save_rate)}</td>
                <td className="text-right font-semibold">{c.downloads}</td>
                <td className="text-right pr-2 font-semibold">{c.shares}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}

function Stat({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="post p-4">
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-[var(--muted)]">{label}</div>
      {hint && <div className="mt-1 text-[10px] text-[var(--accent)]">{hint}</div>}
    </div>
  );
}
