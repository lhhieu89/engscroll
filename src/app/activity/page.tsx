"use client";

import { useCallback, useEffect, useState } from "react";
import {
  History,
  ThumbsUp,
  Lightbulb,
  Bookmark,
  CircleHelp,
  Check,
  X,
  Trash2,
  Info,
} from "lucide-react";
import AppShell from "@/components/AppShell";
import ExpandableCard from "@/components/ExpandableCard";
import { TYPE_META } from "@/components/Card";
import type { FeedCard } from "@/lib/types";

type Kind = "reaction" | "save" | "quiz";
interface Item {
  kind: Kind;
  cardId: string;
  cardType: string;
  preview: string;
  created_at: string;
  reaction?: "ok" | "new";
  is_correct?: boolean;
  selected?: string;
  card: FeedCard;
}

function relTime(utc: string): string {
  const t = new Date(utc.replace(" ", "T") + "Z").getTime();
  const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (s < 60) return "vừa xong";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} phút trước`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} giờ trước`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} ngày trước`;
  return new Date(t).toLocaleDateString("vi-VN");
}

function itemMeta(it: Item) {
  if (it.kind === "reaction")
    return it.reaction === "ok"
      ? { Icon: ThumbsUp, color: "var(--accent)", verb: "Đánh dấu Biết rồi" }
      : { Icon: Lightbulb, color: "var(--amber)", verb: "Đánh dấu Mới biết" };
  if (it.kind === "save") return { Icon: Bookmark, color: "var(--save)", verb: "Đã lưu" };
  return {
    Icon: CircleHelp,
    color: "#8b5cf6",
    verb: it.is_correct ? "Trả lời quiz — đúng" : "Trả lời quiz — sai",
  };
}

export default function ActivityPage() {
  const [items, setItems] = useState<Item[] | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/activity");
    if (res.status === 401) { setItems([]); return; }
    setItems((await res.json()).items ?? []);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function removeOne(it: Item) {
    setItems((prev) => prev?.filter((x) => !(x.kind === it.kind && x.cardId === it.cardId)) ?? null);
    await fetch("/api/activity", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind: it.kind, cardId: it.cardId }),
    });
  }

  async function clearAll() {
    if (!confirm("Xoá toàn bộ lịch sử? Việc này sẽ gỡ tất cả react và bỏ lưu tất cả thẻ (giống Facebook).")) return;
    setItems([]);
    await fetch("/api/activity", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ clearAll: true }),
    });
  }

  return (
    <AppShell>
      <div className="px-2 pt-4 sm:px-0">
        <div className="mb-3 flex items-center justify-between px-1">
          <h1 className="inline-flex items-center gap-2 text-xl font-bold">
            <History size={22} className="text-[var(--accent)]" /> Lịch sử hoạt động
          </h1>
          {items && items.length > 0 && (
            <button onClick={clearAll} className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 text-sm font-medium text-[var(--red)]">
              <Trash2 size={15} /> Xoá tất cả
            </button>
          )}
        </div>

        <div className="post mb-3 flex items-start gap-2 p-3 text-xs text-[var(--muted)]">
          <Info size={15} className="mt-0.5 shrink-0 text-[var(--accent)]" />
          <span>
            Xoá một mục ở đây sẽ <b>gỡ luôn hành động đó</b> — bỏ react hoặc bỏ lưu thẻ tương ứng.
          </span>
        </div>

        {items === null ? (
          <p className="px-1 text-[var(--muted)]">Đang tải…</p>
        ) : items.length === 0 ? (
          <p className="px-1 text-sm text-[var(--muted)]">
            Chưa có hoạt động nào. Hãy lướt feed và react / lưu thẻ.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {items.map((it) => {
              const m = itemMeta(it);
              return (
                <li key={`${it.kind}-${it.cardId}-${it.created_at}`}>
                  <ExpandableCard
                    card={it.card}
                    summary={
                      <>
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--hover)]">
                          <m.Icon size={18} style={{ color: m.color }} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5 text-sm font-medium">
                            {m.verb}
                            {it.kind === "quiz" && (it.is_correct
                              ? <Check size={14} className="text-[var(--green)]" />
                              : <X size={14} className="text-[var(--red)]" />)}
                          </span>
                          <span className="block truncate text-sm text-[var(--muted)]">
                            {TYPE_META[it.card.type]?.label ?? it.cardType} · {it.preview}
                          </span>
                          <span className="block text-xs text-[var(--muted)]">
                            {relTime(it.created_at)}
                          </span>
                        </span>
                      </>
                    }
                    right={
                      <button
                        onClick={() => removeOne(it)}
                        aria-label="Xoá"
                        className="icon-btn h-8 w-8 shrink-0"
                      >
                        <Trash2 size={16} className="text-[var(--muted)]" />
                      </button>
                    }
                  />
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
