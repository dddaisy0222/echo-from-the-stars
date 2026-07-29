import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { fileURLToPath, URL } from "node:url";

const coworkRoot = fileURLToPath(
  new URL("./cowork-mirofish-lab", import.meta.url),
);

export default defineConfig({
  root: coworkRoot,
  publicDir: fileURLToPath(new URL("./public", import.meta.url)),
  base: "./",
  plugins: [react()],
  build: {
    outDir: fileURLToPath(new URL("./dist-cowork", import.meta.url)),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: fileURLToPath(
          new URL("./cowork-mirofish-lab/index.html", import.meta.url),
        ),
        world: fileURLToPath(
          new URL("./cowork-mirofish-lab/world/index.html", import.meta.url),
        ),
      },
    },
  },
});
