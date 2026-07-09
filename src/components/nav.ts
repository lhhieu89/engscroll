import { Home, Bookmark, History, Repeat, type LucideIcon } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  Icon: LucideIcon;
}

// Account is reached only through the top-right header button (AccountButton),
// so it is intentionally NOT a nav item here.
export const NAV: NavItem[] = [
  { href: "/", label: "Bảng feed", Icon: Home },
  { href: "/saved", label: "Đã lưu", Icon: Bookmark },
  { href: "/activity", label: "Lịch sử", Icon: History },
  { href: "/review", label: "Ôn tập", Icon: Repeat },
];
