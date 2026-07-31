import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const port = Number(process.env.PORT || 4179);
const apiKey = process.env.REDNOTE_API_KEY;
const apiUrl =
  process.env.REDNOTE_API_URL ||
  "https://maas.devops.rednote.life/openai/openai/v1/responses?api-version=preview";
const model = process.env.REDNOTE_MODEL || "gpt-5.4-pro";
const root = join(process.cwd(), "dist-github");

if (!apiKey) {
  console.error("REDNOTE_API_KEY is required");
  process.exit(1);
}

const policies = {
  general: await readFile("agent-system/prompts/general-agent.v2.system.md", "utf8"),
  oracle: await readFile("agent-system/prompts/oracle-agent.v1.system.md", "utf8"),
  echo: await readFile("agent-system/prompts/echo-agent.v1.system.md", "utf8"),
};

createServer(async (request, response) => {
  setCors(response);
  if (request.method === "OPTIONS") return response.end();
  if (request.url === "/api/health") {
    return json(response, 200, { ok: true, model, live: true });
  }
  if (request.url === "/api/flow" && request.method === "POST") {
    try {
      const payload = JSON.parse(await readBody(request));
      const result = await runAction(payload);
      return json(response, 200, result);
    } catch (error) {
      console.error("[agent-flow]", error instanceof Error ? error.message : error);
      return json(response, 500, {
        error: error instanceof Error ? error.message : "Agent 调用失败",
      });
    }
  }
  return serveStatic(request, response);
}).listen(port, "127.0.0.1", () => {
  console.log(`Echo Agent API listening on http://127.0.0.1:${port}/agent-lab/`);
});

async function runAction(payload) {
  switch (payload.action) {
    case "general":
      return {
        seed: await generateJson(
          policies.general,
          `你正在为产品原型生成面向用户展示的 World Seed Card。遵守 General Agent 的事实边界，但本原型只要求输出以下 JSON：
{"title":"一句标题","fields":[{"label":"字段名","value":"严格来自用户输入的值"}],"boundary":"一句说明哪些结论尚未生成"}
不要追问，不添加输入中不存在的事实。字段必须覆盖共同起点、现实路径、平行路径、当时选择机制、目标问题与未知边界。

CASE_CONTEXT:
${JSON.stringify(payload.caseContext)}`,
        ),
      };
    case "calibrate":
      return {
        question: await generateJson(
          policies.oracle,
          `你正处于 Oracle calibrate 模式。为可点击原型生成一个校准问题，不生成世界节点。
本轮 step=${payload.step}。step 0 只校准工作落点/组织安排；step 1 只校准住房/家庭距离；step 2 只校准观察时间节点。
输出严格 JSON：
{"topic":"稳定英文topic","eyebrow":"CALIBRATION 0N / 中文主题","question":"一个问题","note":"说明这是现实事实、反事实前提或可保持未知","options":[{"label":"短标签","value":"明确设定值","description":"设定会改变什么"},{"label":"短标签","value":"明确设定值","description":"设定会改变什么"},{"label":"保持未知","value":"unknown","description":"不让模型补写该变量"}]}
禁止询问幸福、后悔或人格。候选是模型假设，不冒充事实。

CASE_CONTEXT=${JSON.stringify(payload.caseContext)}
SEED=${JSON.stringify(payload.seed)}
ALREADY_CALIBRATED=${JSON.stringify(payload.answers)}`,
        ),
      };
    case "oracle_initialize":
      return {
        node: await oracleNode(payload, true),
      };
    case "oracle_advance":
      return {
        node: await oracleNode(payload, false),
      };
    case "render_consequence":
      return await generateJson(
        policies.oracle,
        `用户刚提交了一个微观选择。只渲染选择后的即时、有限反馈，不生成下一节点，不保证外部结果。
输出 JSON：{"consequence":"2-3句具体而克制的后果；说明状态发生了什么变化，并保留未解决问题"}
CASE=${JSON.stringify(payload.caseContext)}
CALIBRATION=${JSON.stringify(payload.calibration)}
CURRENT_NODE=${JSON.stringify(payload.node)}
COMMITTED_CHOICE=${JSON.stringify(payload.choice)}
LIVED_NODES=${JSON.stringify(payload.nodes)}`,
      );
    case "echo": {
      const result = await generateJson(
        policies.echo,
        `你现在为可点击原型生成 Echo 的唯一展示文本。必须遵守平行自我的证据与双向盲区。
输出严格 JSON：{"reply":"自然口语，1-4句，不使用 Markdown"}
只把 LIVED_MEMORIES 当作你确实经历过的事。CASE_CONTEXT 中 realPath 只说明岔路选择，不代表你知道用户后来在现实路径的具体经历。用户问未来时明确尚未活到；用户问幸福时不排名；可以不同意。

CASE_CONTEXT=${JSON.stringify(payload.caseContext)}
CALIBRATION=${JSON.stringify(payload.calibration)}
LIVED_MEMORIES=${JSON.stringify(payload.memories)}
CONVERSATION=${JSON.stringify(payload.conversation)}
OPENING=${Boolean(payload.opening)}
USER_MESSAGE=${JSON.stringify(payload.message)}`,
      );
      return { reply: result.reply };
    }
    default:
      throw new Error("未知 Agent action");
  }
}

async function oracleNode(payload, initialize) {
  const index = initialize ? 0 : payload.nodes.length;
  const horizonGuide = [
    "从共同 Offer 岔路开始，宏观选择已经固定为宁波移动，不再让用户重选公司",
    "推进到入职后第一个由校准前提支持的结构节点",
    "推进到工作之外的日常结构或家庭/独居边界",
    "推进到收入、能力使用、反馈周期或发展路径第一次成为具体摩擦",
  ][Math.min(index, 3)];
  return generateJson(
    policies.oracle,
    `你处于 Oracle ${initialize ? "initialize" : "advance"} 模式。本原型使用简化状态合同，但仍遵守一次只推进一个节点、因果连续、不得复制 few-shot 表面剧情。
本节点目标：${horizonGuide}。
输出严格 JSON：
{
 "id":"node-${index + 1}-稳定短名",
 "time":"相对时间，不使用伪精确日期",
 "place":"有输入依据的地点；未知则诚实写泛化地点",
 "title":"不超过40字",
 "paragraphs":["2-3段具体、克制、有生活感的场景；不写用户尚未选择后的结果"],
 "question":"一个微观取舍问题",
 "choices":[
  {"id":"a","label":"短标签","action":"用户自己的具体行动","doesNotGuarantee":"这个行动不能保证的外部结果"},
  {"id":"b","label":"短标签","action":"不同策略的具体行动","doesNotGuarantee":"不能保证的外部结果"}
 ],
 "unresolved":"本节点后仍未解决的一项张力或未知"
}
Choice 只能控制用户自己的行动、边界、注意力或资源分配。不能选择组织安排、他人反应或必然成功。

CASE_CONTEXT=${JSON.stringify(payload.caseContext)}
CONFIRMED_SEED=${JSON.stringify(payload.seed)}
CALIBRATION=${JSON.stringify(payload.calibration)}
EXISTING_NODES=${JSON.stringify(payload.nodes || [])}
LIVED_MEMORIES=${JSON.stringify(payload.memories || [])}
SIGNED_TRIGGER=${JSON.stringify(payload.trigger || null)}`,
  );
}

async function generateJson(instructions, input) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45_000);
  try {
    const upstream = await fetch(apiUrl, {
      method: "POST",
      headers: { "api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        instructions,
        input,
        reasoning: { effort: "medium" },
        text: { verbosity: "medium" },
      }),
      signal: controller.signal,
    });
    const data = await upstream.json();
    if (!upstream.ok) {
      const detail =
        data?.error?.message ||
        data?.message ||
        data?.error_description ||
        data?.error ||
        "请求被拒绝";
      throw new Error(`MaaS ${upstream.status}: ${String(detail).slice(0, 300)}`);
    }
    const text = extractText(data);
    if (!text) throw new Error("MaaS 没有返回文本");
    return parseJson(text);
  } finally {
    clearTimeout(timer);
  }
}

function extractText(data) {
  if (typeof data.output_text === "string") return data.output_text;
  for (const item of data.output || []) {
    for (const part of item.content || []) {
      if (typeof part.text === "string") return part.text;
    }
  }
  return "";
}

function parseJson(text) {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start < 0 || end <= start) throw new Error("Agent 返回的 JSON 无法解析");
    return JSON.parse(cleaned.slice(start, end + 1));
  }
}

async function serveStatic(request, response) {
  const url = new URL(request.url, "http://localhost");
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === "/") pathname = "/agent-lab/";
  const safe = normalize(pathname).replace(/^(\.\.[/\\])+/, "");
  let file = join(root, safe);
  try {
    const info = await stat(file);
    if (info.isDirectory()) file = join(file, "index.html");
    const body = await readFile(file);
    response.writeHead(200, { "Content-Type": mime(file), "Cache-Control": "no-store" });
    response.end(body);
  } catch {
    json(response, 404, { error: "Not found" });
  }
}

function mime(file) {
  return {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".png": "image/png",
    ".glb": "model/gltf-binary",
    ".spz": "application/octet-stream",
  }[extname(file)] || "application/octet-stream";
}

function setCors(response) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function json(response, status, value) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(value));
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) reject(new Error("请求过大"));
    });
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}
