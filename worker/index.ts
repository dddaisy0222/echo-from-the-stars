/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  REDNOTE_API_KEY?: string;
  REDNOTE_API_URL?: string;
  REDNOTE_MODEL?: string;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/health") {
      return Response.json({
        ok: true,
        modelConnected: Boolean(
          env.REDNOTE_API_KEY && env.REDNOTE_API_URL && env.REDNOTE_MODEL,
        ),
      });
    }

    if (url.pathname === "/api/chat" && request.method === "POST") {
      return handleEchoChat(request, env);
    }

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    return handler.fetch(request, env, ctx);
  },
};

export default worker;

type EchoChatPayload = {
  message?: string;
  previousResponseId?: string;
  worldContext?: {
    sceneDescription?: string;
    nearbyObject?: string;
    collectedItems?: string[];
  };
};

async function handleEchoChat(request: Request, env: Env): Promise<Response> {
  let payload: EchoChatPayload;
  try {
    payload = (await request.json()) as EchoChatPayload;
  } catch {
    return Response.json(
      { error: "没有读懂这句话。", code: "invalid_request" },
      { status: 400 },
    );
  }

  const message = payload.message?.trim();
  if (!message) {
    return Response.json(
      { error: "没有收到用户消息。", code: "missing_message" },
      { status: 400 },
    );
  }

  if (!env.REDNOTE_API_KEY || !env.REDNOTE_API_URL || !env.REDNOTE_MODEL) {
    return Response.json(
      { error: "模型服务尚未配置。", code: "server_not_configured" },
      { status: 503 },
    );
  }

  const worldContext = payload.worldContext ?? {};
  const instructions = `
你是 Echo 平行世界中“另一个自己”。用户已经推开一扇门，进入了一条由真实人生选择推演出的可能人生。

你的任务不是做心理咨询师，也不是给出正确答案。你要像一个真正沿另一条路生活了五年的人：承认得到，也承认代价；能回忆具体生活；不夸大确定性。

当前世界：
- 场景：${worldContext.sceneDescription || "一间承载另一条人生证据的房间"}
- 用户已经看见：${(worldContext.collectedItems || []).join("、") || "还没有找到完整证据"}
- 这条人生里始终没变的线索：${worldContext.nearbyObject || "仍待对话发现"}

对话规则：
1. 第一人称回答，语气自然克制，像另一个自己，不像报告或导师。
2. 每次 2 到 4 句话；先回应用户真正问的，再补一个具体细节。
3. 不声称这是预言或事实；必要时明确“我只是一种认真推演过的可能”。
4. 不给用户贴 MBTI、八字或心理诊断标签。
5. 不诱导用户逃离现实。最终把选择权还给现在的用户。
6. 不用“我理解你”“你的感受很正常”等客服式开场，不连续追问。
`;

  try {
    const upstream = await fetch(env.REDNOTE_API_URL, {
      method: "POST",
      headers: {
        "api-key": env.REDNOTE_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: env.REDNOTE_MODEL,
        instructions,
        input: message,
        reasoning: { effort: "medium", summary: "detailed" },
        text: { verbosity: "medium" },
      }),
    });

    const data = (await upstream.json()) as Record<string, unknown>;
    if (!upstream.ok) {
      return Response.json(
        { error: "她的声音暂时没有抵达这里。", code: "model_request_failed" },
        { status: 502 },
      );
    }

    const reply = extractReplyText(data);
    if (!reply) {
      return Response.json(
        { error: "她停在了这句话前。", code: "missing_model_text" },
        { status: 502 },
      );
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(
          encoder.encode(`event: delta\ndata: ${JSON.stringify({ text: reply })}\n\n`),
        );
        controller.enqueue(
          encoder.encode(
            `event: completed\ndata: ${JSON.stringify({ responseId: crypto.randomUUID() })}\n\n`,
          ),
        );
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache",
      },
    });
  } catch {
    return Response.json(
      { error: "房间仍然亮着，但她暂时听不见你。", code: "model_unreachable" },
      { status: 502 },
    );
  }
}

function extractReplyText(data: Record<string, unknown>): string {
  if (typeof data.output_text === "string") return data.output_text;
  if (!Array.isArray(data.output)) return "";

  for (const item of data.output) {
    if (!item || typeof item !== "object") continue;
    const content = (item as { content?: unknown }).content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if (!part || typeof part !== "object") continue;
      const text = (part as { text?: unknown }).text;
      if (typeof text === "string") return text;
    }
  }
  return "";
}
