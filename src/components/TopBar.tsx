"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Wordmark } from "../lib/brand";
import AccountButton from "./AccountButton";

// Slim sticky brand bar (full width). Navigation lives in the desktop Sidebar
// and the mobile BottomNav.
export default function TopBar() {
  const pathname = usePathname();

  // Facebook-style: clicking the logo while already on the feed refreshes it
  // (scroll to top + fresh cards) instead of doing nothing; elsewhere it just
  // navigates home.
  function onLogo(e: React.MouseEvent) {
    if (pathname === "/") {
      e.preventDefault();
      window.dispatchEvent(new Event("engscroll:refresh-feed"));
    }
  }

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--card)]">
      <div className="mx-auto flex h-14 max-w-[1000px] items-center justify-between px-4">
        <Link href="/" onClick={onLogo} aria-label="EngScroll — trang chủ">
          <Wordmark size={26} />
        </Link>
        <AccountButton />
      </div>
    </header>
  );
}
