import type { Config } from "drizzle-kit";

export default {
  schema: "./packages/database/src/schema/index.ts",
  out: "./packages/database/drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
} satisfies Config;
