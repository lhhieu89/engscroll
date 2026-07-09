import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getLanding, landingMetadata } from "../../../lib/seo";
import LandingPage from "../../../components/LandingPage";

// On-demand ISR: pages render + cache on first hit, refresh daily. With ~7k
// words we don't pre-build at deploy time.
export const revalidate = 86400;
export const dynamicParams = true;
export function generateStaticParams() {
  return [];
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const l = await getLanding("word", slug);
  return l ? landingMetadata(l) : {};
}

export default async function Page({ params }: Props) {
  const { slug } = await params;
  const l = await getLanding("word", slug);
  if (!l) notFound();
  return <LandingPage l={l} />;
}
