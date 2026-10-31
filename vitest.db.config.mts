import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: { "server-only": fileURLToPath(new URL("./tests/stubs/server-only.ts", import.meta.url)) },
  },
  test: {
    include: ["tests/db/**/*.test.ts"],
    environment: "node",
    fileParallelism: false,
    testTimeout: 30000,
    setupFiles: ["./tests/db/setup-env.ts"],
  },
});
