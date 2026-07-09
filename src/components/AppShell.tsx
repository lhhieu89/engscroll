import TopBar from "./TopBar";
import Sidebar from "./Sidebar";
import BottomNav from "./BottomNav";

// Responsive Facebook-style frame: sticky brand bar, a left sidebar on desktop,
// a centered content column, and a bottom nav on mobile.
export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh]">
      <TopBar />
      <div className="mx-auto flex w-full max-w-[1000px] gap-6 sm:px-4">
        <aside className="hidden w-[240px] shrink-0 pt-4 lg:block">
          <Sidebar />
        </aside>
        <main className="min-w-0 flex-1 pb-20 lg:pb-10">
          <div className="mx-auto w-full max-w-[600px]">{children}</div>
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
