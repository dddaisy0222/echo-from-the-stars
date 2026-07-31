import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import {
  copyFileSync,
  cpSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
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
        copyFileSync(
          join(projectRoot, "public", "world", "bedroom.spz"),
          join(coworkOut, "world", "bedroom.spz"),
        );
        copyFileSync(
          join(projectRoot, "public", "world", "bedroom-collider.glb"),
          join(coworkOut, "world", "bedroom-collider.glb"),
        );
        for (const runtimeFile of [
          "server.mjs",
          "install.sh",
          "start.sh",
          "health.sh",
        ]) {
          copyFileSync(
            join(projectRoot, "cowork-runtime", runtimeFile),
            join(coworkOut, runtimeFile),
          );
        }
        copyFileSync(
          join(projectRoot, "lib", "echo-runtime.ts"),
          join(coworkOut, "echo-runtime.ts"),
        );

        // CoWork injects an app-root <base> tag. The world page therefore
        // needs root-relative-to-that-base asset tags, while the duplicate
        // directory keeps the same build working in ordinary local hosting.
        cpSync(join(coworkOut, "assets"), join(coworkOut, "world", "assets"), {
          recursive: true,
        });
        const worldHtmlPath = join(coworkOut, "world", "index.html");
        writeFileSync(
          worldHtmlPath,
          readFileSync(worldHtmlPath, "utf8").replaceAll(
            "../assets/",
            "./assets/",
          ),
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
