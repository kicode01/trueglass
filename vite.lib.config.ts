import { copyFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  publicDir: false,
  build: {
    target: "es2022",
    outDir: "dist-lib",
    emptyOutDir: true,
    sourcemap: true,
    minify: false,
    lib: {
      entry: {
        index: resolve(__dirname, "src/index.ts"),
        "core/index": resolve(__dirname, "src/core/index.ts"),
        "components/index": resolve(__dirname, "src/components/index.ts"),
      },
      formats: ["es"],
    },
    rollupOptions: {
      output: {
        chunkFileNames: "chunks/[name]-[hash].js",
      },
    },
  },
  plugins: [
    {
      name: "copy-trueglass-css",
      closeBundle() {
        mkdirSync(resolve(__dirname, "dist-lib"), { recursive: true });
        copyFileSync(resolve(__dirname, "src/trueglass.css"), resolve(__dirname, "dist-lib/styles.css"));
      },
    },
  ],
});
