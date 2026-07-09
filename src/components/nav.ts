import {
  Home,
  Bookmark,
  History,
  Repeat,
  CircleUserRound,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  Icon: LucideIcon;
}

export const NAV: NavItem[] = [
  { href: "/", label: "Bảng feed", Icon: Home },
  { href: "/saved", label: "Đã lưu", Icon: Bookmark },
  { href: "/activity", label: "Lịch sử", Icon: History },
  { href: "/review", label: "Ôn tập", Icon: Repeat },
  { href: "/account", label: "Tài khoản", Icon: CircleUserRound },
];
