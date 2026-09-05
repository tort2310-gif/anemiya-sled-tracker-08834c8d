// Standalone Vitest config, deliberately separate from vite.config.ts —
// that file is wrapped by @lovable.dev/vite-tanstack-config and its own
// comment warns not to add plugins to it manually. Tests only need the
// `@` path alias, nothing from tanstackStart/nitro/etc.
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
