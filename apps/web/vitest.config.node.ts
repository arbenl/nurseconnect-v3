import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        environment: "node",
        fileParallelism: false,
        include: [
            "src/server/**/*.db.test.ts",
            "src/server/**/*.test.ts",
            "src/server/**/*.test.tsx",
            "src/app/api/**/*.db.test.ts",
            "src/app/api/**/*.test.ts",
        ],
        testTimeout: 30_000,
        hookTimeout: 30_000,
    },
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "src"),
        },
    },
});
