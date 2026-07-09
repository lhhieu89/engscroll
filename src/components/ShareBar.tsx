"use client";

import { useState } from "react";
import { Copy, Share2, ImageDown, Check } from "lucide-react";

// Copy / Share / Save-image row shown on every landing page. Turns each page
// into shareable content: a learner copies the phrase, shares the link (Story),
// or saves the branded card image — friends click through and learn.
export default function ShareBar({
  title,
  text,
  url,
  imageUrl,
  imageName,
}: {
  title: string;
  text: string;
  url: string;
  imageUrl: string;
  imageName: string;
}) {
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable */
    }
  }

  async function share() {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch {
        /* user cancelled */
      }
    }
    const intent = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
    window.open(intent, "_blank", "noopener,noreferrer");
  }

  async function saveImage() {
    setSaving(true);
    try {
      const res = await fetch(imageUrl);
      const blob = await res.blob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = `${imageName}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(href);
    } catch {
      window.open(imageUrl, "_blank", "noopener,noreferrer");
    } finally {
      setSaving(false);
    }
  }

  const btn =
    "inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm font-semibold text-[var(--fg)] hover:bg-[var(--hover)]";

  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={copy} className={btn}>
        {copied ? (
          <Check size={16} className="text-[var(--green)]" />
        ) : (
          <Copy size={16} />
        )}
        {copied ? "Đã copy" : "Copy"}
      </button>
      <button type="button" onClick={share} className={btn}>
        <Share2 size={16} />
        Chia sẻ
      </button>
      <button type="button" onClick={saveImage} className={btn} disabled={saving}>
        <ImageDown size={16} />
        {saving ? "Đang lưu…" : "Lưu ảnh"}
      </button>
    </div>
  );
}
