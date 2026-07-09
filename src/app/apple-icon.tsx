import { ImageResponse } from "next/og";
import { BrandMark } from "../lib/brand";

// Apple touch icon (Next serves this as /apple-icon and injects the link tag).
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          alignItems: "center",
          justifyContent: "center",
          background: "#0A5DC2",
        }}
      >
        <BrandMark size={180} rounded={false} />
      </div>
    ),
    { ...size },
  );
}
