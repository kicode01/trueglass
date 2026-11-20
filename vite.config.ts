import { defineConfig } from "vitest/config";

export default defineConfig({
  server: {
    port: 5173,
    open: false,
  },
  build: {
    target: "es2022",
    outDir: "dist",
    sourcemap: false,
    minify: "esbuild",
  },
  test: {
    environment: "jsdom",
    globals: false,
    include: ["test/**/*.test.ts"],
  },
});
