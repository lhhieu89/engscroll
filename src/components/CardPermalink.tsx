import Link from "next/link";
import { ChevronRight } from "lucide-react";
import AppShell from "./AppShell";
import DetailCard from "./DetailCard";
import type { FeedCard } from "@/lib/types";

// Minimal permalink page for a card that has no keyword SEO landing (quiz /
// quote / video). Same feed frame + <Card> as everywhere else, plus a CTA back
// into the feed. No JSON-LD / FAQ scaffolding — the page is a shareable entry
// point, not an indexed SEO surface (the route marks it noindex).
export default function CardPermalink({ card }: { card: FeedCard }) {
  return (
    <AppShell>
      <div className="px-2 pt-3 sm:px-0">
        <DetailCard card={card} />
        <Link
          href="/"
          className="post flex items-center justify-between p-4 text-[var(--accent)] hover:bg-[var(--hover)]"
        >
          <span className="font-semibold">
            Lướt tiếp để học thêm — mở feed EngScroll
          </span>
          <ChevronRight size={22} />
        </Link>
      </div>
    </AppShell>
  );
}
