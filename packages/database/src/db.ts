import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";
import { getPoolConfigFromEnv } from "./pool-config";

// Attach the pool to globalThis to prevent exhaustion during hot reloads
// in development and effectively reuse connections.
const globalForDb = globalThis as unknown as {
    __dbPool?: Pool;
};

const setupPool = () => {
    const pool = new Pool(getPoolConfigFromEnv(process.env));

    // Handle unexpected errors on idle clients (strongly recommended by pg)
    pool.on("error", (err) => {
        console.error("Unexpected error on idle client", err);
    });

    return pool;
};

export const dbPool = globalForDb.__dbPool ?? setupPool();

// Keep a constant reference to the pool across Next.js dev HMR reloads and within a warm serverless instance.
if (process.env.NODE_ENV !== "production") {
    globalForDb.__dbPool = dbPool;
}

export const db = drizzle(dbPool, { schema });
export type DbClient = typeof db;
