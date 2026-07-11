# EngScroll — Phase 1 (Release MVP)

> Build a single vertical feed for learning English. Users only react **OK / New**,
> save what matters, scroll effortlessly, and feel progress in minutes.
> No social features. No complexity. Content quality is everything.

Một feed dọc học tiếng Anh: mở web là thấy feed, chưa login vẫn dùng được, chỉ cần
lướt và phản xạ OK / New. Session 3–5 phút.

## Tech stack (mới nhất)

- **Next.js 16** (App Router, Turbopack, `proxy.ts` convention) + **React 19.2** + **TypeScript 6**
- **Tailwind CSS v4** — giao diện **sáng kiểu Facebook**: feed cuộn liên tục nhiều post (không phải 1 card/màn hình), top bar dính, card nền trắng bo góc
- **lucide-react** — toàn bộ icon dùng bộ open-source (không emoji). Reaction: 👍 `ThumbsUp` = OK, 💡 `Lightbulb` = Mới
- Mọi tính năng xem đều **không cần đăng nhập**; đăng nhập chỉ để đồng bộ tiến độ (anon → account)
- **PostgreSQL + Drizzle ORM** (`postgres.js` driver) — schema ở `src/lib/schema.ts`, query ở `src/lib/*.ts`
- Auth tự viết bằng `node:crypto` (scrypt) — không phụ thuộc lib ngoài
- Anonymous user qua cookie (`eng_uid`, set bởi `src/proxy.ts`); logged-in user qua session cookie (`eng_sid`)

## Chạy dự án

```bash
npm install
cp .env.example .env.local       # đặt DATABASE_URL (+ tuỳ chọn Google keys / ADMIN_KEY)
createdb engscroll               # tạo DB Postgres (nếu chưa có)
npm run db:migrate               # tạo bảng (production) — hoặc `npm run db:push` (dev nhanh)
npm run seed:banks               # nạp content từ content/banks/*.json → Postgres
npm run dev                      # http://localhost:3000
# hoặc production: npm run build && npm start
```

**Database (Postgres + Drizzle):** `DATABASE_URL` trong `.env.local`. Schema: `src/lib/schema.ts`.
Scripts: `db:generate` (sinh migration từ schema), `db:migrate` (áp migration), `db:push` (đồng bộ
nhanh khi dev), `db:studio` (GUI). Content nguồn: **`content/banks/*.json`** (xem `content/banks/README.md`).

## Màn hình

| Route          | Mô tả                                                         |
| -------------- | ------------------------------------------------------------- |
| `/`            | Feed dọc (hoặc onboarding 1 câu hỏi nếu chưa chọn level)      |
| `/account`     | Đăng ký/đăng nhập email + Google (nếu cấu hình), logout        |
| `/review`      | **Phase 2** — ôn thẻ đã lưu bằng spaced repetition (SM-2 lite) |
| `/decks`       | **Phase 2** — decks theo chủ đề, có deck Premium              |
| `/decks/[id]`  | Chi tiết deck (khoá nếu Premium & chưa mở)                    |
| `/saved`       | Danh sách thẻ đã 📌 lưu                                        |
| `/admin`       | Content review queue: Approve / Reject + tạo draft mới        |
| `/admin/stats` | Analytics: OK/New/Save rate mỗi card, overview                |

## Auth (email + Google)

- **Email**: đăng ký/đăng nhập với mật khẩu hash bằng **scrypt** (`src/lib/auth.ts`),
  session lưu ở bảng `sessions`, cookie `eng_sid` httpOnly. Không dùng lib ngoài.
- **Google OAuth**: đã wire sẵn (`src/lib/google.ts`, `/api/auth/google/*`), **dormant**
  cho tới khi set `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` trong `.env.local`.
  Khi có key, nút "Tiếp tục với Google" tự hiện. Redirect URI mặc định
  `<origin>/api/auth/google/callback`.
- **Merge tiến độ**: khi anonymous user đăng ký/đăng nhập, toàn bộ reactions / saved /
  quiz / streak / level được **merge** vào tài khoản (chính là "save sync" của Tuần 3–4).

## Card types (Phase 1)

- **A — Vocabulary / Idiom**: word, IPA, nghĩa VI, 1 ví dụ, audio (Web Speech TTS)
- **B — Grammar / Common Mistake**: ❌ Don't say / ✅ Say / 1-line explain
- **C — Mini Quiz (MCQ)**: chấm điểm **server-side**, react chỉ hiện sau khi trả lời
- **D — Quote / Movie Line**: câu quote, nghĩa VI, context

Tỷ lệ feed cố định: **40% vocab · 25% grammar · 20% quiz · 15% quote**
(`src/lib/types.ts` → `FEED_RATIO`).

## Interaction (chốt)

- **React** `👍 OK` / `🆕 New` — feedback/phản xạ, **mỗi card react 1 lần**, optional,
  không confirm. (`card_reactions`, UNIQUE(user, card))
- **Save** `📌` — action riêng, toggle save/unsave, **không tính là react**.

## Feed logic (`src/lib/feed.ts`)

Rule-based, **không ML**:

- **Adaptive score** (section 6.2): ưu tiên card có New rate / Save rate cao và card
  user chưa react; giảm card user đã OK hoặc đã thấy > 2 lần.
- **Weighted theo level** user chọn (level khác bị giảm trọng số, không loại hẳn).
- **Interleave** bằng smooth weighted round-robin theo tỷ lệ trên, đảm bảo
  **không 2 card cùng type liền nhau** (nên không bao giờ 2 quiz liên tiếp).
- **Anti-repeat**: client gửi `exclude` = id đã thấy → không lặp trong 1 session.

## Content generation — bulk, real, usable (không phải data test)

Có sẵn generator sinh nội dung **thật, dùng được** cho từng type, qua QC (draft→publish):

```bash
# 1) Bank offline — curated, chạy KHÔNG cần API key (đã review sẵn):
npm run generate -- --source=bank --type=all                 # nạp vào draft
npm run generate -- --source=bank --type=all --status=published  # publish thẳng (bank đã review)

# 2) LLM mode — dùng đúng 5 prompt chuẩn + Claude (claude-opus-4-8), scale tới nghìn card:
export ANTHROPIC_API_KEY=sk-ant-...        # hoặc `ant auth login`
npm run generate -- --source=llm --type=vocab --count=1000          # sync, ~4 luồng
npm run generate -- --source=llm --type=all   --count=1000 --batch  # Batches API (rẻ 50%, cho khối lượng lớn)
```

Cờ: `--type=vocab|quiz|grammar|quote|video|all`, `--count=N`, `--levels=A2,B1,B2`,
`--topics=đời sống,công việc,…`, `--out=file.jsonl` (ghi ra file thay vì DB), `--perCall=15`.

**Kiến trúc** (`scripts/`):
- `content/banks/*.json` — nguồn thật, do người biên tập (phrases/idioms, lỗi người Việt, quote đời thực). Vocab/grammar/quote lấy trực tiếp; quiz sinh từ vocab+grammar (đúng spec "quiz sinh từ nội dung đã có"); video là script (creator gắn clip sau).
- `scripts/lib/prompts.mjs` — **5 prompt chuẩn** của bạn (vocab / mini_quiz / grammar_tip / quote / video_script) + JSON schema (structured outputs, ép JSON hợp lệ) + map `A2/B1/B2 → basic/intermediate/advanced` + `react_hint` mặc định theo type.
- `scripts/generate.mjs` — dedup theo nội dung, **auto-QC** (bỏ card lỗi: quiz phải đúng 1 đáp án & distractor không trùng, grammar phải khác nhau dont≠say, quote ≤ 90 ký tự, …), rồi ghi.

**Kỷ luật:** LLM mode **luôn** ghi `status='draft'` — không bao giờ auto-publish; phải qua người duyệt ở `/admin`. Chỉ bank (đã review) mới publish thẳng.

> Đạt "1000/type": chạy `--source=llm --count=1000` cho từng type (Batches API cho khối lượng lớn). Card vào draft → duyệt ở `/admin` → publish. Bank đảm bảo chất lượng ngay lập tức, LLM lo phần số lượng.

## Content pipeline & QC (sống còn)

`AI Draft → Human Review (bắt buộc) → Publish`. **Chỉ `status = 'published'` mới vào feed.**
Không auto-publish. Tạo draft: `POST /api/admin/cards`; duyệt: `POST /api/admin/review`
(`approve` → published, `reject` → rejected + note). UI ở `/admin`.

Admin có thể khoá bằng biến môi trường `ADMIN_KEY` (gửi qua header `x-admin-key`
hoặc `?key=`). Nếu không set → mở (tiện cho local/soft-launch).

## Streak & self-awareness (anti-addiction)

- Streak +1 khi user react ≥ 1 card / ngày (`src/lib/user.ts` → `touchStreak`).
  Reset sau khi bỏ 1 ngày. Không freeze, không badge.
- Cuối session: **"You learned N cards today"** — reward = tự nhận thức, không dopamine rỗng.
- Không push spam, không "you might like this", không algorithm kiểu social.

## Data model

`cards`, `card_reactions`, `saved_cards`, `quiz_answers` (theo spec) +
`users` (level, streak, email, password_hash, provider, is_premium),
`sessions` (auth), `card_views` (anti-repeat), `events` (analytics),
`decks` + `deck_cards` (Phase 2 premium decks), `review_state` (Phase 2 SR).
Schema + migration additive: `src/lib/db.ts`.

## Analytics (section 8)

Per-card: OK/New/Save rate, seen count. Per-user/product: users, reactions, saves,
avg cards/session. Xem ở `/admin/stats`. Raw events trong bảng `events`.

## Kỷ luật sản phẩm

Không comment, không chat, không thêm react, không gamification phức tạp.
Nếu một feature không giúp user **lướt + hiểu nhanh hơn → không làm.**

## Phase 2 (đã build)

- **Review deck** — spaced repetition nhẹ (SM-2 lite, `src/lib/review.ts`) trên tập
  thẻ đã lưu. Flashcard active-recall + 4 mức Again/Hard/Good/Easy → lịch ôn tự động
  (`review_state.due_date`). UI `/review`.
- **Video card (type D+)** — card type `video` (creator-permitted clip): render
  `<video>` trong feed, có trong pipeline & seed. `src/lib/types.ts` → `VideoContent`.
- **Premium decks** — decks theo chủ đề (`content/decks.json`), deck `is_premium`
  bị khoá cho tới khi user (đã đăng nhập) mở Premium. Gating ở
  `src/lib/decks.ts` + `/api/decks/*`. `POST /api/decks/unlock` là demo-grant
  (thực tế thay bằng payment webhook).

> Vẫn giữ kỷ luật chống-social của spec: **không** chat/comment/follow/social graph.

## Env config

Xem `.env.example`. Tất cả **tuỳ chọn** — app chạy đủ (anonymous + email auth +
feed + phase 2) mà không cần biến nào. Google login và khoá `/admin` bật lên khi
set biến tương ứng.
