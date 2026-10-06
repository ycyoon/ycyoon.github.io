import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const root = fileURLToPath(new URL(".", import.meta.url));
const output = fileURLToPath(new URL("../dist-github", import.meta.url));

export default defineConfig({
  root,
  base: "/ai-star-scoreboard/",
  plugins: [react()],
  publicDir: "public",
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL("./index.html", import.meta.url)),
        papers: fileURLToPath(new URL("./papers.html", import.meta.url)),
      },
    },
    outDir: output,
    emptyOutDir: true,
  },
});
