import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const port = Number(process.env.PORT || 4179);
const upstreamOrigin = process.env.ECHO_UPSTREAM_ORIGIN;
const upstreamToken = process.env.ECHO_SITES_TOKEN;
const root = join(process.cwd(), "dist-github");
const allowedActions = new Set([
  "general",
  "calibrate",
  "oracle_initialize",
  "oracle_advance",
  "render_consequence",
  "echo",
]);
const usage = new Map();

if (!upstreamOrigin || !upstreamToken) {
  console.error("ECHO_UPSTREAM_ORIGIN and ECHO_SITES_TOKEN are required");
  process.exit(1);
}

createServer(async (request, response) => {
  if (request.url === "/api/health") {
    return proxy(request, response, "/api/health");
  }

  if (request.url === "/api/flow" && request.method === "POST") {
    const ip = String(request.headers["cf-connecting-ip"] || request.socket.remoteAddress);
    const count = (usage.get(ip) || 0) + 1;
    usage.set(ip, count);
    if (count > 120) return json(response, 429, { error: "本次试玩调用次数已达上限。" });

    try {
      const raw = await readBody(request);
      const payload = JSON.parse(raw);
      if (!allowedActions.has(payload.action)) {
        return json(response, 400, { error: "未知 Agent action。" });
      }
      return proxy(request, response, "/api/flow", raw);
    } catch {
      return json(response, 400, { error: "请求格式无效。" });
    }
  }

  return serveStatic(request, response);
}).listen(port, "127.0.0.1", () => {
  console.log(`Echo live proxy listening on http://127.0.0.1:${port}/agent-lab/`);
});

async function proxy(request, response, pathname, body) {
  const upstream = await fetch(new URL(pathname, upstreamOrigin), {
    method: request.method,
    headers: {
      "Content-Type": "application/json",
      "OAI-Sites-Authorization": `Bearer ${upstreamToken}`,
    },
    body,
  });
  response.writeHead(upstream.status, {
    "Content-Type": upstream.headers.get("content-type") || "application/json",
    "Cache-Control": "no-store",
  });
  response.end(Buffer.from(await upstream.arrayBuffer()));
}

async function serveStatic(request, response) {
  const url = new URL(request.url, "http://localhost");
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === "/") {
    response.writeHead(302, { Location: "/agent-lab/" });
    return response.end();
  }
  const safe = normalize(pathname).replace(/^(\.\.[/\\])+/, "");
  let file = join(root, safe);
  try {
    const info = await stat(file);
    if (info.isDirectory()) file = join(file, "index.html");
    const body = await readFile(file);
    response.writeHead(200, {
      "Content-Type": mime(file),
      "Cache-Control": "no-store",
    });
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
  }[extname(file)] || "application/octet-stream";
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
      if (body.length > 1_000_000) reject(new Error("too large"));
    });
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}
