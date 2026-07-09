// Canonical site origin. Override per-environment with NEXT_PUBLIC_SITE_URL
// (e.g. https://engscroll.com). No trailing slash.
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://engscroll.com"
).replace(/\/+$/, "");

export const SITE_NAME = "EngScroll";
export const SITE_TAGLINE = "Lướt là giỏi tiếng Anh";
export const SITE_DESCRIPTION =
  "Học tiếng Anh bằng cách lướt: tra nghĩa, phát âm, ví dụ có audio và quiz cho hàng nghìn từ vựng, mẫu câu, idiom và ngữ pháp. Mỗi ngày 3–5 phút.";

// Absolute URL helper for canonicals / OG / sitemap.
export function abs(path: string): string {
  if (!path.startsWith("/")) path = "/" + path;
  return SITE_URL + path;
}
