"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "./AuthContext";

// Top-right account control in the header. Clear at a glance: a "Đăng nhập"
// button when signed out, an avatar (initial) when signed in. Always links to
// /account. Reads the shared auth state from AuthProvider.
export default function AccountButton() {
  const { user, loaded } = useAuth();
  const pathname = usePathname();

  // Reserve space to avoid a layout shift on first paint.
  if (!loaded) return <div className="h-8 w-8" />;

  if (!user) {
    return (
      <Link
        href="/account"
        className="inline-flex items-center rounded-full bg-[var(--accent)] px-4 py-1.5 text-sm font-bold text-white hover:brightness-110"
      >
        Đăng nhập
      </Link>
    );
  }

  const label = (user.name || user.email || "Tài khoản").trim();
  const initial = (label[0] || "?").toUpperCase();
  const active = pathname.startsWith("/account");

  return (
    <Link
      href="/account"
      title={label}
      aria-label="Tài khoản"
      className={`inline-flex items-center gap-2 rounded-full py-1 pl-1 pr-1 sm:pr-3 transition ${
        active ? "bg-[var(--chip)]" : "hover:bg-[var(--hover)]"
      }`}
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--accent)] text-sm font-bold text-white">
        {initial}
      </span>
      <span className="hidden max-w-[140px] truncate text-sm font-semibold sm:block">
        {user.name || user.email}
      </span>
    </Link>
  );
}
