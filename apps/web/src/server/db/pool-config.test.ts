import { getPoolConfigFromEnv } from "@nurseconnect/database";
import { describe, it, expect } from "vitest";

describe("getPoolConfigFromEnv", () => {
    it("should throw if no URL is provided", () => {
        expect(() => getPoolConfigFromEnv({})).toThrow("Neither DATABASE_URL nor DATABASE_POOL_URL is set");
    });

    it("should prefer DATABASE_POOL_URL over DATABASE_URL", () => {
        const config = getPoolConfigFromEnv({
            DATABASE_URL: "postgresql://localhost/direct",
            DATABASE_POOL_URL: "postgresql://localhost/pool",
        });
        expect(config.connectionString).toBe("postgresql://localhost/pool");
    });

    it("should parse MAX and MIN limits correctly", () => {
        const config = getPoolConfigFromEnv({
            DATABASE_URL: "postgresql://localhost/direct",
            PGPOOL_MAX: "20",
            PGPOOL_MIN: "5",
        });
        expect(config.max).toBe(20);
        expect(config.min).toBe(5);
    });

    it("should parse timeout ms and lifecycle bindings", () => {
        const config = getPoolConfigFromEnv({
            DATABASE_URL: "postgresql://localhost/direct",
            PGPOOL_IDLE_TIMEOUT_MS: "5000",
            PGPOOL_CONNECTION_TIMEOUT_MS: "2000",
            PGPOOL_MAX_LIFETIME_SECONDS: "300",
            PGPOOL_ALLOW_EXIT_ON_IDLE: "true",
        });
        expect(config.idleTimeoutMillis).toBe(5000);
        expect(config.connectionTimeoutMillis).toBe(2000);
        expect(config.maxLifetimeSeconds).toBe(300);
        expect(config.allowExitOnIdle).toBe(true);
    });

    it("should ignore invalid numbers", () => {
        const config = getPoolConfigFromEnv({
            DATABASE_URL: "postgresql://localhost/direct",
            PGPOOL_MAX: "invalid",
            PGPOOL_MIN: "-5",
        });
        expect(config.max).toBeUndefined();
        expect(config.min).toBeUndefined();
    });
});
