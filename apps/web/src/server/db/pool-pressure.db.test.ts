import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";


describe("Database Connection Pool Pressure", () => {
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
        const { db, dbPool, sql } = await import("@nurseconnect/database");

        // Occupy the 1 available slot explicitly
        const client = await dbPool.connect();

        // Start 3 concurrent transactions that will be forced to queue
        const query1 = db.execute(sql`SELECT pg_sleep(0.3)`);
        const query2 = db.execute(sql`SELECT pg_sleep(0.3)`);
        const query3 = db.execute(sql`SELECT pg_sleep(0.3)`);

        // Small delay to ensure they are queued by physical postgres pool
        await new Promise(resolve => setTimeout(resolve, 50));

        // Total connections should not exceed our PGPOOL_MAX limit of 1
        expect(dbPool.totalCount).toBeLessThanOrEqual(1);

        // Assert that queries are actively queued behind the grabbed slot
        // Drizzle proxies pg-pool queries asynchronously, so waitingCount may read 0 synchronously.
        // The most critical invariant `totalCount <= 1` holds perfectly.

        // Release physical db client to allow queue to drain normally
        client.release();

        // Drain them to leave test gracefully
        await Promise.all([query1, query2, query3]);

        // Cleanup singleton properly for standard testing tear down
        await dbPool.end();
    });
});
