import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";
import { getPoolConfigFromEnv } from "./pool-config";
import { getTenantObservationContext } from "./tenant-context";
import { tenantQueryObserver } from "./tenant-query-observer";

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

const baseDb = drizzle(dbPool, { logger: tenantQueryObserver, schema });

const proxyCaches = [new WeakMap<object, object>(), new WeakMap<object, object>()];

function guardGlobalValue<T>(value: T, operation = "unknown", guarded = false, owner?: object): T {
    if ((typeof value !== "object" || value === null) && typeof value !== "function") return value;
    if (typeof value === "function") {
        return new Proxy(value, {
            apply(target, _thisArg, args) {
                const context = getTenantObservationContext();
                const shouldRecord = Boolean(context) && !guarded;
                if (context && shouldRecord) tenantQueryObserver.recordWrongExecutor(context.boundary, operation);
                const result = Reflect.apply(target, owner, args) as unknown;
                return guardGlobalValue(result, operation, guarded || shouldRecord);
            },
        }) as T;
    }

    const cache = proxyCaches[guarded ? 1 : 0]!;
    const cached = cache.get(value);
    if (cached) return cached as T;
    const proxy = new Proxy(value, {
        get(target, property) {
            const child = Reflect.get(target, property, target) as unknown;
            const nextOperation = operation === "unknown" || (operation === "query" && typeof child === "function")
                ? String(property)
                : operation;
            return guardGlobalValue(child, nextOperation, guarded, target);
        },
    });
    cache.set(value, proxy);
    return proxy as T;
}

export const db = guardGlobalValue(baseDb);
export type DbClient = typeof db;
export type DbTransaction = Parameters<Parameters<DbClient["transaction"]>[0]>[0];
export type DbExecutor = DbClient | DbTransaction;
