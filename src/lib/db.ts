import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import postgres from "postgres";
import * as schema from "./schema";

// ---------------------------------------------------------------------------
// Postgres connection (postgres.js) + Drizzle ORM. A single pooled client is
// cached across HMR reloads in dev so we don't leak connections.
// ---------------------------------------------------------------------------

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error(
    "DATABASE_URL is not set — copy .env.example to .env.local and set it.",
  );
}

const globalForDb = globalThis as unknown as {
  __engscrollSql?: ReturnType<typeof postgres>;
};

const client = globalForDb.__engscrollSql ?? postgres(url, { max: 10 });
if (process.env.NODE_ENV !== "production") globalForDb.__engscrollSql = client;

export const db = drizzle(client, { schema });

// SQL fragments reproducing SQLite's datetime('now') / date('now') as the same
// UTC "YYYY-MM-DD HH:MM:SS" / "YYYY-MM-DD" text format the app already expects.
export const NOW_TEXT = sql`to_char((now() AT TIME ZONE 'UTC'), 'YYYY-MM-DD HH24:MI:SS')`;
export const TODAY_TEXT = sql`to_char((now() AT TIME ZONE 'UTC'), 'YYYY-MM-DD')`;

// Thin raw-SQL helpers over Drizzle. `q` returns all rows, `q1` the first row.
// Params interpolated with ${} are safely parameterized.
export async function q<T = Record<string, unknown>>(
  query: import("drizzle-orm").SQL,
): Promise<T[]> {
  return (await db.execute(query)) as unknown as T[];
}
export async function q1<T = Record<string, unknown>>(
  query: import("drizzle-orm").SQL,
): Promise<T | undefined> {
  return (await q<T>(query))[0];
}
