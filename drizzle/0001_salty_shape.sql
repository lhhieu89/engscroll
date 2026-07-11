ALTER TABLE "cards" ADD COLUMN "slug" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "level_locked" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_cards_seo" ON "cards" USING btree ("status","type","slug");