import { sql } from "@nurseconnect/database";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";


describe("Database Connection Pool Pressure", () => {
    // Save originals to restore later
    const originalEnv = { ...process.env };
    let originalPool: any;

    beforeEach(() => {
        // Clear out modules so we get a fresh import
        vi.resetModules();
        originalPool = (globalThis as any).__dbPool;
        (globalThis as any).__dbPool = undefined;
    });

    afterEach(() => {
        // Restore process env and singleton exactly
        process.env = { ...originalEnv };
        (globalThis as any).__dbPool = originalPool;
    });

    it("enforces connection limits and allows waiting queue under pressure", async () => {
        // Stub to max exactly 1 connection
        process.env.PGPOOL_MAX = "1";

        // We import database dynamically to instantiate it post env variable modification
        const { db, dbPool } = await import("@nurseconnect/database");

        // Start 3 concurrent transactions
        const query1 = db.execute(sql`SELECT pg_sleep(0.3)`);
        const query2 = db.execute(sql`SELECT pg_sleep(0.3)`);
        const query3 = db.execute(sql`SELECT pg_sleep(0.3)`);

        // Only 1 of them should immediately get a connection from the pool.
        // Small delay to ensure the pool actually checks out the connection
        await new Promise(resolve => setTimeout(resolve, 50));

        // Total connections should not exceed our PGPOOL_MAX limit of 1
        expect(dbPool.totalCount).toBeLessThanOrEqual(1);

        // Drain them to leave test gracefully
        await Promise.all([query1, query2, query3]);

        // Cleanup singleton properly for standard testing tear down
        await dbPool.end();
    });
});
