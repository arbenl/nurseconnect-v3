import type { PoolConfig } from "pg";

/**
 * Parses Postgres pool configuration from raw environment variables.
 * Safe to unit-test without a real `process.env`.
 */
export function getPoolConfigFromEnv(env: Record<string, string | undefined>): PoolConfig {
    // Prefer the pooled URL if available, otherwise fallback to the direct database URL.
    const connectionString = env.DATABASE_POOL_URL || env.DATABASE_URL;

    if (!connectionString) {
        throw new Error("Neither DATABASE_URL nor DATABASE_POOL_URL is set");
    }

    const config: PoolConfig = {
        connectionString,
    };

    if (env.PGPOOL_MAX) {
        const max = parseInt(env.PGPOOL_MAX, 10);
        if (!isNaN(max) && max > 0) config.max = max;
    }

    if (env.PGPOOL_MIN) {
        const min = parseInt(env.PGPOOL_MIN, 10);
        if (!isNaN(min) && min >= 0) config.min = min;
    }

    if (env.PGPOOL_IDLE_TIMEOUT_MS) {
        const idleTimeoutMillis = parseInt(env.PGPOOL_IDLE_TIMEOUT_MS, 10);
        if (!isNaN(idleTimeoutMillis) && idleTimeoutMillis >= 0) config.idleTimeoutMillis = idleTimeoutMillis;
    }

    if (env.PGPOOL_CONNECTION_TIMEOUT_MS) {
        const connectionTimeoutMillis = parseInt(env.PGPOOL_CONNECTION_TIMEOUT_MS, 10);
        if (!isNaN(connectionTimeoutMillis) && connectionTimeoutMillis >= 0) config.connectionTimeoutMillis = connectionTimeoutMillis;
    }

    if (env.PGPOOL_MAX_LIFETIME_SECONDS) {
        const maxLifetimeSeconds = parseInt(env.PGPOOL_MAX_LIFETIME_SECONDS, 10);
        if (!isNaN(maxLifetimeSeconds) && maxLifetimeSeconds >= 0) config.maxLifetimeSeconds = maxLifetimeSeconds;
    }

    if (env.PGPOOL_ALLOW_EXIT_ON_IDLE) {
        config.allowExitOnIdle = env.PGPOOL_ALLOW_EXIT_ON_IDLE === "true";
    }

    return config;
}
