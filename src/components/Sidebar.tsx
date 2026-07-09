"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV } from "./nav";

// Desktop left sidebar (Facebook-style). Hidden below lg — mobile uses BottomNav.
export default function Sidebar() {
  const pathname = usePathname();
  return (
    <nav className="sticky top-[68px] flex flex-col gap-1">
      {NAV.map(({ href, label, Icon }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            onClick={(e) => {
              if (href === "/" && pathname === "/") {
                e.preventDefault();
                window.dispatchEvent(new Event("engscroll:refresh-feed"));
              }
            }}
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] font-medium transition ${
              active
                ? "bg-[var(--chip)] text-[var(--accent)]"
                : "text-[var(--fg)] hover:bg-[var(--hover)]"
            }`}
          >
            <Icon size={22} className={active ? "text-[var(--accent)]" : "text-[var(--muted)]"} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
