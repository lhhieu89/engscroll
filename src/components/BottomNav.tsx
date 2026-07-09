"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV } from "./nav";

// Mobile bottom navigation (Instagram/Facebook-style). Hidden on lg+.
export default function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t border-[var(--border)] bg-[var(--card)] lg:hidden">
      {NAV.map(({ href, label, Icon }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-label={label}
            onClick={(e) => {
              if (href === "/" && pathname === "/") {
                e.preventDefault();
                window.dispatchEvent(new Event("engscroll:refresh-feed"));
              }
            }}
            className="flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px]"
            style={{ color: active ? "var(--accent)" : "var(--muted)" }}
          >
            <Icon size={22} />
            <span className="truncate">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
