"use client";

import { useRef, useState } from "react";
import { Volume2, Loader2 } from "lucide-react";

// Small inline "play pronunciation" button. Native <audio> is avoided so the
// control matches the app's look and can sit inline next to IPA text.
export default function AudioButton({
  src,
  label,
}: {
  src: string;
  label?: string;
}) {
  const ref = useRef<HTMLAudioElement | null>(null);
  const [busy, setBusy] = useState(false);

  function play() {
    if (!ref.current) ref.current = new Audio(src);
    setBusy(true);
    ref.current.currentTime = 0;
    ref.current
      .play()
      .finally(() => setBusy(false));
  }

  return (
    <button
      type="button"
      onClick={play}
      className="inline-flex items-center gap-1.5 rounded-full bg-[var(--chip)] px-3 py-1.5 text-sm font-semibold text-[var(--accent)] hover:brightness-95"
    >
      {busy ? (
        <Loader2 size={16} className="animate-spin" />
      ) : (
        <Volume2 size={16} />
      )}
      {label ?? "Nghe"}
    </button>
  );
}
