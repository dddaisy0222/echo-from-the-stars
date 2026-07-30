import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("ships the complete Echo journey and world handoff", async () => {
  const [page, worker, world] = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("worker/index.ts", root), "utf8"),
    readFile(new URL("app/world/engine/MarbleWorld.js", root), "utf8"),
  ]);

  assert.match(page, /降临在这个世界/);
  assert.match(page, /回去/);
  assert.match(page, /向前/);
  assert.match(page, /语音输入/);
  assert.match(page, /另一个你，已经在这里生活了五年/);
  assert.match(page, /localStorage\.setItem\("echo\.worldState"/);
  assert.match(worker, /url\.pathname === "\/api\/chat"/);
  assert.match(worker, /REDNOTE_API_KEY/);
  assert.match(world, /createMemoryObjects\(this\.worldState\)/);
  assert.match(world, /\/\?returned=1/);
});

test("does not commit model credentials into the product source", async () => {
  const worker = await readFile(new URL("worker/index.ts", root), "utf8");
  assert.doesNotMatch(worker, /MAAS[a-zA-Z0-9]{16,}/);
  assert.doesNotMatch(worker, /api-key["']?\s*:\s*["'][^"']{12,}/);
});
