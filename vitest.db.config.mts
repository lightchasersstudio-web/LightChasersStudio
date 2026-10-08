import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

// Database tests against the hosted DEV project (see supabase/tests/database.test.ts).
// Reads DATABASE_URL_TEST from .env.local / .env.
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    include: ["supabase/tests/**/*.test.ts"],
    env: loadEnv("development", process.cwd(), ""),
    testTimeout: 30_000,
    fileParallelism: false,
  },
});
