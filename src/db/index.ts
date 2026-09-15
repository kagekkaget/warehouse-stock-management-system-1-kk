import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

/** Normalisasi connection string: buang paramater yang tidak didukung oleh klien `pg` Node
 * (mis. `channel_binding`) agar tidak menyebabkan `ECONNREFUSED`. */
function normalizeDatabaseUrl(url: string): string {
  try {
    const parsed = new URL(url);
    // Hapus parameter yang tidak dikenali oleh driver pg Node.
    parsed.searchParams.delete("channel_binding");
    // Pastikan sslmode yang dikenali driver (verify-full) bila yang diberikan adalah require.
    const sslmode = parsed.searchParams.get("sslmode");
    if ((sslmode === "require" || sslmode === "prefer" || sslmode === "verify-ca") && !parsed.searchParams.has("uselibpqcompat")) {
      parsed.searchParams.set("uselibpqcompat", "true");
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
};

export const pool =
  globalForDb.__arenaNextJsPostgresqlPool ??
  new Pool({
    connectionString: normalizeDatabaseUrl(databaseUrl),
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__arenaNextJsPostgresqlPool = pool;
}

export const db = drizzle(pool);
