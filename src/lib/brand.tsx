import type { CSSProperties } from "react";

// Brand palette — anchored on the Facebook-style accent already used app-wide.
export const BRAND = {
  accent: "#1877F2",
  accentDark: "#0A5DC2",
  accentLight: "#2E90FF",
  ink: "#050505",
  muted: "#65676B",
} as const;

// The EngScroll mark: a speech bubble (English) holding three feed / text lines
// that also read as an "E". Shared by the favicon, app icons, OG images and the
// TopBar wordmark so the identity stays byte-identical everywhere.
export function BrandMark({
  size = 32,
  rounded = true,
  style,
}: {
  size?: number;
  rounded?: boolean;
  style?: CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="EngScroll"
      style={style}
    >
      <defs>
        <linearGradient
          id="es-bg"
          x1="64"
          y1="48"
          x2="448"
          y2="464"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor={BRAND.accentLight} />
          <stop offset="1" stopColor={BRAND.accentDark} />
        </linearGradient>
      </defs>
      <rect
        width="512"
        height="512"
        rx={rounded ? 116 : 0}
        fill="url(#es-bg)"
      />
      <path
        d="M150 116 H362 a44 44 0 0 1 44 44 V300 a44 44 0 0 1 -44 44 H236 l-58 56 a10 10 0 0 1 -17 -7 V344 h-11 a44 44 0 0 1 -44 -44 V160 a44 44 0 0 1 44 -44 Z"
        fill="#ffffff"
      />
      <rect x="150" y="170" width="212" height="30" rx="15" fill="#1877F2" />
      <rect x="150" y="222" width="150" height="30" rx="15" fill="#5AA0F5" />
      <rect x="150" y="274" width="182" height="30" rx="15" fill="#1877F2" />
    </svg>
  );
}

// Horizontal lockup: mark + wordmark. Used in the sticky TopBar.
export function Wordmark({ size = 26 }: { size?: number }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        lineHeight: 1,
      }}
    >
      <BrandMark size={size} />
      <span
        style={{
          fontWeight: 800,
          letterSpacing: "-0.02em",
          fontSize: size * 0.8,
        }}
      >
        <span style={{ color: BRAND.accent }}>Eng</span>
        <span style={{ color: BRAND.ink }}>Scroll</span>
      </span>
    </span>
  );
}
