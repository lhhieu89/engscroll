// Backfill the cards.slug column that powers SEO landing pages.
//
//   node --env-file=.env.local scripts/backfill-slugs.mjs
//
// Idempotent: adds the column + index if missing, then (re)computes a URL-safe
// slug from each card's headword / phrase / grammar title. Quiz cards get no
// slug (no standalone landing page). Safe to re-run after importing content.
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL not set — run with --env-file=.env.local");
  process.exit(1);
}
const sql = postgres(url, { max: 8 });

// Must match the slugify() copies in src/lib/seo.ts and src/lib/share.ts so the
// stored slug equals the path the share button builds. Transliterates Vietnamese
// /accents to ASCII (không dấu) so letters survive; pure-ASCII English unchanged.
function slug(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip combining diacritics (incl. horn)
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function slugForCard(type, content) {
  try {
    const c = typeof content === "string" ? JSON.parse(content) : content;
    if (type === "vocab") return slug(c.word);
    if (type === "expression") return slug(c.text);
    if (type === "grammar") return slug(c.title || c.say || c.explain_vi);
    if (type === "quote") return slug(c.quote);
    return null; // quiz → no landing page
  } catch {
    return null;
  }
}

async function main() {
  console.log("• ensuring slug column + index…");
  await sql`ALTER TABLE cards ADD COLUMN IF NOT EXISTS slug text`;
  await sql`CREATE INDEX IF NOT EXISTS idx_cards_seo ON cards (status, type, slug)`;

  const types = ["vocab", "expression", "grammar", "quote"];
  let total = 0;
  for (const type of types) {
    const rows = await sql`
      SELECT id, content_json FROM cards WHERE type = ${type}`;
    const updates = [];
    for (const r of rows) {
      const s = slugForCard(type, r.content_json);
      if (s) updates.push({ id: r.id, slug: s });
    }
    // Update in parallel batches (fast enough for a one-time backfill).
    const BATCH = 200;
    for (let i = 0; i < updates.length; i += BATCH) {
      const chunk = updates.slice(i, i + BATCH);
      await Promise.all(
        chunk.map(
          (u) => sql`UPDATE cards SET slug = ${u.slug} WHERE id = ${u.id}`,
        ),
      );
    }
    total += updates.length;
    console.log(`  ${type}: ${updates.length} slugs`);
  }

  const [{ pages }] = await sql`
    SELECT count(DISTINCT (type, slug)) AS pages
    FROM cards WHERE status = 'published' AND slug IS NOT NULL`;
  console.log(`✓ backfilled ${total} card slugs → ${pages} distinct published landing pages`);
  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
