import { Bookmark } from "lucide-react";
import { sql } from "drizzle-orm";
import { getCurrentUser } from "@/lib/user";
import { q } from "@/lib/db";
import AppShell from "@/components/AppShell";
import SavedList from "@/components/SavedList";
import type { FeedCard, Reaction } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function SavedPage() {
  const user = await getCurrentUser();

  // Pull the full feed-card payload (incl. this user's reaction / quiz answer)
  // so a row can expand into exactly the card the feed renders.
  const rows = user
    ? await q(sql`
        SELECT c.id, c.type, c.level, c.topic, c.content_json, c.audio_url,
               r.reaction         AS reacted,
               qa.selected_option AS sel_option,
               qa.is_correct      AS is_correct
         FROM saved_cards s
         JOIN cards c ON c.id = s.card_id AND c.status = 'published'
         LEFT JOIN card_reactions r ON r.card_id = c.id AND r.user_id = ${user.id}
         LEFT JOIN quiz_answers  qa ON qa.card_id = c.id AND qa.user_id = ${user.id}
         WHERE s.user_id = ${user.id}
         ORDER BY s.created_at DESC`)
    : [];

  const cards: FeedCard[] = rows.map((r) => ({
    id: String(r.id),
    type: r.type as FeedCard["type"],
    level: r.level as FeedCard["level"],
    topic: (r.topic as string) ?? null,
    content: JSON.parse(String(r.content_json)),
    audio_url: (r.audio_url as string) ?? null,
    reacted: (r.reacted as Reaction) ?? null,
    saved: true,
    answered:
      r.sel_option !== null && r.sel_option !== undefined
        ? { selected: Number(r.sel_option), is_correct: Number(r.is_correct) === 1 }
        : null,
  }));

  return (
    <AppShell>
      <div className="px-2 py-4 sm:px-0">
        <h1 className="mb-5 inline-flex items-center gap-2 px-1 text-xl font-bold">
          <Bookmark size={20} className="text-[var(--save)]" /> Đã lưu
        </h1>

        {cards.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">
            Chưa có thẻ nào được lưu. Bấm <b>Lưu</b> trên thẻ để giữ lại từ/câu đáng nhớ.
          </p>
        ) : (
          <SavedList cards={cards} />
        )}
      </div>
    </AppShell>
  );
}
