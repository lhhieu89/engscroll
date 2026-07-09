import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getLanding, landingMetadata } from "../../../lib/seo";
import LandingPage from "../../../components/LandingPage";

export const revalidate = 86400;
export const dynamicParams = true;
export function generateStaticParams() {
  return [];
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const l = await getLanding("phrase", slug);
  return l ? landingMetadata(l) : {};
}

export default async function Page({ params }: Props) {
  const { slug } = await params;
  const l = await getLanding("phrase", slug);
  if (!l) notFound();
  return <LandingPage l={l} />;
}
