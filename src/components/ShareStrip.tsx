"use client";

import { useEffect, useRef, useState } from "react";
import { toPng } from "html-to-image";
import { Download, Link as LinkIcon, Check, Share as ShareMore } from "lucide-react";
import type { FeedCard } from "@/lib/types";
import { shareInfoFor } from "@/lib/share";
import {
  MessengerIcon,
  WhatsappIcon,
  XIcon,
  TelegramIcon,
  FacebookIcon,
} from "./ShareIcons";

// Horizontal share sheet revealed below the card action bar (Facebook / iOS
// style): round icons in one scrollable row. Compact — one tap per target.
export default function ShareStrip({
  card,
  onDone,
}: {
  card: FeedCard;
  onDone: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [canNativeShare, setCanNativeShare] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const info = shareInfoFor(card);
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const url = origin + info.path;
  const caption = info.title;
  const imageUrl = `${origin}/api/card-image?id=${encodeURIComponent(card.id)}`;

  useEffect(() => {
    setCanNativeShare(
      typeof navigator !== "undefined" && typeof navigator.share === "function",
    );
  }, []);

  // Fire-and-forget analytics so we can later measure how much this feature is
  // used, per card. "download_image" = image downloads; "share_click" = share
  // targets (meta.target tells which one).
  function track(type: string, meta?: Record<string, unknown>) {
    try {
      const body = JSON.stringify({ events: [{ type, cardId: card.id, meta }] });
      if (typeof navigator !== "undefined" && navigator.sendBeacon) {
        navigator.sendBeacon("/api/event", new Blob([body], { type: "application/json" }));
      } else {
        fetch("/api/event", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body,
          keepalive: true,
        }).catch(() => {});
      }
    } catch {
      /* analytics is best-effort */
    }
  }

  async function copyLink() {
    track("share_click", { target: "copy_link" });
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard blocked */
    }
  }

  function openShare(target: string, href: string) {
    track("share_click", { target });
    window.open(href, "_blank", "noopener,noreferrer");
    onDone();
  }

  async function nativeShare() {
    track("share_click", { target: "native" });
    try {
      await navigator.share({ title: "EngScroll", text: caption, url });
    } catch {
      /* cancelled */
    }
    onDone();
  }

  // Rasterise the REAL card DOM (same CSS the user sees) so the download is
  // pixel-identical, rather than a re-drawn approximation. Captures the live
  // card node (excluding the action bar) then composites it onto the grey feed
  // background with a small EngScroll watermark. Falls back to the server image.
  async function downloadImage() {
    setSaving(true);
    try {
      const card = rootRef.current?.closest(".post") as HTMLElement | null;
      if (!card) throw new Error("card node not found");
      const scale = Math.max(2, window.devicePixelRatio || 1);

      // Crop out the (removed) action bar's height so there's no empty gap:
      // html-to-image sizes to the full node height even when a child is filtered
      // out, and .post has overflow:hidden so a smaller height clips cleanly.
      const rect = card.getBoundingClientRect();
      const bar = card.querySelector("[data-noexport]") as HTMLElement | null;
      const w = Math.round(rect.width);
      const h = Math.round(rect.height - (bar ? bar.getBoundingClientRect().height : 0));

      // No backgroundColor → transparent outside the card's rounded border, so
      // the corners show the grey feed behind them instead of white notches.
      const cardUrl = await toPng(card, {
        pixelRatio: scale,
        width: w,
        height: h,
        filter: (n) =>
          !(n instanceof HTMLElement && n.hasAttribute("data-noexport")),
        cacheBust: true,
      });

      const img = new Image();
      img.src = cardUrl;
      await img.decode();

      const pad = Math.round(16 * scale);
      const footH = Math.round(46 * scale);
      const canvas = document.createElement("canvas");
      canvas.width = img.width + pad * 2;
      canvas.height = img.height + pad + footH;
      const g = canvas.getContext("2d");
      if (!g) throw new Error("no 2d context");

      g.fillStyle = "#e9ebee"; // grey feed background
      g.fillRect(0, 0, canvas.width, canvas.height);
      g.drawImage(img, pad, pad);

      // EngScroll watermark under the card.
      const fy = pad + img.height + footH / 2;
      g.textBaseline = "middle";
      g.font = `800 ${Math.round(15 * scale)}px -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif`;
      let x = pad + Math.round(4 * scale);
      g.fillStyle = "#1877f2";
      g.fillText("Eng", x, fy);
      x += g.measureText("Eng").width;
      g.fillStyle = "#050505";
      g.fillText("Scroll", x, fy);
      g.font = `600 ${Math.round(14 * scale)}px -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif`;
      g.fillStyle = "#65676b";
      const rt = "engscroll.com";
      g.fillText(rt, canvas.width - pad - g.measureText(rt).width, fy);

      const dataUrl = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `${info.imageName || "engscroll"}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      track("download_image");
    } catch {
      // Fallback: the server-rendered card image.
      window.open(imageUrl, "_blank", "noopener,noreferrer");
    } finally {
      setSaving(false);
      onDone();
    }
  }

  const e = encodeURIComponent;

  return (
    <div ref={rootRef} className="fade-up flex gap-1 overflow-x-auto border-t border-[var(--border)] px-2 py-2">
      <Chip label={saving ? "Đang tạo…" : "Tải ảnh"} onClick={downloadImage} disabled={saving} highlight>
        <Download size={20} className="text-[var(--accent)]" />
      </Chip>
      <Chip label={copied ? "Đã copy" : "Copy link"} onClick={copyLink}>
        {copied ? (
          <Check size={20} className="text-[var(--green)]" />
        ) : (
          <LinkIcon size={20} className="text-[var(--fg)]" />
        )}
      </Chip>
      <Chip label="Messenger" onClick={() => openShare("messenger", `fb-messenger://share/?link=${e(url)}`)}>
        <MessengerIcon size={22} />
      </Chip>
      <Chip label="WhatsApp" onClick={() => openShare("whatsapp", `https://wa.me/?text=${e(caption + " " + url)}`)}>
        <WhatsappIcon size={22} />
      </Chip>
      <Chip label="X" onClick={() => openShare("x", `https://twitter.com/intent/tweet?url=${e(url)}&text=${e(caption)}`)}>
        <XIcon size={20} />
      </Chip>
      <Chip label="Telegram" onClick={() => openShare("telegram", `https://t.me/share/url?url=${e(url)}&text=${e(caption)}`)}>
        <TelegramIcon size={22} />
      </Chip>
      <Chip label="Facebook" onClick={() => openShare("facebook", `https://www.facebook.com/sharer/sharer.php?u=${e(url)}`)}>
        <FacebookIcon size={22} />
      </Chip>
      {canNativeShare && (
        <Chip label="Khác" onClick={nativeShare}>
          <ShareMore size={20} className="text-[var(--fg)]" />
        </Chip>
      )}
    </div>
  );
}

function Chip({
  label,
  onClick,
  disabled,
  highlight,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  highlight?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex w-[64px] shrink-0 flex-col items-center gap-1 rounded-lg py-1 hover:bg-[var(--hover)] disabled:opacity-60"
    >
      <span
        className={`flex h-11 w-11 items-center justify-center rounded-full ${
          highlight ? "bg-[var(--chip)]" : "bg-[var(--hover)]"
        }`}
      >
        {children}
      </span>
      <span className="max-w-full truncate text-[11px] text-[var(--muted)]">
        {label}
      </span>
    </button>
  );
}
