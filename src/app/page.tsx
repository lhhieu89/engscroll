import { getCurrentUser } from "@/lib/user";
import { getAccount } from "@/lib/auth";
import { getFeed } from "@/lib/feed";
import Feed from "@/components/Feed";
import AppShell from "@/components/AppShell";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function Home() {
  // Open straight into the feed — no level gate. Level is optional: unknown
  // levels get an easier cold-start mix and are inferred from reactions over
  // time (changeable anytime in /account).
  const user = await getCurrentUser();
  if (!user) {
    return (
      <AppShell>
        <div className="p-8 text-center text-sm text-[var(--muted)]">
          Hãy bật cookie để bắt đầu học.
        </div>
      </AppShell>
    );
  }

  const account = await getAccount(user.id);
  const isGuest = !account || account.provider === "anon";
  const initial = await getFeed(user.id, user.level, [], 12);
  return (
    <AppShell>
      <Feed initial={initial} streak={user.streak} level={user.level} isGuest={isGuest} />
    </AppShell>
  );
}
