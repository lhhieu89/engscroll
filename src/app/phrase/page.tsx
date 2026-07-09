import type { Metadata } from "next";
import HubPage from "../../components/HubPage";
import { listSlugs, countSlugs } from "../../lib/seo";

export const revalidate = 86400;

export const metadata: Metadata = {
  title: "Mẫu câu, Idiom & Phrasal verb tiếng Anh A–Z",
  description:
    "Nghĩa, cách dùng và ví dụ có audio cho hàng nghìn mẫu câu giao tiếp, idiom và phrasal verb tiếng Anh thông dụng. Duyệt A–Z.",
  alternates: { canonical: "/phrase" },
};

export default async function PhraseHub() {
  const [entries, count] = await Promise.all([
    listSlugs("phrase", { limit: 1200 }),
    countSlugs("phrase"),
  ]);
  return (
    <HubPage
      kind="phrase"
      title="Mẫu câu, Idiom & Phrasal verb"
      intro="Học tiếng Anh theo cụm: mẫu câu giao tiếp hằng ngày, idiom và phrasal verb thông dụng — kèm nghĩa tiếng Việt, cách dùng và audio."
      count={count}
      entries={entries}
    />
  );
}
