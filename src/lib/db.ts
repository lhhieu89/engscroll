import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import postgres from "postgres";
import * as schema from "./schema";

// ---------------------------------------------------------------------------
// Postgres connection (postgres.js) + Drizzle ORM. A single pooled client is
// cached across HMR reloads in dev so we don't leak connections.
// ---------------------------------------------------------------------------

const globalForDb = globalThis as unknown as {
  __engscrollSql?: ReturnType<typeof postgres>;
};

// Lazily connect on first use, not at import. `next build` imports this module
// while collecting page data (e.g. the sitemap metadata route) with no DB
// reachable — an eager DATABASE_URL check there fails the build. Deferring the
// check to the first query keeps the connection (and the error) at request time.
let dbInstance: ReturnType<typeof drizzle<typeof schema>> | null = null;
function getDb() {
  if (dbInstance) return dbInstance;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set — copy .env.example to .env.local and set it.",
    );
  }
  const client = globalForDb.__engscrollSql ?? postgres(url, { max: 10 });
  if (process.env.NODE_ENV !== "production") globalForDb.__engscrollSql = client;
  dbInstance = drizzle(client, { schema });
  return dbInstance;
}

// Proxy so existing `db.execute(...)` call sites keep working while the real
// Drizzle instance is created only on first property access.
export const db = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
  get(_target, prop) {
    const real = getDb() as unknown as Record<string | symbol, unknown>;
    const value = real[prop];
    return typeof value === "function" ? value.bind(real) : value;
  },
});

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
