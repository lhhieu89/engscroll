#!/usr/bin/env python3
"""
Generates high-quality NEURAL audio for EngScroll vocab EXAMPLE sentences using
Microsoft Edge TTS (free, no API key) — the same technology english-app uses for
its advanced listening/speaking clips.

Word pronunciation already comes from Oxford's hosted human-voice MP3s (set at
import time). This script only covers the example SENTENCES, which have no hosted
audio: it synthesises each with the en-US neural voice, writes the MP3 under
public/audio/ex/<hash>.mp3 (served by Next.js at /audio/ex/<hash>.mp3), and sets
content_json.example_audio on the card.

    python3 scripts/generate-example-audio.py                 # all missing
    python3 scripts/generate-example-audio.py --limit=300     # a starter batch
    python3 scripts/generate-example-audio.py --voice=en-GB-SoniaNeural

Idempotent: skips cards that already have example_audio + an on-disk MP3.
"""
import asyncio
import hashlib
import json
import os
import sys

import edge_tts
import psycopg2
import psycopg2.extras

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, ".."))
OUT_DIR = os.path.join(ROOT, "public", "audio", "ex")


def database_url() -> str:
    url = os.environ.get("DATABASE_URL")
    if url:
        return url
    # Fall back to reading .env.local (DATABASE_URL=...) so the script can run
    # standalone like `python3 scripts/generate-example-audio.py`.
    env_path = os.path.join(ROOT, ".env.local")
    if os.path.exists(env_path):
        for line in open(env_path, encoding="utf-8"):
            line = line.strip()
            if line.startswith("DATABASE_URL="):
                return line.split("=", 1)[1].strip()
    print("✖ DATABASE_URL not set (env or .env.local).", file=sys.stderr)
    sys.exit(1)


def connect():
    return psycopg2.connect(database_url())

args = dict(
    a[2:].split("=", 1) if "=" in a else (a[2:], True)
    for a in sys.argv[1:]
    if a.startswith("--")
)
LIMIT = int(args.get("limit", 0)) or None
VOICE = args.get("voice", "en-US-AriaNeural")
CONCURRENCY = 5


def audio_hash(text: str) -> str:
    return hashlib.md5(text.strip().encode("utf-8")).hexdigest()[:16]


def load_targets():
    """Vocab cards with an example sentence but no usable example audio yet."""
    con = connect()
    cur = con.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute("SELECT id, content_json FROM cards WHERE type='vocab'")
    rows = cur.fetchall()
    con.close()
    targets = []
    for r in rows:
        try:
            c = json.loads(r["content_json"])
        except Exception:
            continue
        example = (c.get("example") or "").strip()
        if not example or " " not in example:
            continue  # need a real (multi-word) sentence
        h = audio_hash(example)
        mp3 = os.path.join(OUT_DIR, f"{h}.mp3")
        url = f"/audio/ex/{h}.mp3"
        if c.get("example_audio") == url and os.path.exists(mp3) and os.path.getsize(mp3) > 0:
            continue  # already done
        targets.append({"id": r["id"], "example": example, "hash": h, "mp3": mp3, "url": url})
    return targets


async def synth(t, sem):
    if os.path.exists(t["mp3"]) and os.path.getsize(t["mp3"]) > 0:
        return t  # file present; we still need to set the DB url below
    async with sem:
        for attempt in range(3):
            try:
                tts = edge_tts.Communicate(t["example"], VOICE)
                await tts.save(t["mp3"])
                return t
            except Exception as e:  # noqa: BLE001
                if attempt == 2:
                    print(f"  ! failed {t['id']}: {e}", file=sys.stderr)
                    return None
                await asyncio.sleep(1.5 * (attempt + 1))


def persist(done):
    """Write example_audio back into each card's content_json."""
    con = connect()
    cur = con.cursor()
    for t in done:
        cur.execute("SELECT content_json FROM cards WHERE id=%s", (t["id"],))
        row = cur.fetchone()
        if not row:
            continue
        c = json.loads(row[0])
        c["example_audio"] = t["url"]
        cur.execute(
            "UPDATE cards SET content_json=%s WHERE id=%s",
            (json.dumps(c, ensure_ascii=False), t["id"]),
        )
    con.commit()
    con.close()


async def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    targets = load_targets()
    if LIMIT:
        targets = targets[:LIMIT]
    if not targets:
        print("Nothing to do — all example audio is present.")
        return
    print(f"Synthesising {len(targets)} example sentences with {VOICE} → {OUT_DIR}")
    sem = asyncio.Semaphore(CONCURRENCY)
    results = await asyncio.gather(*(synth(t, sem) for t in targets))
    done = [t for t in results if t]
    persist(done)
    print(f"Done. {len(done)}/{len(targets)} MP3s ready and linked (example_audio set).")


if __name__ == "__main__":
    asyncio.run(main())
