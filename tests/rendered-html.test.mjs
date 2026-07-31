import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  createGroundedFallback,
  sanitizeEchoChatPayload,
  validateEchoOutput,
} from "../lib/echo-runtime.ts";

const root = new URL("../", import.meta.url);

test("ships the complete Echo journey and world handoff", async () => {
  const [page, worker, world] = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("worker/index.ts", root), "utf8"),
    readFile(new URL("app/world/page.tsx", root), "utf8"),
  ]);

  assert.match(page, /降临在这个世界/);
  assert.match(page, /找到那条没走的路/);
  assert.doesNotMatch(page, /MBTI/);
  assert.match(page, /语音输入/);
  assert.match(page, /另一个你，已经在这里生活了五年/);
  assert.match(page, /localStorage\.setItem\("echo\.worldState"/);
  assert.match(worker, /url\.pathname === "\/api\/chat"/);
  assert.match(worker, /url\.pathname === "\/api\/world"/);
  assert.match(worker, /REDNOTE_API_KEY/);
  assert.match(page, /\/api\/world/);
  assert.match(world, /mountMarbleWorld/);
  const marbleWorld = await readFile(
    new URL("app/world/engine/MarbleWorld.js", root),
    "utf8",
  );
  const chatPanel = await readFile(
    new URL("app/world/engine/components/WorldChatPanel.js", root),
    "utf8",
  );
  assert.match(marbleWorld, /SplatMesh/);
  assert.match(marbleWorld, /createMemoryObjects/);
  assert.match(marbleWorld, /\/\?returned=1/);
  assert.match(chatPanel, /\/api\/chat/);
});

test("does not commit model credentials into the product source", async () => {
  const worker = await readFile(new URL("worker/index.ts", root), "utf8");
  assert.doesNotMatch(worker, /MAAS[a-zA-Z0-9]{16,}/);
  assert.doesNotMatch(worker, /api-key["']?\s*:\s*["'][^"']{12,}/);
});

test("Echo runtime keeps facts inside its evidence boundary", () => {
  const request = sanitizeEchoChatPayload({
    message: "其实我现在在小红书工作，但你会羡慕我吗",
    characterId: "parallel-self",
    conversationHistory: [
      {
        id: "turn-1",
        role: "user",
        content: "我后来留在了杭州。",
      },
    ],
    worldContext: {
      sceneId: "ningbo-mobile",
      sceneDescription: "我在宁波移动工作了一年，通勤很短，但工作内容重复。",
      nearbyObject: "桌面上放着一份反复修改的汇报材料。",
      collectedItems: ["季度竞聘通知：晋升路径清楚，但名额有限。"],
      previousChoices: ["没有立刻回复猎头消息"],
      sharedOrigin: ["岔路口曾在宁波移动和小红书之间选择。"],
      parallelMemories: ["上周迎检连续加班了三个晚上。"],
      otherPath: {
        knownAtFork: ["用户在现实中选择了小红书。"],
        userDisclosures: [],
        knownUnknowns: ["用户在小红书的具体工作体验未知。"],
      },
      personalMemorySummary: "这段内容不应进入证据账本。",
    },
  });

  assert.ok(request);
  assert.ok(
    request.evidence.some(
      (item) =>
        item.kind === "user_disclosure" &&
        item.content.includes("小红书工作"),
    ),
  );
  assert.ok(
    request.evidence.every(
      (item) => !item.content.includes("不应进入证据账本"),
    ),
  );

  const worldEvidence = request.evidence.find(
    (item) =>
      item.kind === "current_state" &&
      item.content.includes("宁波移动工作了一年"),
  );
  assert.ok(worldEvidence);
  const valid = validateEchoOutput(
    {
      schema_version: "echo-runtime-output.v1",
      reply: {
        text: "我会想过那条路，但我并不知道你在小红书具体过得怎样。",
        move: "compare",
        epistemic_position: "counterfactual_projection",
      },
      claims: [
        {
          claim_id: "claim_1",
          text_span: "我会想过那条路，但我并不知道你在小红书具体过得怎样",
          epistemic_status: "counterfactual_projection",
          evidence_refs: [
            request.evidence.find((item) => item.kind === "fork_fact").id,
          ],
        },
      ],
      used_evidence_ids: [
        request.evidence.find((item) => item.kind === "fork_fact").id,
      ],
    },
    request.evidence,
    request.message,
  );
  assert.equal(valid?.gate.passed, true);

  const invented = validateEchoOutput(
    {
      schema_version: "echo-runtime-output.v1",
      reply: {
        text: "你在小红书每天都很快乐。",
        move: "answer",
        epistemic_position: "lived_answer",
      },
      claims: [
        {
          claim_id: "claim_1",
          text_span: "你在小红书每天都很快乐",
          epistemic_status: "grounded_current_state",
          evidence_refs: ["invented:fact"],
        },
      ],
      used_evidence_ids: ["invented:fact"],
    },
    request.evidence,
    request.message,
  );
  assert.equal(invented?.gate.passed, false);
  assert.ok(invented?.gate.violations.includes("unknown_evidence:invented:fact"));
});

test("Echo fallback preserves uncertainty instead of coaching the user", () => {
  const reply = createGroundedFallback("那我现在应该怎么办？", []);
  assert.match(reply.reply.text, /没有足够的经历|说不死/);
  assert.doesNotMatch(
    reply.reply.text,
    /你真正想要|你应该|发出那封信|最小动作/,
  );
});
