"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  PartyPopper,
  Flame,
  Bookmark,
  Repeat,
  UserPlus,
  X,
  Loader2,
} from "lucide-react";
import Card from "./Card";
import type { FeedCard, Level, Reaction } from "@/lib/types";

interface Props {
  initial: FeedCard[];
  streak: number;
  level: Level | null;
  isGuest: boolean;
  // Cards already seen today (persisted), so the counter reflects the day's
  // total instead of resetting to 0 when the feed remounts after navigation.
  seenTodayIds: string[];
}

export default function Feed({ initial, streak: initialStreak, level, isGuest, seenTodayIds }: Props) {
  const [cards, setCards] = useState<FeedCard[]>(initial);
  const [exhausted, setExhausted] = useState(initial.length === 0);
  const [streak, setStreak] = useState(initialStreak);
  const [learned, setLearned] = useState(seenTodayIds.length);
  const [showSync, setShowSync] = useState(isGuest);

  const loadingRef = useRef(false);
  const idsRef = useRef<Set<string>>(new Set(initial.map((c) => c.id)));
  const seenRef = useRef<Set<string>>(new Set());
  // Cards already counted toward "hôm nay" (seeded from today's persisted views)
  // so re-seeing a card in a new session never double-counts.
  const countedRef = useRef<Set<string>>(new Set(seenTodayIds));
  const eventQueue = useRef<{ type: string; cardId?: string }[]>([]);

  // --- analytics batching --------------------------------------------------
  const flush = useCallback((useBeacon = false) => {
    if (eventQueue.current.length === 0) return;
    const events = eventQueue.current;
    eventQueue.current = [];
    const payload = JSON.stringify({ events });
    if (useBeacon && navigator.sendBeacon) {
      navigator.sendBeacon("/api/event", new Blob([payload], { type: "application/json" }));
    } else {
      fetch("/api/event", { method: "POST", headers: { "content-type": "application/json" }, body: payload, keepalive: true }).catch(() => {});
    }
  }, []);
  const track = useCallback((type: string, cardId?: string) => {
    eventQueue.current.push({ type, cardId });
  }, []);

  // --- session lifecycle ---------------------------------------------------
  useEffect(() => {
    track("session_start");
    const interval = setInterval(() => flush(), 3000);
    const onHide = () => {
      track("session_end");
      flush(true);
    };
    window.addEventListener("beforeunload", onHide);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") onHide();
    });
    return () => {
      clearInterval(interval);
      window.removeEventListener("beforeunload", onHide);
      onHide();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- infinite scroll -----------------------------------------------------
  const loadMore = useCallback(async () => {
    if (loadingRef.current || exhausted) return;
    loadingRef.current = true;
    try {
      const res = await fetch("/api/feed", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ exclude: Array.from(idsRef.current), limit: 8 }),
      });
      const data = await res.json();
      const fresh: FeedCard[] = (data.cards ?? []).filter((c: FeedCard) => !idsRef.current.has(c.id));
      if (fresh.length === 0) setExhausted(true);
      else {
        fresh.forEach((c) => idsRef.current.add(c.id));
        setCards((prev) => [...prev, ...fresh]);
      }
    } finally {
      loadingRef.current = false;
    }
  }, [exhausted]);

  // Facebook-style "click the logo to refresh": scroll to top + swap in a fresh
  // batch (excluding what was seen this session). Triggered by a window event so
  // the sticky TopBar can reach the feed without prop drilling.
  const reload = useCallback(async () => {
    flush(); // push pending "seen" events so the server ranks them as seen
    loadingRef.current = true;
    try {
      const res = await fetch("/api/feed", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ exclude: Array.from(seenRef.current).slice(0, 2000), limit: 12 }),
      });
      const data = await res.json();
      const fresh: FeedCard[] = data.cards ?? [];
      idsRef.current = new Set(fresh.map((c) => c.id));
      setCards(fresh);
      setExhausted(fresh.length === 0);
    } finally {
      loadingRef.current = false;
    }
  }, [flush]);

  useEffect(() => {
    const onRefresh = () => {
      window.scrollTo({ top: 0, behavior: "smooth" });
      reload();
    };
    window.addEventListener("engscroll:refresh-feed", onRefresh);
    return () => window.removeEventListener("engscroll:refresh-feed", onRefresh);
  }, [reload]);

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) loadMore();
    }, { rootMargin: "800px" });
    io.observe(el);
    return () => io.disconnect();
  }, [loadMore]);

  // --- seen tracking (viewport) --------------------------------------------
  const seenObserver = useRef<IntersectionObserver | null>(null);
  useEffect(() => {
    seenObserver.current = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting || e.intersectionRatio < 0.5) continue;
        const id = (e.target as HTMLElement).dataset.cardid;
        if (!id) continue;
        // Send a "seen" event once per session; count toward "hôm nay" once per
        // day (across sessions), so navigating away and back doesn't reset it.
        if (!seenRef.current.has(id)) {
          seenRef.current.add(id);
          track("seen", id);
        }
        if (!countedRef.current.has(id)) {
          countedRef.current.add(id);
          setLearned((n) => n + 1);
        }
      }
    }, { threshold: [0.5] });
    return () => seenObserver.current?.disconnect();
  }, [track]);

  const registerCard = useCallback((el: HTMLDivElement | null) => {
    if (el) seenObserver.current?.observe(el);
  }, []);

  // --- card actions --------------------------------------------------------
  const react = useCallback(async (cardId: string, reaction: Reaction) => {
    const res = await fetch("/api/react", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ cardId, reaction }) });
    const data = await res.json().catch(() => null);
    if (data?.streak) setStreak(data.streak);
  }, []);
  const save = useCallback(async (cardId: string) => {
    await fetch("/api/save", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ cardId }) });
  }, []);
  const answer = useCallback(async (cardId: string, selected: number) => {
    const res = await fetch("/api/quiz", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ cardId, selected }) });
    return res.json();
  }, []);

  return (
    <div className="px-2 pt-3 sm:px-0">
      <div className="mb-3 flex items-center justify-between px-1 text-sm text-[var(--muted)]">
          <span className="inline-flex items-center gap-1.5">
            <Flame size={15} className="text-[var(--amber)]" />
            {streak}-day streak
          </span>
          <span>{learned} thẻ hôm nay</span>
        </div>

        {showSync && (
          <div className="post fade-up flex items-center gap-3 p-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--chip)]">
              <UserPlus size={18} className="text-[var(--accent)]" />
            </span>
            <div className="flex-1 text-sm">
              <div className="font-semibold">Đăng nhập để đồng bộ tiến độ</div>
              <div className="text-[var(--muted)]">
                Bạn vẫn dùng đủ tính năng mà không cần đăng nhập.
              </div>
            </div>
            <Link href="/account" className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-sm font-semibold text-white">
              Đăng nhập
            </Link>
            <button onClick={() => setShowSync(false)} aria-label="Đóng" className="icon-btn h-8 w-8">
              <X size={16} />
            </button>
          </div>
        )}

        {cards.map((card) => (
          <div key={card.id} ref={registerCard} data-cardid={card.id}>
            <Card
              card={card}
              onReact={(r) => react(card.id, r)}
              onSave={() => save(card.id)}
              onAnswer={(sel) => answer(card.id, sel)}
            />
          </div>
        ))}

        {exhausted ? (
          <SessionSummary learned={learned} streak={streak} level={level} />
        ) : (
          <div ref={sentinelRef} className="flex items-center justify-center gap-2 py-8 text-[var(--muted)]">
            <Loader2 size={18} className="animate-spin" />
            Đang tải thêm…
          </div>
        )}
    </div>
  );
}

function SessionSummary({ learned, streak, level }: { learned: number; streak: number; level: Level | null }) {
  return (
    <div className="post fade-up p-6 text-center">
      <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--chip)]">
        <PartyPopper size={28} className="text-[var(--accent)]" />
      </div>
      <h2 className="text-xl font-bold">Bạn đã học {learned} thẻ hôm nay</h2>
      <p className="mb-4 mt-1 inline-flex items-center gap-1.5 text-sm text-[var(--muted)]">
        <Flame size={15} className="text-[var(--amber)]" />
        {streak}-day streak{level ? ` · level ${level}` : ""}
      </p>
      <div className="flex flex-col items-center gap-2">
        <button onClick={() => window.location.reload()} className="w-full max-w-xs rounded-lg bg-[var(--accent)] px-6 py-2.5 font-semibold text-white active:scale-[0.98]">
          Lướt tiếp
        </button>
        <div className="mt-1 flex gap-4 text-sm text-[var(--accent)]">
          <Link href="/review" className="inline-flex items-center gap-1.5"><Repeat size={15} /> Ôn tập</Link>
          <Link href="/saved" className="inline-flex items-center gap-1.5"><Bookmark size={15} /> Đã lưu</Link>
        </div>
      </div>
    </div>
  );
}
