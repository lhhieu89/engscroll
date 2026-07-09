import type { Metadata } from "next";
import HubPage from "../../components/HubPage";
import { listSlugs, countSlugs } from "../../lib/seo";

export const revalidate = 86400;

export const metadata: Metadata = {
  title: "Từ vựng tiếng Anh A–Z — nghĩa, phát âm, ví dụ",
  description:
    "Tra nghĩa tiếng Việt, phát âm UK/US có audio và ví dụ cho hàng nghìn từ vựng tiếng Anh theo cấp độ CEFR (A1–C2). Duyệt từ vựng A–Z.",
  alternates: { canonical: "/word" },
};

export default async function WordHub() {
  const [entries, count] = await Promise.all([
    listSlugs("word", { limit: 1200 }),
    countSlugs("word"),
  ]);
  return (
    <HubPage
      kind="word"
      title="Từ vựng tiếng Anh A–Z"
      intro="Tra nghĩa, nghe phát âm UK/US và xem ví dụ cho hàng nghìn từ vựng tiếng Anh chuẩn CEFR. Mỗi từ là một trang riêng với đầy đủ nghĩa, phát âm, ví dụ và quiz."
      count={count}
      entries={entries}
    />
  );
}
