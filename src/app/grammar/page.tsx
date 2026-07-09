import type { Metadata } from "next";
import HubPage from "../../components/HubPage";
import { listSlugs, countSlugs } from "../../lib/seo";

export const revalidate = 86400;

export const metadata: Metadata = {
  title: "Ngữ pháp tiếng Anh — quy tắc, lỗi thường gặp & ví dụ",
  description:
    "Học ngữ pháp tiếng Anh qua các điểm ngữ pháp theo cấp độ CEFR và những lỗi người Việt hay sai, kèm cách nói đúng và ví dụ thực tế. Duyệt A–Z.",
  alternates: { canonical: "/grammar" },
};

export default async function GrammarHub() {
  const [entries, count] = await Promise.all([
    listSlugs("grammar", { limit: 1200 }),
    countSlugs("grammar"),
  ]);
  return (
    <HubPage
      kind="grammar"
      title="Ngữ pháp tiếng Anh"
      intro="Nắm chắc ngữ pháp tiếng Anh qua các điểm ngữ pháp theo cấp độ và các lỗi thường gặp của người Việt — mỗi mục có giải thích ngắn gọn và ví dụ thực tế."
      count={count}
      entries={entries}
    />
  );
}
