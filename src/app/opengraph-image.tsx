import { renderOgImage, OG_SIZE } from "../lib/og";
import { SITE_TAGLINE } from "../lib/site";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "EngScroll — Lướt là giỏi tiếng Anh";

export default function OG() {
  return renderOgImage({
    title: "Lướt là giỏi tiếng Anh",
    subtitle: "Từ vựng · Mẫu câu · Idiom · Ngữ pháp — có audio & quiz",
    footnote: SITE_TAGLINE,
  });
}
