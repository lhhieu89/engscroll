# Seed data banks

Đây là **nguồn dữ liệu seed duy nhất** của EngScroll. Mỗi `*.json` là một mảng
"card-ready row". Production seed **chỉ đọc các file này** (không phụ thuộc project
ngoài).

## Luồng

```
[Nguồn ngoài: ../english-app, ../icspeak, hoặc soạn tay]
      │  builder scripts (chạy 1 lần, dev-time)
      ▼
content/banks/*.json      ← commit vào git (single source of truth)
      │  npm run seed:banks
      ▼
data/engscroll.db (SQLite) → feed
```

## Các bank hiện có

| File | type / category | Nguồn | Builder |
|---|---|---|---|
| `vocab.json` | `vocab` | Oxford 3000/5000 (../english-app) | `npm run build:banks` |
| `expression.json` | `expression` / `functional` | Cambridge functional | `npm run build:banks` |
| `sentences-1000.json` | `expression` / `daily_sentence` | ../icspeak | `npm run build:icspeak` |
| `crazy-400.json` | `expression` / `crazy_english` | ../icspeak | `npm run build:icspeak` |
| `crazy-365.json` | `expression` / `crazy_english` | ../icspeak | `npm run build:icspeak` |
| `grammar.json` | `grammar` | soạn tay (gốc) | — |
| `grammar-extra.json` | `grammar` | Claude sinh từ EGP (71 thẻ) | — |
| `grammar-tips.json` | `grammar` (kind `tip`) | EGP can-do + ví dụ thật (1235) | `npm run build:tips` |
| `grammar-egp.json` | (data backbone cho tips) | EGP Cambridge | `npm run build:banks` |
| `quote.json` | `quote` | soạn tay / Wikiquote — **bổ sung dần** | — |
| `video.json` | `video` | dán link YouTube/TikTok/FB/IG/Vimeo | — |
| quiz | `quiz` | **derive** trong seed | `scripts/seed-banks.mjs` |

Legacy (không dùng trong `seed:banks`, chỉ cho `npm run seed`/`generate` cũ):
`mistakes.json`, `phrases.json`, `quotes.json`.

## Format 1 row

```json
{
  "id": "ics_crazy400_123",
  "type": "expression",
  "level": "intermediate",
  "topic": "crazy-english",
  "status": "published",
  "audio_url": "/audio/icspeak/x.mp3",
  "content": { }
}
```

- `id` — ổn định & duy nhất → seed idempotent (chạy lại không nhân đôi). Đặt tiền
  tố theo nguồn: `oxf_`, `exp_`, `grm_`, `ics_`, `qz_`…
- `type` — `vocab` | `grammar` | `expression` | `quiz` | `quote`.
- `level` — `basic` | `intermediate` | `advanced` (map từ CEFR A1/A2 → basic,
  B1/B2 → intermediate, C1/C2 → advanced).
- `topic` — dùng để gom deck.
- `content` — shape tuỳ `type`, khai báo trong [`src/lib/types.ts`](../../src/lib/types.ts).

### content theo type (tóm tắt)

- **vocab**: `{ word, pos?, cefr?, ipa_uk?, ipa_us?, audio_uk?, audio_us?, meaning_vi, meaning_en?, example, example_vi?, example_audio? }`
- **grammar** — hai `kind`:
  - `contrast` (❌→✅): `{ kind?:"contrast", dont, say, explain_vi, cefr?, category?, source? }`
  - `tip` (EGP): `{ kind:"tip", title, explain_vi, examples[], examples_vi[], cefr?, category?, source? }`
- **expression**: `{ text, meaning_vi, category, cefr?, pronounce?, audio?, example?, example_vi?, fn?, register?, source? }`
  - `category`: `functional` | `daily_sentence` | `crazy_english` | (mới: `idiom`, `proverb`, …)
- **quiz**: `{ question, options[], correct, explain_vi, cefr?, style?, source? }` — derive
  trong seed, 6 style: `meaning` (từ→nghĩa), `reverse` (nghĩa→từ), `cloze`
  (điền từ vào ví dụ Oxford), `correct` (câu nào đúng), `usage` (chọn mẫu câu),
  `sentence` (câu icspeak→nghĩa).
- **quote**: `{ quote, meaning_vi, context_vi?, author?, source? }`
- **video**: `{ title, meaning_vi, url?, src?, poster?, source? }`
  - `url` = link YouTube / TikTok / Facebook / Instagram / Vimeo → tự nhúng iframe
    (Shorts/TikTok/Reels tự hiển thị khung dọc 9:16). `src` = mp4 tự host.

## Thêm data — 3 cách

**A. Thêm vài thẻ tay** — mở bank tương ứng, thêm row, rồi:
```
npm run seed:banks
```

**B. Thêm 1 bộ mới từ nguồn ngoài** — viết `scripts/build-<nguồn>.mjs` đọc nguồn →
ghi `content/banks/<tên>.json` đúng format → nếu là expression, thêm tên file vào
mảng `EXPRESSION_BANKS` trong `scripts/seed-banks.mjs` → `npm run seed:banks`.

**C. Loại nội dung mới KHÔNG cần type mới** (idiom, tục ngữ…) — đặt `category` mới
trong `content`, giữ `type: "expression"`. Không đổi schema/UI.

## Lưu ý

- `seed:banks` **idempotent**: vocab/expression dùng upsert theo `id`; quiz +
  expression bị xoá & tạo lại mỗi lần (RNG seed cố định → kết quả giống hệt).
- File audio đặt trong `public/audio/...`, `content.audio` / `audio_url` trỏ
  đường dẫn tuyệt đối từ web root (vd `/audio/icspeak/x.mp3`).
- example audio (TTS neural) cho câu ví dụ: `scripts/generate-example-audio.py`.
