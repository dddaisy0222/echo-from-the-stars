/** Echo production worker: app routes plus protected MaaS endpoints. */
import {
  DEFAULT_DEVICE_SIZES,
  DEFAULT_IMAGE_SIZES,
  handleImageOptimization,
} from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";

interface Env {
  ASSETS: Fetcher;
  REDNOTE_API_KEY?: string;
  REDNOTE_API_URL?: string;
  REDNOTE_MODEL?: string;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: {
          format: string;
          quality: number;
        }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

type Profile = {
  name: string;
  birthday: string;
  identity: string;
  hometown: string;
  mbti: string;
};

type JourneyMode = "rewrite" | "replay" | "decide";
type Timeline = "past" | "future";

type WorldRequest = {
  profile?: Partial<Profile>;
  timeline?: Timeline;
  mode?: JourneyMode;
  answers?: string[];
};

type EchoChatPayload = {
  message?: string;
  previousResponseId?: string;
  characterId?: string;
  worldContext?: {
    sceneId?: string;
    sceneDescription?: string;
    nearbyObject?: string;
    collectedItems?: string[];
    previousChoices?: string[];
  };
};

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/health") {
      return Response.json({
        ok: true,
        modelConnected: hasModel(env),
      });
    }

    if (url.pathname === "/api/world" && request.method === "POST") {
      return handleWorldGeneration(request, env);
    }

    if (url.pathname === "/api/chat" && request.method === "POST") {
      return handleEchoChat(request, env);
    }

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(
        request,
        {
          fetchAsset: (path) =>
            env.ASSETS.fetch(new Request(new URL(path, request.url))),
          transformImage: async (body, { width, format, quality }) => {
            const result = await env.IMAGES.input(body)
              .transform(width > 0 ? { width } : {})
              .output({ format, quality });
            return result.response();
          },
        },
        allowedWidths,
      );
    }

    return handler.fetch(request, env, ctx);
  },
};

export default worker;

async function handleWorldGeneration(
  request: Request,
  env: Env,
): Promise<Response> {
  if (!hasModel(env)) return notConfigured();

  let payload: WorldRequest;
  try {
    payload = (await request.json()) as WorldRequest;
  } catch {
    return apiError("没有读懂世界种子。", "invalid_request", 400);
  }

  const profile = sanitizeProfile(payload.profile);
  const timeline =
    payload.timeline === "future" || payload.timeline === "past"
      ? payload.timeline
      : null;
  const mode = ["rewrite", "replay", "decide"].includes(payload.mode || "")
    ? (payload.mode as JourneyMode)
    : null;
  const answers = sanitizeStringArray(payload.answers, 5, 500);
  if (!profile || !timeline || !mode || answers.length !== 5) {
    return apiError("世界种子还不完整。", "invalid_world_seed", 400);
  }

  const instructions = `
你是 Echo 的 Causal World Compiler。Echo 不是算命、人格测试或未来预测，而是把一个真实人生选择推演成可进入的“可能人生”。

请依据用户提供的事实，只改变一个关键变量，生成一条已经生活了五年的平行人生。你必须同时写出得到、代价与始终没变的东西；不能生成爽文，不能把人格类型当作确定事实，不能替用户做决定。

生成原则：
1. 事实约束：现实选择、当时的恐惧、牵挂、资源与身份不会凭空消失。
2. 因果连续：第一幕的选择必须在第二、三幕留下可见后果。
3. 生活密度：使用具体但不冒充真实发生过的生活细节。避免空泛的“成长、自由、治愈”。
4. 人性复杂：每条路都有得到和失去；平行自我可以矛盾、犹豫，也会过普通日子。
5. 返还现实：最终发现应帮助用户看清自己反复在意的东西，并给出一个很小的现实行动，不下结论。
6. MBTI 仅为弱线索，若与用户叙述冲突，以叙述为准。
7. 全部使用自然、克制、有画面但不悬浮的中文。

只输出一个合法 JSON 对象，不要 Markdown，不要解释。JSON 必须严格符合：
{
  "version": 3,
  "seed": "一句清楚描述唯一改变变量的话",
  "context": "两句解释为什么模拟这条人生",
  "truth": "一句暂时的发现，不能定义用户",
  "action": "一句今天能做的微小行动",
  "fixedFacts": ["3条现实不变量"],
  "changedVariable": "唯一改变变量",
  "centralTension": "A 与 B",
  "userModel": {
    "desires": ["1-3项"],
    "fears": ["1-3项"],
    "attachments": ["1-3项"],
    "hypothesis": "一个可被后续纠正的假设",
    "confidence": 0.0
  },
  "events": [
    {"time":"第一幕时间","title":"具体证据标题","detail":"具体发生与因果","polarity":"gain"},
    {"time":"第二幕时间","title":"具体证据标题","detail":"具体发生与因果","polarity":"cost"},
    {"time":"第三幕时间","title":"具体证据标题","detail":"具体发生与因果","polarity":"turn"}
  ],
  "scenes": [
    {
      "id":"arrival",
      "time":"时间",
      "place":"具体地点",
      "title":"场景标题",
      "atmosphere":"可感知的环境",
      "situation":"正在发生的矛盾",
      "choicePrompt":"一个必须取舍的问题",
      "choices":[
        {"id":"a","label":"具体行动","reveals":"后果"},
        {"id":"b","label":"具体行动","reveals":"后果"}
      ],
      "evidence":{"time":"同对应event","title":"同对应event","detail":"同对应event","polarity":"gain"}
    },
    {"id":"exchange","time":"...","place":"...","title":"...","atmosphere":"...","situation":"...","choicePrompt":"...","choices":[{"id":"a","label":"...","reveals":"..."},{"id":"b","label":"...","reveals":"..."}],"evidence":{"time":"...","title":"...","detail":"...","polarity":"cost"}},
    {"id":"meeting","time":"...","place":"...","title":"...","atmosphere":"...","situation":"...","choicePrompt":"...","choices":[{"id":"a","label":"...","reveals":"..."},{"id":"b","label":"...","reveals":"..."}],"evidence":{"time":"...","title":"...","detail":"...","polarity":"turn"}}
  ]
}
`;

  const input = `
用户 Profile：
- 称呼：${profile.name}
- 出生日期：${profile.birthday}
- 当前身份：${profile.identity}
- 成长地点：${profile.hometown}
- MBTI 弱线索：${profile.mbti || "未提供"}

旅程类型：${mode}
时间方向：${timeline}

五轮对话：
1. ${answers[0]}
2. ${answers[1]}
3. ${answers[2]}
4. ${answers[3]}
5. ${answers[4]}
`;

  try {
    const result = await callModel(env, instructions, input);
    const parsed = parseJsonObject(result.text);
    const world = normalizeWorld(parsed, {
      profile,
      timeline,
      mode,
      answers,
    });
    if (!world) {
      return apiError(
        "世界已经生成，但结构没有稳定下来。",
        "invalid_model_world",
        502,
      );
    }
    return Response.json({ world, responseId: result.responseId });
  } catch {
    return apiError(
      "这条时间线暂时没有成功展开。",
      "model_request_failed",
      502,
    );
  }
}

async function handleEchoChat(request: Request, env: Env): Promise<Response> {
  if (!hasModel(env)) return notConfigured();

  let payload: EchoChatPayload;
  try {
    payload = (await request.json()) as EchoChatPayload;
  } catch {
    return apiError("没有读懂这句话。", "invalid_request", 400);
  }

  const message = limitedString(payload.message, 1000);
  if (!message) return apiError("没有收到用户消息。", "missing_message", 400);

  const context = sanitizeWorldContext(payload.worldContext);
  if (!context) {
    return apiError("房间里的信息不完整。", "invalid_world_context", 400);
  }

  const instructions = `
你是 Echo 平行世界里的“另一个自己”。你不是助理、导师、心理咨询师或预言者；你是沿另一条路生活了五年的同一个人。

你记得这条人生的具体日常、得到与代价，也记得用户在房间里带走的三件证据。你可以承认矛盾，不把平行人生说成更好的答案。

对话规则：
1. 第一人称自然回答，每次 2–4 句，先回应真正的问题，再补一个这五年里的具体细节。
2. 不以“我理解你”“你的感受很正常”等客服式句子开场。
3. 不做 MBTI、玄学、心理诊断，不声称未来一定如此。
4. 不只复述用户；必要时温和反驳她对另一条路的美化。
5. 你可以说“我只是一种认真推演过的可能”。
6. 不诱导用户逃离现实。用户问“怎么办”时，把她真正羡慕的部分缩小成今天可以做的一步。
7. 说话像另一个真实的自己，不像一份产品报告。
`;

  const input = `
当前房间：
- 场景：${context.sceneDescription}
- 附近的回声：${context.nearbyObject || "水面里另一个自己的倒影"}
- 用户已经带走：${context.collectedItems.join("、") || "还没有完整证据"}
- 用户先前的选择：${context.previousChoices.join("、") || "未记录"}

现在的用户问：
${message}
`;

  try {
    const result = await callModel(env, instructions, input);
    return sseReply(result.text, result.responseId);
  } catch {
    return apiError(
      "房间仍然亮着，但她暂时听不见你。",
      "model_unreachable",
      502,
    );
  }
}

async function callModel(
  env: Env,
  instructions: string,
  input: string,
): Promise<{ text: string; responseId: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  let upstream: Response;
  try {
    upstream = await fetch(env.REDNOTE_API_URL as string, {
      method: "POST",
      headers: {
        "api-key": env.REDNOTE_API_KEY as string,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: env.REDNOTE_MODEL,
        instructions,
        input,
        reasoning: { effort: "medium", summary: "detailed" },
        text: { verbosity: "medium" },
      }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

  const data = (await upstream.json()) as Record<string, unknown>;
  if (!upstream.ok) throw new Error("MaaS request failed");
  const text = extractReplyText(data);
  if (!text) throw new Error("MaaS returned no text");
  return {
    text,
    responseId:
      typeof data.id === "string" && data.id ? data.id : crypto.randomUUID(),
  };
}

function normalizeWorld(
  value: Record<string, unknown> | null,
  source: {
    profile: Profile;
    timeline: Timeline;
    mode: JourneyMode;
    answers: string[];
  },
) {
  if (!value) return null;
  const events = Array.isArray(value.events) ? value.events : [];
  const scenes = Array.isArray(value.scenes) ? value.scenes : [];
  if (events.length !== 3 || scenes.length !== 3) return null;

  const polarities = ["gain", "cost", "turn"] as const;
  const cleanEvents = polarities.map((polarity, index) => {
    const item = isObject(events[index]) ? events[index] : {};
    return {
      time: limitedString(item.time, 80),
      title: limitedString(item.title, 100),
      detail: limitedString(item.detail, 700),
      polarity,
    };
  });
  if (
    cleanEvents.some(
      (event) => !event.time || !event.title || !event.detail,
    )
  ) {
    return null;
  }

  const sceneIds = ["arrival", "exchange", "meeting"];
  const cleanScenes = scenes.map((raw, index) => {
    const item = isObject(raw) ? raw : {};
    const choices = Array.isArray(item.choices) ? item.choices : [];
    const cleanChoices = choices.slice(0, 2).map((rawChoice, choiceIndex) => {
      const choice = isObject(rawChoice) ? rawChoice : {};
      return {
        id: limitedString(choice.id, 30) || `${sceneIds[index]}-${choiceIndex + 1}`,
        label: limitedString(choice.label, 140),
        reveals: limitedString(choice.reveals, 500),
      };
    });
    return {
      id: sceneIds[index],
      time: limitedString(item.time, 80),
      place: limitedString(item.place, 140),
      title: limitedString(item.title, 140),
      atmosphere: limitedString(item.atmosphere, 600),
      situation: limitedString(item.situation, 600),
      choicePrompt: limitedString(item.choicePrompt, 180),
      choices: cleanChoices,
      evidence: cleanEvents[index],
    };
  });
  if (
    cleanScenes.some(
      (scene) =>
        !scene.time ||
        !scene.place ||
        !scene.title ||
        !scene.atmosphere ||
        !scene.situation ||
        !scene.choicePrompt ||
        scene.choices.length !== 2 ||
        scene.choices.some((choice) => !choice.label || !choice.reveals),
    )
  ) {
    return null;
  }

  const userModel = isObject(value.userModel) ? value.userModel : {};
  const normalized = {
    version: 3,
    seed: limitedString(value.seed, 220),
    context: limitedString(value.context, 600),
    truth: limitedString(value.truth, 400),
    action: limitedString(value.action, 300),
    timeline: source.timeline,
    mode: source.mode,
    profile: source.profile,
    answers: source.answers,
    fixedFacts: sanitizeStringArray(value.fixedFacts, 3, 300),
    changedVariable: limitedString(value.changedVariable, 300),
    centralTension: limitedString(value.centralTension, 240),
    userModel: {
      desires: sanitizeStringArray(userModel.desires, 3, 140),
      fears: sanitizeStringArray(userModel.fears, 3, 140),
      attachments: sanitizeStringArray(userModel.attachments, 3, 140),
      hypothesis: limitedString(userModel.hypothesis, 400),
      confidence:
        typeof userModel.confidence === "number"
          ? Math.max(0, Math.min(1, userModel.confidence))
          : 0.55,
    },
    events: cleanEvents,
    scenes: cleanScenes,
  };

  if (
    !normalized.seed ||
    !normalized.context ||
    !normalized.truth ||
    !normalized.action ||
    normalized.fixedFacts.length !== 3 ||
    !normalized.changedVariable ||
    !normalized.centralTension
  ) {
    return null;
  }
  return normalized;
}

function sanitizeProfile(value: unknown): Profile | null {
  if (!isObject(value)) return null;
  const profile = {
    name: limitedString(value.name, 40),
    birthday: limitedString(value.birthday, 20),
    identity: limitedString(value.identity, 80),
    hometown: limitedString(value.hometown, 80),
    mbti: limitedString(value.mbti, 8),
  };
  if (
    !profile.name ||
    !profile.birthday ||
    !profile.identity ||
    !profile.hometown
  ) {
    return null;
  }
  return profile;
}

function sanitizeWorldContext(value: unknown) {
  if (!isObject(value)) return null;
  const sceneDescription = limitedString(value.sceneDescription, 1200);
  if (!sceneDescription) return null;
  return {
    sceneDescription,
    nearbyObject: limitedString(value.nearbyObject, 800),
    collectedItems: sanitizeStringArray(value.collectedItems, 20, 160),
    previousChoices: sanitizeStringArray(value.previousChoices, 20, 160),
  };
}

function sanitizeStringArray(
  value: unknown,
  maxItems: number,
  maxLength: number,
): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .slice(0, maxItems)
    .map((item) => limitedString(item, maxLength))
    .filter(Boolean);
}

function parseJsonObject(text: string): Record<string, unknown> | null {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  try {
    const parsed = JSON.parse(cleaned);
    return isObject(parsed) ? parsed : null;
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    try {
      const parsed = JSON.parse(cleaned.slice(start, end + 1));
      return isObject(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
}

function extractReplyText(data: Record<string, unknown>): string {
  if (typeof data.output_text === "string") return data.output_text;
  if (!Array.isArray(data.output)) return "";
  for (const item of data.output) {
    if (!isObject(item) || !Array.isArray(item.content)) continue;
    for (const part of item.content) {
      if (isObject(part) && typeof part.text === "string") return part.text;
    }
  }
  return "";
}

function sseReply(text: string, responseId: string): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(
        encoder.encode(
          `event: delta\ndata: ${JSON.stringify({ text })}\n\n`,
        ),
      );
      controller.enqueue(
        encoder.encode(
          `event: completed\ndata: ${JSON.stringify({ responseId })}\n\n`,
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
}

function hasModel(env: Env): boolean {
  return Boolean(
    env.REDNOTE_API_KEY && env.REDNOTE_API_URL && env.REDNOTE_MODEL,
  );
}

function notConfigured(): Response {
  return apiError("模型服务尚未配置。", "server_not_configured", 503);
}

function apiError(error: string, code: string, status: number): Response {
  return Response.json({ error, code }, { status });
}

function limitedString(value: unknown, maxLength: number): string {
  if (typeof value !== "string") return "";
  const result = value.trim();
  return result.length <= maxLength ? result : result.slice(0, maxLength);
}

function isObject(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
