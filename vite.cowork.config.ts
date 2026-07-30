import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { copyFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, URL } from "node:url";

const coworkRoot = fileURLToPath(
  new URL("./cowork-mirofish-lab", import.meta.url),
);
const projectRoot = fileURLToPath(new URL(".", import.meta.url));
const coworkOut = fileURLToPath(new URL("./dist-cowork", import.meta.url));

export default defineConfig({
  root: coworkRoot,
  publicDir: false,
  base: "./",
  plugins: [
    react(),
    {
      name: "echo-cowork-assets",
      writeBundle() {
        mkdirSync(join(coworkOut, "world"), { recursive: true });
        copyFileSync(
          join(projectRoot, "public", "echo-memory-room-v1.png"),
          join(coworkOut, "echo-memory-room-v1.png"),
        );
      },
    },
  ],
  build: {
    outDir: coworkOut,
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
