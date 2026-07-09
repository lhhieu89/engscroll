import { ImageResponse } from "next/og";
import { BrandMark, BRAND } from "./brand";

export const OG_SIZE = { width: 1200, height: 630 };

// Shared 1200×630 social card. Powers both link-preview og:image and the
// in-app "Save image" (Share → Story) button, so the two stay identical.
export function renderOgImage({
  eyebrow,
  title,
  subtitle,
  footnote,
  cacheSeconds,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  footnote?: string;
  cacheSeconds?: number;
}) {
  // Scale the headline down for long phrases so it never overflows.
  const titleSize = title.length > 34 ? 76 : title.length > 20 ? 96 : 120;
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          padding: "72px 80px",
          background: "linear-gradient(135deg, #F4F8FF 0%, #E7F0FE 100%)",
          fontFamily: "sans-serif",
          color: BRAND.ink,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <BrandMark size={64} />
          <span style={{ fontSize: 40, fontWeight: 800, letterSpacing: -1 }}>
            <span style={{ color: BRAND.accent }}>Eng</span>Scroll
          </span>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            justifyContent: "center",
          }}
        >
          {eyebrow ? (
            <div
              style={{
                display: "flex",
                alignSelf: "flex-start",
                background: BRAND.accent,
                color: "white",
                fontSize: 30,
                fontWeight: 700,
                padding: "8px 22px",
                borderRadius: 999,
                marginBottom: 28,
              }}
            >
              {eyebrow}
            </div>
          ) : null}
          <div
            style={{
              fontSize: titleSize,
              fontWeight: 800,
              lineHeight: 1.05,
              letterSpacing: -2,
              color: "#0A2540",
            }}
          >
            {title}
          </div>
          {subtitle ? (
            <div
              style={{
                fontSize: 44,
                color: BRAND.muted,
                marginTop: 24,
                lineHeight: 1.2,
              }}
            >
              {subtitle}
            </div>
          ) : null}
        </div>

        <div
          style={{
            display: "flex",
            fontSize: 28,
            color: BRAND.muted,
            fontWeight: 600,
          }}
        >
          {footnote || "Meaning · Pronunciation · Examples · Quiz"}
        </div>
      </div>
    ),
    {
      ...OG_SIZE,
      headers: cacheSeconds
        ? {
            "cache-control": `public, immutable, no-transform, max-age=${cacheSeconds}, s-maxage=${cacheSeconds}`,
          }
        : undefined,
    },
  );
}
