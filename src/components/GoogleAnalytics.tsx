import Script from "next/script";

// Google Analytics (gtag.js). One loader script, but both measurement IDs are
// configured on it so hits are recorded in each property.
const GA_IDS = ["G-EB1K2742ZF", "G-XC0MPSL3M2"];

export default function GoogleAnalytics() {
  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_IDS[0]}`}
        strategy="afterInteractive"
      />
      <Script id="ga-init" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
${GA_IDS.map((id) => `gtag('config', '${id}');`).join("\n")}`}
      </Script>
    </>
  );
}
