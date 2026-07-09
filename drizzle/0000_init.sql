CREATE TABLE "card_reactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"card_id" text NOT NULL,
	"reaction" text NOT NULL,
	"created_at" text DEFAULT to_char((now() AT TIME ZONE 'UTC'), 'YYYY-MM-DD HH24:MI:SS') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "card_views" (
	"user_id" text NOT NULL,
	"card_id" text NOT NULL,
	"seen_count" integer DEFAULT 0 NOT NULL,
	"last_seen" text DEFAULT to_char((now() AT TIME ZONE 'UTC'), 'YYYY-MM-DD HH24:MI:SS') NOT NULL,
	CONSTRAINT "card_views_user_id_card_id_pk" PRIMARY KEY("user_id","card_id")
);
--> statement-breakpoint
CREATE TABLE "cards" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"level" text NOT NULL,
	"topic" text,
	"content_json" text NOT NULL,
	"audio_url" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"review_note" text,
	"created_at" text DEFAULT to_char((now() AT TIME ZONE 'UTC'), 'YYYY-MM-DD HH24:MI:SS') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deck_cards" (
	"deck_id" text NOT NULL,
	"card_id" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "deck_cards_deck_id_card_id_pk" PRIMARY KEY("deck_id","card_id")
);
--> statement-breakpoint
CREATE TABLE "decks" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"topic" text,
	"level" text,
	"is_premium" integer DEFAULT 0 NOT NULL,
	"created_at" text DEFAULT to_char((now() AT TIME ZONE 'UTC'), 'YYYY-MM-DD HH24:MI:SS') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text,
	"card_id" text,
	"type" text NOT NULL,
	"meta_json" text,
	"created_at" text DEFAULT to_char((now() AT TIME ZONE 'UTC'), 'YYYY-MM-DD HH24:MI:SS') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quiz_answers" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"card_id" text NOT NULL,
	"selected_option" integer NOT NULL,
	"is_correct" integer NOT NULL,
	"created_at" text DEFAULT to_char((now() AT TIME ZONE 'UTC'), 'YYYY-MM-DD HH24:MI:SS') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "review_state" (
	"user_id" text NOT NULL,
	"card_id" text NOT NULL,
	"ease" real DEFAULT 2.5 NOT NULL,
	"interval_days" integer DEFAULT 0 NOT NULL,
	"reps" integer DEFAULT 0 NOT NULL,
	"due_date" text DEFAULT to_char((now() AT TIME ZONE 'UTC'), 'YYYY-MM-DD') NOT NULL,
	"last_reviewed" text,
	CONSTRAINT "review_state_user_id_card_id_pk" PRIMARY KEY("user_id","card_id")
);
--> statement-breakpoint
CREATE TABLE "saved_cards" (
	"user_id" text NOT NULL,
	"card_id" text NOT NULL,
	"created_at" text DEFAULT to_char((now() AT TIME ZONE 'UTC'), 'YYYY-MM-DD HH24:MI:SS') NOT NULL,
	CONSTRAINT "saved_cards_user_id_card_id_pk" PRIMARY KEY("user_id","card_id")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"created_at" text DEFAULT to_char((now() AT TIME ZONE 'UTC'), 'YYYY-MM-DD HH24:MI:SS') NOT NULL,
	"expires_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"level" text,
	"streak" integer DEFAULT 0 NOT NULL,
	"last_active" text,
	"email" text,
	"password_hash" text,
	"name" text,
	"provider" text DEFAULT 'anon' NOT NULL,
	"is_premium" integer DEFAULT 0 NOT NULL,
	"created_at" text DEFAULT to_char((now() AT TIME ZONE 'UTC'), 'YYYY-MM-DD HH24:MI:SS') NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_reactions_user_card" ON "card_reactions" USING btree ("user_id","card_id");--> statement-breakpoint
CREATE INDEX "idx_reactions_card" ON "card_reactions" USING btree ("card_id");--> statement-breakpoint
CREATE INDEX "idx_views_user" ON "card_views" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_cards_status_type" ON "cards" USING btree ("status","type");--> statement-breakpoint
CREATE INDEX "idx_events_type" ON "events" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_review_due" ON "review_state" USING btree ("user_id","due_date");--> statement-breakpoint
CREATE INDEX "idx_saved_user" ON "saved_cards" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_sessions_user" ON "sessions" USING btree ("user_id");