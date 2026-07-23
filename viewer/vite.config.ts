import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "node:path";

/** Ship only woff2 for KaTeX (drop redundant ttf/woff). */
function katexWoff2Only(): Plugin {
  return {
    name: "katex-woff2-only",
    transform(code, id) {
      if (!id.includes("katex") || !id.endsWith(".css")) return null;
      // Drop url(...) format("truetype"|"woff") entries; keep woff2.
      let next = code.replace(
        /url\(([^)]+)\)\s*format\(["'](?:truetype|woff)["']\)\s*,?\s*/g,
        "",
      );
      // Clean double commas / trailing commas before }
      next = next.replace(/,\s*}/g, "}");
      next = next.replace(/,\s*,/g, ",");
      return next;
    },
    generateBundle(_opts, bundle) {
      for (const fileName of Object.keys(bundle)) {
        if (/KaTeX_.*\.(ttf|woff)$/.test(fileName)) {
          delete bundle[fileName];
        }
      }
    },
  };
}

export default defineConfig({
  root: resolve(__dirname),
  plugins: [react(), tailwindcss(), katexWoff2Only()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
  base: "/",
  build: {
    outDir: resolve(__dirname, "dist"),
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      // Served at runtime via import map + /vendor/three (see server).
      external: ["three", /^three\//],
      output: {
        paths: {
          three: "/vendor/three/build/three.module.js",
        },
      },
    },
  },
  server: {
    port: 5173,
  },
});

