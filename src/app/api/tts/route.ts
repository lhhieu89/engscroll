import { NextRequest } from "next/server";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";

export const runtime = "nodejs";

// On-demand text-to-speech for example sentences (and any English text) — high
// quality neural audio without pre-generating files. First hit synthesises via
// Microsoft Edge neural TTS (free, no key), lazily caches the MP3 under
// public/audio/tts/, and serves it with a 1-year immutable cache header. Because
// the URL is a deterministic hash of (voice, text), the browser/CDN cache it and
// each sentence is synthesised at most once, ever. Falls back to Google
// Translate TTS if Edge is unreachable.

const CACHE_DIR = path.join(process.cwd(), "public", "audio", "tts");
const VOICES: Record<string, string> = {
  "en-US": "en-US-AriaNeural",
  "en-GB": "en-GB-SoniaNeural",
};
const AUDIO_HEADERS = {
  "Content-Type": "audio/mpeg",
  "Cache-Control": "public, max-age=31536000, immutable",
};

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const text = (url.searchParams.get("t") || "").trim().slice(0, 200);
  const lang = url.searchParams.get("v") === "en-GB" ? "en-GB" : "en-US";
  if (!text) return new Response("missing text", { status: 400 });

  const voice = VOICES[lang];
  const hash = createHash("sha1").update(`${voice}|${text}`).digest("hex").slice(0, 20);
  const file = path.join(CACHE_DIR, `${hash}.mp3`);

  if (existsSync(file)) {
    return new Response(new Uint8Array(readFileSync(file)), { headers: AUDIO_HEADERS });
  }

  const buf = await synth(text, voice);
  if (!buf) return new Response("tts unavailable", { status: 502 });

  // Best-effort persistent cache (ignored on read-only/serverless filesystems).
  try {
    mkdirSync(CACHE_DIR, { recursive: true });
    writeFileSync(file, buf);
  } catch {
    /* fall through — the response is still returned + browser-cached */
  }
  return new Response(new Uint8Array(buf), { headers: AUDIO_HEADERS });
}

async function synth(text: string, voice: string): Promise<Buffer | null> {
  try {
    return await edgeSynth(text, voice);
  } catch {
    try {
      return await googleSynth(text, voice);
    } catch {
      return null;
    }
  }
}

async function edgeSynth(text: string, voice: string): Promise<Buffer> {
  const tts = new MsEdgeTTS();
  await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
  const { audioStream } = await tts.toStream(text);
  const chunks: Buffer[] = [];
  for await (const c of audioStream as AsyncIterable<Buffer>) chunks.push(c);
  const buf = Buffer.concat(chunks);
  if (buf.length < 512) throw new Error("edge tts empty");
  return buf;
}

async function googleSynth(text: string, voice: string): Promise<Buffer> {
  const tl = voice.startsWith("en-GB") ? "en-GB" : "en";
  const u = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=${tl}&client=tw-ob`;
  const r = await fetch(u, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!r.ok) throw new Error(`google tts ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}
