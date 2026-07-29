"use client";

import { FormEvent, useMemo, useState } from "react";
import styles from "./lab.module.css";

type Phase = "idle" | "seed" | "agents" | "timeline" | "echo" | "done" | "error";

type EchoEvent = {
  year: string;
  title: string;
  detail: string;
  polarity: "gain" | "cost" | "turn";
};

type EchoObject = {
  name: string;
  meaning: string;
};

type EchoWorld = {
  source: "live" | "snapshot";
  worldName: string;
  identity: string;
  scene: string;
  quote: string;
  truth: string;
  action: string;
  events: EchoEvent[];
  objects: EchoObject[];
};

const phases: Array<{ id: Exclude<Phase, "idle" | "done" | "error">; label: string }> = [
  { id: "seed", label: "生成世界本体" },
  { id: "agents", label: "构建记忆与 Agents" },
  { id: "timeline", label: "运行平行人生" },
  { id: "echo", label: "生成 Echo 空间" },
];

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

type ApiEnvelope = {
  success?: boolean;
  error?: string;
  data?: Record<string, unknown>;
};

async function requestJson(
  url: string,
  init?: RequestInit,
): Promise<ApiEnvelope & Record<string, unknown>> {
  const response = await fetch(url, init);
  const payload = (await response.json().catch(() => ({}))) as ApiEnvelope &
    Record<string, unknown>;
  if (!response.ok || payload.success === false) {
    throw new Error(payload.error || `MiroFish 请求失败（${response.status}）`);
  }
  return payload;
}

async function pollUntil(
  request: () => Promise<ApiEnvelope & Record<string, unknown>>,
  isDone: (data: Record<string, unknown>) => boolean,
  isFailed: (data: Record<string, unknown>) => boolean,
  maxAttempts = 300,
) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const payload = await request();
    const data = payload.data ?? payload;
    if (isFailed(data)) {
      throw new Error(
        stringifyCompact(data.error ?? data.message) || "MiroFish 推演失败。",
      );
    }
    if (isDone(data)) return data;
    await wait(2000);
  }
  throw new Error("这条人生仍在生成，请稍后重新进入。");
}

function buildSeedDocument(question: string, context: string) {
  return [
    "ECHO PARALLEL LIFE SEED",
    "",
    `人生岔路：${question}`,
    `当时没有选择它的原因：${context}`,
    "",
    "模拟对象：做出另一种选择后的同一个人。",
    "重要关系：过去的自己、家人、亲密朋友、同事、未来可能遇见的伙伴与导师。",
    "需要推演的变量：生活地点、工作节奏、关系变化、获得的自由、失去的东西、长期价值排序。",
    "模拟原则：不要生成完美人生；每一种获得必须伴随真实代价。让 Agents 通过多轮互动形成因果，而不是直接给用户建议。",
    "输出目标：得到可追踪的人生事件、平行自我 Profile 与关系变化，供 Echo 转译成空间和对话。",
  ].join("\n");
}

function stringifyCompact(value: unknown) {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .slice(0, 4)
      .map(([key, item]) => `${key}: ${stringifyCompact(item)}`)
      .join("；");
  }
  return "";
}

function mapMiroFishToEcho(
  seed: string,
  timelinePayload: Record<string, unknown>,
  profilesPayload: Record<string, unknown>,
): EchoWorld {
  const rawTimeline =
    (timelinePayload.data as { timeline?: unknown[] } | undefined)?.timeline ??
    timelinePayload.timeline ??
    [];
  const rawProfiles =
    (profilesPayload.data as { profiles?: unknown[] } | undefined)?.profiles ??
    profilesPayload.profiles ??
    [];

  const events = (Array.isArray(rawTimeline) ? rawTimeline : [])
    .slice(-5)
    .map((item, index): EchoEvent => {
      const record = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
      return {
        year: `T+${index + 1}`,
        title:
          stringifyCompact(record.summary ?? record.topic ?? record.event) ||
          `模拟世界第 ${index + 1} 次转向`,
        detail:
          stringifyCompact(record.actions ?? record.content ?? record) ||
          "这段生活改变了另一个自己的关系、节奏与选择。",
        polarity: index % 3 === 1 ? "cost" : index % 3 === 2 ? "gain" : "turn",
      };
    });

  const firstProfile =
    Array.isArray(rawProfiles) && rawProfiles[0] && typeof rawProfiles[0] === "object"
      ? (rawProfiles[0] as Record<string, unknown>)
      : {};
  const profileName =
    stringifyCompact(firstProfile.name ?? firstProfile.username ?? firstProfile.bio) ||
    "平行世界中的你";

  return {
    source: "live",
    worldName: "MIROFISH GENERATED WORLD",
    identity: profileName,
    scene: "这一空间由 MiroFish 中真实运行过的 Agents、关系与时间线生成。",
    quote: "你看到的不是答案，而是一种选择在时间中留下的具体后果。",
    truth: `关于“${seed.slice(0, 42)}${seed.length > 42 ? "…" : ""}”，你真正需要确认的是自己愿意承担哪一种代价。`,
    action: "从这条时间线中挑一个仍然让你心动的部分，在现实中完成一个最小版本。",
    events,
    objects: [
      { name: "Agent Profile", meaning: "定义另一个自己如何理解世界、关系与风险。" },
      { name: "Timeline Log", meaning: "保存选择经过多轮互动后形成的连锁反应。" },
      { name: "World State", meaning: "让这个平行人生不是一次性回答，而是可以继续生长的状态。" },
    ],
  };
}

function buildSnapshotWorld(seed: string, context: string): EchoWorld {
  const road = seed.replace(/[？?。.]$/, "");
  return {
    source: "snapshot",
    worldName: "ECHO WORLD SNAPSHOT",
    identity: "走进那条路之后的你",
    scene: `这个房间保存着“${road}”继续发生五年后的三件人生证据。`,
    quote: "我不是你错过的正确答案。我只是替你把那条路的代价也活了一遍。",
    truth:
      "世界变了，你反复在意的东西却没有变：被理解、拥有选择，也不愿失去真正重要的人。",
    action:
      "回到现实后，不复制这条人生；只从你羡慕它的部分里，拿走一个今天能完成的最小动作。",
    events: [
      {
        year: "T+1",
        title: "她真的推开了那扇门",
        detail: `她不再需要想象“${road}”，新的城市和身份给了她重新定义自己的自由。`,
        polarity: "gain",
      },
      {
        year: "T+3",
        title: "有些普通日子没有等她",
        detail: `${context || "当时没走的理由"}并没有消失；得到另一种生活，也意味着错过此刻拥有的一部分关系。`,
        polarity: "cost",
      },
      {
        year: "T+5",
        title: "她在深夜问了同一个问题",
        detail:
          "地点、工作和关系都变了，她依然在寻找被理解，也依然害怕自己的选择会辜负谁。",
        polarity: "turn",
      },
    ],
    objects: [
      {
        name: "一张没用过的登机牌",
        meaning: "证明那条路确实有你向往的自由，而不代表它是正确答案。",
      },
      {
        name: "一段没有接通的语音",
        meaning: "每一种获得都伴随交换；平行人生也有不能同时拥有的东西。",
      },
      {
        name: "一张写到一半的便签",
        meaning: "换了世界仍然重复出现的渴望，才是这一生真正的问题。",
      },
    ],
  };
}

export default function MiroFishLab() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [seed, setSeed] = useState(
    "如果当年我离开杭州，去了伦敦工作，我会不会比现在更快乐？",
  );
  const [context, setContext] = useState(
    "我一直把那条没走的路想得很自由。可我也知道，当时留下来，是因为舍不得身边的人。",
  );
  const [world, setWorld] = useState<EchoWorld | null>(null);
  const [error, setError] = useState("");

  const activeIndex = useMemo(
    () => phases.findIndex((item) => item.id === phase),
    [phase],
  );

  async function runMiroFishLive() {
    setPhase("seed");
    const health = await fetch("/health", {
      signal: AbortSignal.timeout(2500),
    });
    if (!health.ok) {
      throw new Error("MiroFish 服务尚未启动，请等待 Cowork 完成后端部署。");
    }

    const seedDocument = buildSeedDocument(seed.trim(), context.trim());
    const ontologyForm = new FormData();
    ontologyForm.append(
      "files",
      new File([seedDocument], "echo-seed.txt", { type: "text/plain" }),
    );
    ontologyForm.append(
      "simulation_requirement",
      `推演做出另一种人生选择后的 5 年，重点观察收获、代价与关系变化。用户的问题是：${seed.trim()}`,
    );
    ontologyForm.append("project_name", `Echo · ${seed.trim().slice(0, 24)}`);
    ontologyForm.append(
      "additional_context",
      "这是个人反事实人生探索，不是事实预测。请保留不确定性，并避免生成绝对化心理判断。",
    );
    const ontology = await requestJson("/api/graph/ontology/generate", {
      method: "POST",
      body: ontologyForm,
    });
    const projectId = String(ontology.data?.project_id ?? "");
    if (!projectId) throw new Error("MiroFish 没有返回 project ID。");

    setPhase("agents");
    const graphBuild = await requestJson("/api/graph/build", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project_id: projectId,
        graph_name: `echo_${Date.now()}`,
        chunk_size: 500,
        chunk_overlap: 50,
      }),
    });
    const graphTaskId = String(graphBuild.data?.task_id ?? "");
    if (!graphTaskId) throw new Error("MiroFish 没有启动记忆图谱构建。");
    const graphTask = await pollUntil(
      () => requestJson(`/api/graph/task/${encodeURIComponent(graphTaskId)}`),
      (data) => data.status === "completed",
      (data) => data.status === "failed",
    );
    const graphResult =
      graphTask.result && typeof graphTask.result === "object"
        ? (graphTask.result as Record<string, unknown>)
        : {};
    const graphId = String(graphResult.graph_id ?? graphBuild.data?.graph_id ?? "");
    if (!graphId) throw new Error("MiroFish 图谱完成，但没有返回 graph ID。");

    const simulation = await requestJson("/api/simulation/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project_id: projectId,
        graph_id: graphId,
        enable_twitter: false,
        enable_reddit: true,
      }),
    });
    const simulationId = String(simulation.data?.simulation_id ?? "");
    if (!simulationId) throw new Error("MiroFish 没有创建 simulation。");

    const prepare = await requestJson("/api/simulation/prepare", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        simulation_id: simulationId,
        use_llm_for_profiles: true,
        parallel_profile_count: 3,
        force_regenerate: false,
      }),
    });
    const prepareTaskId = String(prepare.data?.task_id ?? "");
    if (prepare.data?.status !== "ready") {
      await pollUntil(
        () =>
          requestJson("/api/simulation/prepare/status", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              task_id: prepareTaskId || undefined,
              simulation_id: simulationId,
            }),
          }),
        (data) => data.status === "ready" || data.status === "completed",
        (data) => data.status === "failed",
      );
    }

    setPhase("timeline");
    await requestJson("/api/simulation/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        simulation_id: simulationId,
        platform: "reddit",
        max_rounds: 8,
        enable_graph_memory_update: false,
      }),
    });
    await pollUntil(
      () =>
        requestJson(
          `/api/simulation/${encodeURIComponent(simulationId)}/run-status`,
        ),
      (data) =>
        data.runner_status === "completed" || data.runner_status === "stopped",
      (data) => data.runner_status === "failed",
    );

    setPhase("echo");
    const [profilesPayload, timelinePayload] = await Promise.all([
      requestJson(
        `/api/simulation/${encodeURIComponent(simulationId)}/profiles`,
      ),
      requestJson(
        `/api/simulation/${encodeURIComponent(simulationId)}/timeline?start_round=0`,
      ),
    ]);
    const timeline =
      (timelinePayload.data as { timeline?: unknown[] } | undefined)?.timeline ??
      timelinePayload.timeline;
    if (!Array.isArray(timeline) || timeline.length === 0) {
      throw new Error("MiroFish 已完成推演，但这次没有产生可用的人生事件。");
    }
    const generatedWorld = mapMiroFishToEcho(
      `${seed.trim()}\n${context.trim()}`,
      timelinePayload,
      profilesPayload,
    );
    setWorld(generatedWorld);
    persistWorld(generatedWorld, seed.trim(), context.trim());
    setPhase("done");
  }

  async function runSnapshotFallback() {
    setPhase("seed");
    await wait(380);
    setPhase("agents");
    await wait(460);
    setPhase("timeline");
    await wait(620);
    setPhase("echo");
    await wait(420);
    const generatedWorld = buildSnapshotWorld(seed.trim(), context.trim());
    setWorld(generatedWorld);
    persistWorld(generatedWorld, seed.trim(), context.trim());
    setPhase("done");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!seed.trim() || phase === "seed" || phase === "agents" || phase === "timeline" || phase === "echo") {
      return;
    }
    setError("");
    setWorld(null);
    try {
      await runMiroFishLive();
    } catch (cause) {
      console.warn("[Echo] MiroFish Live 不可用，启用 World Snapshot", cause);
      try {
        await runSnapshotFallback();
      } catch {
        setError("这扇门暂时没有打开，请再试一次。");
        setPhase("error");
      }
    }
  }

  function enterWorld() {
    if (!world) return;
    ["gain", "cost", "truth"].forEach((id) => {
      window.sessionStorage.removeItem(`echo.inventory.${id}`);
    });
    persistWorld(world, seed.trim(), context.trim());
    window.location.assign(new URL("world/", window.location.href).toString());
  }

  const running = !["idle", "done", "error"].includes(phase);

  return (
    <main className={styles.shell}>
      <div className={styles.noise} aria-hidden="true" />
      <header className={styles.header}>
        <a className={styles.brand} href="/" aria-label="返回 Echo">
          <span className={styles.orbit} />
          <span>
            ECHO
            <small>MIROFISH ADAPTER LAB</small>
          </span>
        </a>
        <span className={styles.badge}>
          <i className={styles.live} />
          MIROFISH · LIVE FIRST
        </span>
      </header>

      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>A MEMORY YOU NEVER LIVED</p>
          <h1>
            推开一扇门，
            <br />
            去见没走过的自己。
          </h1>
          <p className={styles.intro}>
            你一直美化的那条路，不再只是一句“如果”。Echo 让它在门后真实生活几年，
            再把得到、代价和仍未改变的你，放回这间房。
          </p>
          <a className={styles.enterCue} href="#world-seed">
            写下一条没走过的路
            <span>↓</span>
          </a>
        </div>
        <div className={styles.sceneNote} aria-label="场景说明">
          <span>2008 · HANGZHOU</span>
          <p>一间属于你的记忆房间</p>
        </div>
      </section>

      <div className={styles.workspace} id="world-seed">
        <form className={styles.panel} onSubmit={submit}>
          <div className={styles.panelHead}>
            <span>01</span>
            <div>
              <p>选择一扇门</p>
              <small>只需要一个你反复想起的“如果”</small>
            </div>
          </div>

          <label>
            你一直在美化哪条没有走过的路？
            <textarea
              value={seed}
              onChange={(event) => setSeed(event.target.value)}
              rows={3}
              maxLength={180}
            />
          </label>

          <label>
            当时的你为什么没有走？
            <textarea
              value={context}
              onChange={(event) => setContext(event.target.value)}
              rows={3}
              maxLength={260}
            />
          </label>

          <button className={styles.runButton} type="submit" disabled={running}>
            <span>{running ? "正在推演另一条人生" : "生成一个平行世界"}</span>
            <b>{running ? "•••" : "↗"}</b>
          </button>
          {error && <p className={styles.error}>{error}</p>}
        </form>

        <section className={`${styles.panel} ${styles.output}`} aria-live="polite">
          <div className={styles.panelHead}>
            <span>02</span>
            <div>
              <p>门后的时间</p>
              <small>世界会先生活，再与你相遇</small>
            </div>
          </div>

          <div className={styles.pipeline}>
            {phases.map((item, index) => (
              <div
                className={`${styles.pipeStep} ${
                  phase === "done" || index <= activeIndex ? styles.complete : ""
                }`}
                key={item.id}
              >
                <i>{phase === "done" || index < activeIndex ? "✓" : index + 1}</i>
                <span>{item.label}</span>
              </div>
            ))}
          </div>

          {!world && !running && (
            <div className={styles.empty}>
              <span className={styles.portal} />
              <p>门还没有打开</p>
              <small>写下一条你总忍不住美化的人生岔路。</small>
            </div>
          )}

          {running && (
            <div className={styles.empty}>
              <span className={`${styles.portal} ${styles.spinning}`} />
              <p>{phases[activeIndex]?.label ?? "正在连接世界"}</p>
              <small>把群体模拟压缩为一个人能够感受到的瞬间。</small>
            </div>
          )}

          {world && (
            <div className={styles.world}>
              <div className={styles.worldTitle}>
                <small>{world.worldName}</small>
                <h2>{world.identity}</h2>
                <p>{world.scene}</p>
              </div>

              <div className={styles.timeline}>
                {world.events.map((event) => (
                  <article key={`${event.year}-${event.title}`}>
                    <i data-tone={event.polarity} />
                    <time>{event.year}</time>
                    <div>
                      <h3>{event.title}</h3>
                      <p>{event.detail}</p>
                    </div>
                  </article>
                ))}
              </div>

              <div className={styles.objects}>
                {world.objects.map((object, index) => (
                  <article key={object.name}>
                    <span>0{index + 1}</span>
                    <h3>{object.name}</h3>
                    <p>{object.meaning}</p>
                  </article>
                ))}
              </div>

              <blockquote>“{world.quote}”</blockquote>

              <div className={styles.capsule}>
                <small>ECHO CAPSULE · 带回现实</small>
                <h3>{world.truth}</h3>
                <p>{world.action}</p>
              </div>

              <button
                className={styles.enterWorld}
                type="button"
                onClick={enterWorld}
              >
                <span>进入这间房，亲手找到三件证据</span>
                <b>↗</b>
              </button>
            </div>
          )}
        </section>
      </div>

      <footer>
        <span>MIROFISH</span>
        <i>模拟因果</i>
        <b>→</b>
        <span>ECHO</span>
        <i>转译感受</i>
        <b>→</b>
        <span>REALITY</span>
        <i>带回行动</i>
      </footer>
    </main>
  );
}

function persistWorld(world: EchoWorld, seed: string, context: string) {
  try {
    window.localStorage.setItem(
      "echo.worldState",
      JSON.stringify({
        ...world,
        seed,
        context,
        cost: world.events.find((event) => event.polarity === "cost")?.detail,
        savedAt: new Date().toISOString(),
      }),
    );
  } catch (error) {
    console.warn("[Echo] 世界状态未能保存", error);
  }
}
