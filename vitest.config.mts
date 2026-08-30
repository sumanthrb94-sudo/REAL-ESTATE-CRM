import { defineConfig } from "vitest/config";

export default defineConfig({
  // Vite resolves the "@/*" paths from tsconfig.json natively; no plugin needed.
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    // Auth tests read SESSION_SECRET; pin it so they don't depend on the shell.
    env: {
      SESSION_SECRET: "test-secret-that-is-at-least-32-characters-long",
    },
  },
});
