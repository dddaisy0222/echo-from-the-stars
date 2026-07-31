import { createReadStream } from "node:fs";
import { access, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize, relative } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ECHO_RUNTIME_VERSION,
  buildEchoInput,
  buildEchoInstructions,
  parseJsonObject,
  repairEchoOutput,
  sanitizeEchoChatPayload,
  validateEchoOutput,
} from "./echo-runtime.ts";

const root = fileURLToPath(new URL(".", import.meta.url));
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || "0.0.0.0";

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".glb": "model/gltf-binary",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".spz": "application/octet-stream",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url || "/", "http://echo.local");
    const path = stripDeploymentPrefix(url.pathname);

    if (path === "/health" || path === "/api/health") {
      return sendJson(response, 200, {
        ok: true,
        modelConnected: hasModelConfig(),
      });
    }

    if (path === "/api/world" && request.method === "POST") {
      return handleWorld(request, response);
    }

    if (path === "/api/chat" && request.method === "POST") {
      return handleChat(request, response);
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      return sendJson(response, 405, { error: "method_not_allowed" });
    }

    return serveStatic(path, request.method === "HEAD", response);
  } catch (error) {
    console.error(error);
    return sendJson(response, 500, { error: "echo_runtime_error" });
  }
});

server.listen(port, host, () => {
  console.log(`Echo is listening on http://${host}:${port}`);
});

function stripDeploymentPrefix(pathname) {
  const apiIndex = pathname.indexOf("/api/");
  if (apiIndex > 0) return pathname.slice(apiIndex);
  const healthIndex = pathname.indexOf("/health");
  if (healthIndex > 0) return pathname.slice(healthIndex);
  const worldIndex = pathname.indexOf("/world/");
  if (worldIndex > 0) return pathname.slice(worldIndex);
  const assetsIndex = pathname.indexOf("/assets/");
  if (assetsIndex > 0) return pathname.slice(assetsIndex);
  return pathname;
}

async function serveStatic(pathname, isHead, response) {
  let decodedPath;
  try {
    decodedPath = decodeURIComponent(pathname);
  } catch {
    return sendJson(response, 400, { error: "invalid_path" });
  }

  const requested =
    decodedPath === "/"
      ? "index.html"
      : decodedPath.endsWith("/")
        ? `${decodedPath.slice(1)}index.html`
        : decodedPath.slice(1);
  const safePath = normalize(requested).replace(/^(\.\.(\/|\\|$))+/, "");
  let filePath = join(root, safePath);
  if (!isInsideRoot(filePath)) {
    return sendJson(response, 403, { error: "forbidden" });
  }

  try {
    const fileStat = await stat(filePath);
    if (fileStat.isDirectory()) filePath = join(filePath, "index.html");
    await access(filePath);
  } catch {
    filePath = join(root, "index.html");
  }

  const extension = extname(filePath).toLowerCase();
  response.statusCode = 200;
  response.setHeader(
    "Content-Type",
    mimeTypes[extension] || "application/octet-stream",
  );
  response.setHeader(
    "Cache-Control",
    extension === ".html"
      ? "no-cache"
      : "public, max-age=31536000, immutable",
  );
  if (isHead) return response.end();
  createReadStream(filePath).pipe(response);
}

async function handleWorld(request, response) {
  const payload = await readJson(request);
  if (!payload) {
    return sendJson(response, 400, {
      error: "没有读懂世界种子。",
      code: "invalid_request",
    });
  }
  if (!hasModelConfig()) {
    return sendJson(response, 503, {
      error: "模型环境尚未配置，交给 Echo 的本地因果引擎继续生成。",
      code: "model_not_configured",
    });
  }

  const prompt = `你是 Echo 的 Causal World Compiler。根据输入只改变一个关键人生变量，推演一条已经生活五年的平行人生。每条路必须同时有得到、代价与始终没变的东西；不能写爽文、不能替用户做决定、不能使用人格测试定义用户。

只返回合法 JSON，不要 Markdown。严格包含：
{
  "version":3,
  "seed":"一句话",
  "context":"两句话",
  "truth":"暂时的发现",
  "action":"今天能做的小行动",
  "fixedFacts":["三条现实不变量"],
  "changedVariable":"唯一改变变量",
  "centralTension":"A 与 B",
  "userModel":{"desires":[],"fears":[],"attachments":[],"hypothesis":"可修正假设","confidence":0.55},
  "events":[
    {"time":"时间","title":"得到","detail":"具体因果","polarity":"gain"},
    {"time":"时间","title":"代价","detail":"具体因果","polarity":"cost"},
    {"time":"时间","title":"转折","detail":"具体因果","polarity":"turn"}
  ],
  "scenes":[
    {"id":"arrival","time":"时间","place":"地点","title":"标题","atmosphere":"环境","situation":"矛盾","choicePrompt":"取舍问题","choices":[{"id":"a","label":"行动","reveals":"后果"},{"id":"b","label":"行动","reveals":"后果"}],"evidence":{"time":"时间","title":"得到","detail":"具体因果","polarity":"gain"}},
    {"id":"exchange","time":"时间","place":"地点","title":"标题","atmosphere":"环境","situation":"矛盾","choicePrompt":"取舍问题","choices":[{"id":"a","label":"行动","reveals":"后果"},{"id":"b","label":"行动","reveals":"后果"}],"evidence":{"time":"时间","title":"代价","detail":"具体因果","polarity":"cost"}},
    {"id":"meeting","time":"时间","place":"地点","title":"标题","atmosphere":"环境","situation":"矛盾","choicePrompt":"取舍问题","choices":[{"id":"a","label":"行动","reveals":"后果"},{"id":"b","label":"行动","reveals":"后果"}],"evidence":{"time":"时间","title":"转折","detail":"具体因果","polarity":"turn"}}
  ]
}`;

  try {
    const result = await callModel(prompt, JSON.stringify(payload));
    const world = parseJson(result.text);
    if (!world) throw new Error("invalid model JSON");
    return sendJson(response, 200, {
      world: {
        ...world,
        timeline: payload.timeline,
        mode: payload.mode,
        profile: payload.profile,
        answers: payload.answers,
      },
      responseId: result.responseId,
    });
  } catch (error) {
    console.error(error);
    return sendJson(response, 502, {
      error: "模型暂时没有抵达，交给 Echo 的本地因果引擎继续生成。",
      code: "model_request_failed",
    });
  }
}

async function handleChat(request, response) {
  const payload = await readJson(request);
  const runtimeRequest = sanitizeEchoChatPayload(payload);
  if (!runtimeRequest) {
    return sendJson(response, 400, {
      error: "房间里的信息不完整。",
      code: "invalid_world_context",
    });
  }
  if (!hasModelConfig()) {
    const fallback = repairEchoOutput(
      null,
      runtimeRequest.message,
      runtimeRequest.evidence,
    );
    return sendSse(response, fallback.reply.text, "", {
      runtimeVersion: ECHO_RUNTIME_VERSION,
      mode: "grounded_fallback",
      gate: fallback.gate,
    });
  }

  const instructions = buildEchoInstructions();
  const input = buildEchoInput(runtimeRequest);

  try {
    let result = await callModel(instructions, input);
    let candidate = parseJsonObject(result.text);
    let validated = validateEchoOutput(
      candidate,
      runtimeRequest.evidence,
      runtimeRequest.message,
    );
    let mode = "model";
    if (!validated?.gate.passed) {
      const reasons = validated?.gate.violations || ["invalid_model_output"];
      result = await callModel(
        instructions,
        `${input}

上一版候选：
${JSON.stringify(candidate)}

上一版没有通过门禁：${reasons.join("；")}
只返回修复后的完整 JSON。`,
      );
      candidate = parseJsonObject(result.text);
      validated = validateEchoOutput(
        candidate,
        runtimeRequest.evidence,
        runtimeRequest.message,
      );
      mode = "model_repaired";
    }
    const output = validated?.gate.passed
      ? validated
      : repairEchoOutput(
          validated,
          runtimeRequest.message,
          runtimeRequest.evidence,
        );
    return sendSse(response, output.reply.text, result.responseId, {
      runtimeVersion: ECHO_RUNTIME_VERSION,
      mode: output === validated ? mode : "grounded_fallback",
      gate: output.gate,
    });
  } catch (error) {
    console.error(error);
    const fallback = repairEchoOutput(
      null,
      runtimeRequest.message,
      runtimeRequest.evidence,
    );
    return sendSse(response, fallback.reply.text, "", {
      runtimeVersion: ECHO_RUNTIME_VERSION,
      mode: "grounded_fallback",
      gate: fallback.gate,
    });
  }
}

function sendSse(response, text, responseId, metadata = {}) {
  response.statusCode = 200;
  response.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  response.setHeader("Cache-Control", "no-cache");
  response.write(
    `event: delta\ndata: ${JSON.stringify({ text })}\n\n`,
  );
  response.end(
    `event: completed\ndata: ${JSON.stringify({
      responseId,
      ...metadata,
    })}\n\n`,
  );
}

async function callModel(instructions, input) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 22_000);
  try {
    const upstream = await fetch(process.env.REDNOTE_API_URL, {
      method: "POST",
      headers: {
        "api-key": process.env.REDNOTE_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.REDNOTE_MODEL || "gpt-5.4-pro",
        instructions,
        input,
        reasoning: { effort: "medium", summary: "detailed" },
        text: { verbosity: "medium" },
      }),
      signal: controller.signal,
    });
    const data = await upstream.json();
    if (!upstream.ok) throw new Error(`MaaS request failed: ${upstream.status}`);
    const text = extractText(data);
    if (!text) throw new Error("MaaS returned no text");
    return {
      text,
      responseId: data.id || crypto.randomUUID(),
    };
  } finally {
    clearTimeout(timeout);
  }
}

function hasModelConfig() {
  return Boolean(
    process.env.REDNOTE_API_KEY &&
      process.env.REDNOTE_API_URL &&
      (process.env.REDNOTE_MODEL || "gpt-5.4-pro"),
  );
}

function extractText(data) {
  if (typeof data?.output_text === "string") return data.output_text;
  for (const item of Array.isArray(data?.output) ? data.output : []) {
    for (const part of Array.isArray(item?.content) ? item.content : []) {
      if (typeof part?.text === "string") return part.text;
    }
  }
  return "";
}

function parseJson(text) {
  const cleaned = String(text)
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    try {
      return JSON.parse(cleaned.slice(start, end + 1));
    } catch {
      return null;
    }
  }
}

async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 1_000_000) return null;
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return null;
  }
}

function sendJson(response, statusCode, value) {
  const body = JSON.stringify(value);
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.end(body);
}

function isInsideRoot(filePath) {
  const offset = relative(root, filePath);
  return offset === "" || (!offset.startsWith("..") && !offset.startsWith("/"));
}
