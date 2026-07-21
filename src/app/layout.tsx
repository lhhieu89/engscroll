import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SITE_URL, SITE_NAME, SITE_TAGLINE, SITE_DESCRIPTION } from "../lib/site";
import GoogleAnalytics from "../components/GoogleAnalytics";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — ${SITE_TAGLINE}`,
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    "học tiếng Anh",
    "từ vựng tiếng Anh",
    "phát âm tiếng Anh",
    "idiom",
    "phrasal verb",
    "mẫu câu giao tiếp",
    "ngữ pháp tiếng Anh",
    "English meaning",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: "vi_VN",
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <body>
        {children}
        <GoogleAnalytics />
      </body>
    </html>
  );
}
