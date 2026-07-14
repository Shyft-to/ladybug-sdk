import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/defi/**/*.ts"],
      exclude: ["src/defi/**/*.test.ts", "src/defi/idl-files/**"],
    },
  },
});
