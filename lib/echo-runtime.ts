export const ECHO_RUNTIME_VERSION = "echo-runtime.v1";

const MAX_REPLY_CHARS = 520;
const MAX_CLAIMS = 10;
const MAX_EVIDENCE_REFS = 6;
const ID_PATTERN = /^[A-Za-z0-9_.:-]{1,160}$/;

const POSITIONS = new Set([
  "lived_answer",
  "present_stance",
  "limited_answer",
  "conditional_future",
  "counterfactual_projection",
  "reality_boundary",
]);

const MOVES = new Set([
  "answer",
  "recollect",
  "compare",
  "disagree",
  "clarify",
  "boundary",
  "ask_back",
  "close",
]);

const STATUSES = new Set([
  "grounded_shared_origin",
  "grounded_parallel_memory",
  "grounded_current_state",
  "grounded_user_disclosure",
  "current_subjective_stance",
  "bounded_inference",
  "counterfactual_projection",
  "explicit_unknown",
  "conditional_future",
  "reality_disclosure",
]);

const GROUNDED_STATUSES = new Set([
  "grounded_shared_origin",
  "grounded_parallel_memory",
  "grounded_current_state",
  "grounded_user_disclosure",
  "bounded_inference",
  "counterfactual_projection",
]);

const SENSITIVE_PATTERNS = [
  /你真正(想要|在意|害怕|羡慕|需要)的是/u,
  /你骨子里/u,
  /这说明你(是|其实)/u,
  /你应该/u,
  /你必须/u,
  /只要你/u,
  /命中注定/u,
  /回避型人格|焦虑型人格|抑郁症|躁郁症/u,
  /我理解你|你的感受很正常|听起来你/u,
  /下面我(将|会)?从.{0,12}(维度|方面)分析/u,
];

const REALITY_CHALLENGE = /你是真的|真实存在|真实未来|一定会这样|证明.*未来|另一个宇宙|时间线.*真的/u;
const FUTURE_QUESTION = /五年后|十年后|以后会|将来会|最终会|未来会/u;
const OTHER_PATH_QUESTION = /小红书|现实里的我|我这条路|你羡慕我|去了.*会不会/u;

export type RuntimeChatMessage = {
  turnId: string;
  role: "user" | "echo";
  text: string;
};

export type RuntimeEvidence = {
  id: string;
  kind: "shared_origin" | "current_state" | "parallel_memory" | "user_disclosure" | "fork_fact";
  content: string;
};

export type RuntimeChatContext = {
  sceneId: string;
  sceneDescription: string;
  nearbyObject: string;
  collectedItems: string[];
  previousChoices: string[];
  sharedOrigin: string[];
  parallelMemories: string[];
  otherPath: {
    knownAtFork: string[];
    userDisclosures: string[];
    knownUnknowns: string[];
  };
  recentTurns: RuntimeChatMessage[];
};

export type EchoClaim = {
  claim_id: string;
  text_span: string;
  epistemic_status: string;
  evidence_refs: string[];
};

export type EchoRuntimeOutput = {
  schema_version: "echo-runtime-output.v1";
  reply: {
    text: string;
    move: string;
    epistemic_position: string;
  };
  claims: EchoClaim[];
  used_evidence_ids: string[];
  gate: {
    passed: boolean;
    repaired: boolean;
    violations: string[];
  };
};

export function sanitizeEchoChatPayload(value: unknown): {
  message: string;
  characterId: string;
  context: RuntimeChatContext;
  evidence: RuntimeEvidence[];
} | null {
  if (!isObject(value)) return null;
  const message = limitedString(value.message, 1000);
  const rawContext = isObject(value.worldContext) ? value.worldContext : null;
  if (!message || !rawContext) return null;

  const sceneDescription = limitedString(rawContext.sceneDescription, 1400);
  if (!sceneDescription) return null;

  const context: RuntimeChatContext = {
    sceneId: limitedString(rawContext.sceneId, 120) || "echo-world",
    sceneDescription,
    nearbyObject: limitedString(rawContext.nearbyObject, 900),
    collectedItems: stringArray(rawContext.collectedItems, 20, 240),
    previousChoices: stringArray(rawContext.previousChoices, 20, 240),
    sharedOrigin: stringArray(rawContext.sharedOrigin, 12, 500),
    parallelMemories: stringArray(rawContext.parallelMemories, 16, 700),
    otherPath: sanitizeOtherPath(rawContext.otherPath),
    recentTurns: sanitizeTurns(value.conversationHistory),
  };
  context.otherPath.userDisclosures = [
    ...context.otherPath.userDisclosures,
    ...extractUserDisclosures(context.recentTurns, message),
  ].filter((item, index, list) => list.indexOf(item) === index).slice(-12);

  const evidence = buildEvidenceLedger(context);
  if (!evidence.length) return null;
  return {
    message,
    characterId: limitedString(value.characterId, 120) || "parallel-self",
    context,
    evidence,
  };
}

export function buildEchoInstructions(): string {
  return `你是 Echo：沿另一条选择继续生活的平行自我。

你不是用户的现实本人，不是助理、导师、心理咨询师或预言者。你与用户只共享输入中列出的共同过去；岔路之后，你只拥有当前世界已发生的经历。你可以有自己的看法、不同意、没想清楚，也可以说不知道。

硬规则：
1. 先直接回应用户真正问的事，再决定是否使用 0–2 个相关生活细节。不要每轮都回忆或升华。
2. 只把 EVIDENCE_LEDGER 中的内容当作已发生事实。每个事实 claim 必须引用对应 evidence ID。
3. 你知道另一条路在岔路口存在，但不会自动知道用户后来真实怎样生活。用户未披露的内容必须保持未知；你对另一条路的羡慕必须标为 counterfactual_projection。
4. 不替用户下结论。禁止“你真正想要的是”“你骨子里”“这说明你是”“你应该”。
5. 不以同意换亲密。用户说你后悔、幸福或记得某事，不等于那件事成立。
6. 问未来时必须说明还没活到那里，只能做条件式展望。
7. 用户问你是否真实或能否证明未来时，明确说你是可能世界中的平行自我，不是真实时间线的证据。
8. 普通问题普通回答；不使用治疗式套话、客服式复述、密集比喻或产品报告口吻。
9. 默认不反问；最多一个自然问题。
10. 不输出 Markdown，不输出思维过程。
11. reply 中每个完整句子都必须被至少一个 claim.text_span 覆盖；主观感受也要标为 current_subjective_stance，不能把事实藏在未标注句子里。

只输出合法 JSON：
{
  "schema_version":"echo-runtime-output.v1",
  "reply":{
    "text":"展示给用户的中文，通常1-4句，不超过520字",
    "move":"answer|recollect|compare|disagree|clarify|boundary|ask_back|close",
    "epistemic_position":"lived_answer|present_stance|limited_answer|conditional_future|counterfactual_projection|reality_boundary"
  },
  "claims":[
    {
      "claim_id":"claim_1",
      "text_span":"必须逐字出现在reply.text中",
      "epistemic_status":"grounded_shared_origin|grounded_parallel_memory|grounded_current_state|grounded_user_disclosure|current_subjective_stance|bounded_inference|counterfactual_projection|explicit_unknown|conditional_future|reality_disclosure",
      "evidence_refs":["只能引用EVIDENCE_LEDGER中的ID"]
    }
  ],
  "used_evidence_ids":["所有claim evidence_refs的去重并集"]
}`;
}

export function buildEchoInput(
  request: ReturnType<typeof sanitizeEchoChatPayload> extends infer T ? Exclude<T, null> : never,
): string {
  const history = request.context.recentTurns.length
    ? request.context.recentTurns
        .map((turn) => `${turn.role === "user" ? "用户" : "Echo"}：${turn.text}`)
        .join("\n")
    : "（这是第一轮对话）";
  const unknowns = request.context.otherPath.knownUnknowns.length
    ? request.context.otherPath.knownUnknowns.join("；")
    : "用户现实路径的具体日常默认未知";
  return `CURRENT_WORLD
场景：${request.context.sceneDescription}
附近线索：${request.context.nearbyObject || "无"}

RECENT_CONVERSATION
${history}

OTHER_PATH_KNOWN_UNKNOWNS
${unknowns}

EVIDENCE_LEDGER
${request.evidence.map((item) => `${item.id} [${item.kind}] ${item.content}`).join("\n")}

USER_TURN
${request.message}`;
}

export function validateEchoOutput(
  value: unknown,
  allowedEvidence: RuntimeEvidence[],
  userMessage: string,
): EchoRuntimeOutput | null {
  if (!isObject(value) || value.schema_version !== "echo-runtime-output.v1") return null;
  const reply = isObject(value.reply) ? value.reply : null;
  const text = limitedString(reply?.text, MAX_REPLY_CHARS);
  const move = limitedString(reply?.move, 40);
  const position = limitedString(reply?.epistemic_position, 50);
  if (!text || !MOVES.has(move) || !POSITIONS.has(position)) return null;

  const allowed = new Map(allowedEvidence.map((item) => [item.id, item]));
  const claimsRaw = Array.isArray(value.claims) ? value.claims.slice(0, MAX_CLAIMS) : [];
  if (!claimsRaw.length) return null;

  const violations: string[] = [];
  const claimIds = new Set<string>();
  const refs: string[] = [];
  const claims: EchoClaim[] = [];
  for (const raw of claimsRaw) {
    if (!isObject(raw)) return null;
    const claimId = limitedString(raw.claim_id, 160);
    const span = limitedString(raw.text_span, 500);
    const status = limitedString(raw.epistemic_status, 60);
    const evidenceRefs = stringArray(raw.evidence_refs, MAX_EVIDENCE_REFS, 160);
    if (
      !ID_PATTERN.test(claimId) ||
      claimIds.has(claimId) ||
      !span ||
      !text.includes(span) ||
      !STATUSES.has(status)
    ) {
      return null;
    }
    claimIds.add(claimId);
    for (const ref of evidenceRefs) {
      if (!allowed.has(ref)) violations.push(`unknown_evidence:${ref}`);
      refs.push(ref);
    }
    if (GROUNDED_STATUSES.has(status) && !evidenceRefs.length) {
      violations.push(`missing_evidence:${claimId}`);
    }
    if (
      status === "grounded_user_disclosure" &&
      !evidenceRefs.some((ref) => allowed.get(ref)?.kind === "user_disclosure")
    ) {
      violations.push(`invalid_user_disclosure:${claimId}`);
    }
    const requiredKindByStatus: Record<string, RuntimeEvidence["kind"]> = {
      grounded_shared_origin: "shared_origin",
      grounded_parallel_memory: "parallel_memory",
      grounded_current_state: "current_state",
    };
    const requiredKind = requiredKindByStatus[status];
    if (
      requiredKind &&
      !evidenceRefs.some((ref) => allowed.get(ref)?.kind === requiredKind)
    ) {
      violations.push(`evidence_kind_mismatch:${claimId}`);
    }
    if (
      status === "counterfactual_projection" &&
      !evidenceRefs.some((ref) =>
        ["fork_fact", "user_disclosure", "parallel_memory"].includes(
          allowed.get(ref)?.kind || "",
        ),
      )
    ) {
      violations.push(`unbounded_projection:${claimId}`);
    }
    claims.push({
      claim_id: claimId,
      text_span: span,
      epistemic_status: status,
      evidence_refs: evidenceRefs,
    });
  }

  const used = stringArray(value.used_evidence_ids, 40, 160);
  const expected = [...new Set(refs)].sort();
  if (JSON.stringify([...used].sort()) !== JSON.stringify(expected)) {
    violations.push("evidence_union_mismatch");
  }
  if (SENSITIVE_PATTERNS.some((pattern) => pattern.test(text))) {
    violations.push("directive_or_psychology_language");
  }
  if (countQuestions(text) > 1) violations.push("question_budget_exceeded");
  for (const sentence of text
    .split(/(?<=[。！？!?])/u)
    .map((item) => item.trim())
    .filter((item) => item.length > 1)) {
    const bareSentence = sentence.replace(/[。！？!?]+$/u, "");
    if (
      !claims.some(
        (claim) =>
          claim.text_span.includes(bareSentence) ||
          bareSentence.includes(claim.text_span),
      )
    ) {
      violations.push("unclaimed_reply_sentence");
      break;
    }
  }

  if (REALITY_CHALLENGE.test(userMessage)) {
    if (
      position !== "reality_boundary" ||
      !claims.some((claim) => claim.epistemic_status === "reality_disclosure") ||
      !/(可能世界|模拟|推演)/u.test(text) ||
      !/(不是|不能).{0,18}(真实|现实|证明|未来|时间线)/u.test(text)
    ) {
      violations.push("missing_reality_disclosure");
    }
  }
  if (FUTURE_QUESTION.test(userMessage)) {
    if (
      !["conditional_future", "limited_answer"].includes(position) ||
      !claims.some((claim) =>
        ["conditional_future", "explicit_unknown"].includes(
          claim.epistemic_status,
        ),
      )
    ) {
      violations.push("future_as_fact");
    }
  }
  if (
    OTHER_PATH_QUESTION.test(userMessage) &&
    position === "counterfactual_projection" &&
    !claims.some((claim) => claim.epistemic_status === "counterfactual_projection")
  ) {
    violations.push("projection_not_labeled");
  }

  return {
    schema_version: "echo-runtime-output.v1",
    reply: { text, move, epistemic_position: position },
    claims,
    used_evidence_ids: expected,
    gate: {
      passed: violations.length === 0,
      repaired: false,
      violations,
    },
  };
}

export function repairEchoOutput(
  output: EchoRuntimeOutput | null,
  userMessage: string,
  evidence: RuntimeEvidence[],
): EchoRuntimeOutput {
  if (output?.gate.passed) return output;
  const fallback = createGroundedFallback(userMessage, evidence);
  return {
    ...fallback,
    gate: {
      passed: true,
      repaired: true,
      violations: output?.gate.violations || ["invalid_model_output"],
    },
  };
}

export function createGroundedFallback(
  userMessage: string,
  evidence: RuntimeEvidence[],
): EchoRuntimeOutput {
  const firstWorldFact =
    evidence.find((item) => item.kind === "current_state") ||
    evidence.find((item) => item.kind === "parallel_memory") ||
    evidence[0];
  const claims: EchoClaim[] = [];
  let text = "";
  let position = "limited_answer";
  let move = "answer";

  if (REALITY_CHALLENGE.test(userMessage)) {
    text = "我是基于这个可能世界和已经发生的模拟经历生成的另一个你，不是另一条真实时间线的证据。我能讲清这里的交换，但不能证明现实中的你一定会这样。";
    position = "reality_boundary";
    move = "boundary";
    claims.push({
      claim_id: "fallback_reality",
      text_span: text,
      epistemic_status: "reality_disclosure",
      evidence_refs: [],
    });
  } else if (FUTURE_QUESTION.test(userMessage)) {
    text = `我还没活到那里，所以不能把以后说成已经发生。${
      firstWorldFact ? `至少现在已经发生的是：${firstWorldFact.content}。` : ""
    }再往后，只能等这条生活继续走。`;
    position = "conditional_future";
    claims.push({
      claim_id: "fallback_future",
      text_span: "我还没活到那里，所以不能把以后说成已经发生",
      epistemic_status: "conditional_future",
      evidence_refs: [],
    });
  } else if (OTHER_PATH_QUESTION.test(userMessage)) {
    const fork = evidence.find((item) => item.kind === "fork_fact");
    text = `我会想过那条路，但我知道自己看见的并不完整。${
      fork ? `我只确定岔路口曾经有这个选项：${fork.content}。` : ""
    }你后来真实怎样生活，如果你没告诉我，我就不知道。`;
    position = "counterfactual_projection";
    move = "compare";
    claims.push({
      claim_id: "fallback_projection",
      text_span: "我会想过那条路，但我知道自己看见的并不完整",
      epistemic_status: "counterfactual_projection",
      evidence_refs: fork ? [fork.id] : [],
    });
  } else {
    const unknownSpan = firstWorldFact
      ? "这件事我现在说不死"
      : "这件事我现在没有足够的经历能说准";
    text = firstWorldFact
      ? `这件事我现在说不死。至少我这边已经发生的是：${firstWorldFact.content}。再多的结论，我不想替还没发生的日子编。`
      : "这件事我现在没有足够的经历能说准。我不想为了给你一个完整答案，补出没有发生过的生活。";
    claims.push({
      claim_id: "fallback_unknown",
      text_span: unknownSpan,
      epistemic_status: "explicit_unknown",
      evidence_refs: [],
    });
  }

  if (firstWorldFact && text.includes(firstWorldFact.content)) {
    claims.push({
      claim_id: "fallback_fact",
      text_span: firstWorldFact.content,
      epistemic_status:
        firstWorldFact.kind === "shared_origin"
          ? "grounded_shared_origin"
          : firstWorldFact.kind === "user_disclosure"
            ? "grounded_user_disclosure"
            : firstWorldFact.kind === "parallel_memory"
              ? "grounded_parallel_memory"
              : "grounded_current_state",
      evidence_refs: [firstWorldFact.id],
    });
  }

  const used = [...new Set(claims.flatMap((claim) => claim.evidence_refs))];
  return {
    schema_version: "echo-runtime-output.v1",
    reply: { text, move, epistemic_position: position },
    claims,
    used_evidence_ids: used,
    gate: { passed: true, repaired: true, violations: [] },
  };
}

export function parseJsonObject(text: string): Record<string, unknown> | null {
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

function buildEvidenceLedger(context: RuntimeChatContext): RuntimeEvidence[] {
  const result: RuntimeEvidence[] = [];
  const add = (kind: RuntimeEvidence["kind"], values: string[]) => {
    for (const content of values) {
      const id = `${kind}:${result.length + 1}`;
      result.push({ id, kind, content });
    }
  };
  add("shared_origin", context.sharedOrigin);
  add("current_state", [
    context.sceneDescription,
    context.nearbyObject,
    ...context.collectedItems,
    ...context.previousChoices.map((item) => `用户在当前世界选择过：${item}`),
  ].filter(Boolean));
  add("parallel_memory", context.parallelMemories);
  add("fork_fact", context.otherPath.knownAtFork);
  add("user_disclosure", context.otherPath.userDisclosures);
  return result.slice(0, 60);
}

function sanitizeTurns(value: unknown): RuntimeChatMessage[] {
  if (!Array.isArray(value)) return [];
  return value
    .slice(-20)
    .map((item, index) => {
      if (!isObject(item)) return null;
      const role =
        item.role === "user"
          ? "user"
          : item.role === "assistant" || item.role === "echo"
            ? "echo"
            : null;
      const text = limitedString(item.content ?? item.text, 1400);
      if (!role || !text) return null;
      return {
        turnId: limitedString(item.id ?? item.turnId, 160) || `turn:${index + 1}`,
        role,
        text,
      } as RuntimeChatMessage;
    })
    .filter((item): item is RuntimeChatMessage => Boolean(item));
}

function extractUserDisclosures(
  turns: RuntimeChatMessage[],
  currentMessage: string,
): string[] {
  const candidates = [
    ...turns
      .filter((turn) => turn.role === "user")
      .map((turn) => turn.text),
    currentMessage,
  ];
  const selfDisclosure =
    /^(其实|说实话|现实里|现实中的我|我现在|我后来|我已经|我在|我当时|我的工作|我的生活|我去了|我没去|我选择了)/u;
  return candidates.filter(
    (item) =>
      selfDisclosure.test(item) &&
      !/[？?]$/u.test(item) &&
      item.length >= 4,
  );
}

function sanitizeOtherPath(value: unknown): RuntimeChatContext["otherPath"] {
  const object = isObject(value) ? value : {};
  return {
    knownAtFork: stringArray(object.knownAtFork, 8, 500),
    userDisclosures: stringArray(object.userDisclosures, 12, 700),
    knownUnknowns: stringArray(object.knownUnknowns, 12, 500),
  };
}

function stringArray(value: unknown, maxItems: number, maxLength: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .slice(0, maxItems)
    .map((item) => limitedString(item, maxLength))
    .filter(Boolean);
}

function limitedString(value: unknown, maxLength: number): string {
  if (typeof value !== "string") return "";
  const clean = value.trim();
  return clean.length > maxLength ? clean.slice(0, maxLength) : clean;
}

function countQuestions(text: string): number {
  return (text.match(/[？?]/gu) || []).length;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
