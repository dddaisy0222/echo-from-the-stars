"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type WorldEvent = {
  title: string;
  detail: string;
  polarity: "gain" | "cost" | "turn";
};

type WorldState = {
  seed?: string;
  truth?: string;
  action?: string;
  answers?: string[];
  profile?: { name?: string };
  events?: WorldEvent[];
};

type ChatMessage = {
  role: "you" | "echo";
  text: string;
};

const fallbackEvents: WorldEvent[] = [
  {
    title: "她真的去了远方",
    detail: "新的城市给了她重新定义自己的自由，也让生活第一次完全由自己承担。",
    polarity: "gain",
  },
  {
    title: "她错过了一些普通的晚上",
    detail: "获得自由的代价，是熟悉的人生继续发生时，她常常只能隔着屏幕看见。",
    polarity: "cost",
  },
  {
    title: "她还是会问同一个问题",
    detail: "地点变了，真正放不下的东西没有变：她依然希望被理解，也希望自己没有辜负谁。",
    polarity: "turn",
  },
];

const evidenceMeta = {
  gain: {
    index: "01",
    label: "她得到的",
    object: "一张没用过的登机牌",
    symbol: "+",
  },
  cost: {
    index: "02",
    label: "她失去的",
    object: "一段没有接通的语音",
    symbol: "−",
  },
  turn: {
    index: "03",
    label: "始终没变的",
    object: "一张写到一半的便签",
    symbol: "∞",
  },
};

function localReply(message: string, state: WorldState) {
  if (/后悔|值得|快乐|选错/.test(message)) {
    return "我后悔过，但后悔不是走错的证据。这里确实有你向往的自由，也有你从门外看不见的交换；我不是你错过的正确答案。";
  }
  if (/失去|代价|错过/.test(message)) {
    return "我失去的不是一句抽象的“稳定”，而是一些本来会一起吃饭、一起回家的普通晚上。得到另一种生活，并没有让我同时保留所有可能。";
  }
  if (/现在|怎么办|回去|行动/.test(message)) {
    return `回去以后不用复制我。只从你羡慕我的部分拿走一个最小动作：${state.action || "做一件今天就能开始的小事"}。`;
  }
  return `换了城市和生活之后，有件事仍然反复出现：${state.truth || "我还是想被理解，也还是想确认自己的选择属于自己"}。也许你想念的不是我的人生，而是那个敢于选择的你。`;
}

export default function WorldPage() {
  const [world, setWorld] = useState<WorldState>({});
  const [entered, setEntered] = useState(false);
  const [collected, setCollected] = useState<string[]>([]);
  const [active, setActive] = useState<WorldEvent | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const events = useMemo(() => {
    const supplied = Array.isArray(world.events) ? world.events : [];
    return (supplied.length >= 3 ? supplied : fallbackEvents).slice(0, 3);
  }, [world]);

  const parallelName = world.profile?.name
    ? `五年后的${world.profile.name}`
    : "沿另一条路生活的你";

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("echo.worldState");
      if (stored) setWorld(JSON.parse(stored));
    } catch {
      // The snapshot world remains playable without local storage.
    }
  }, []);

  function inspect(event: WorldEvent) {
    setActive(event);
  }

  function keepEvidence(event: WorldEvent) {
    setCollected((current) =>
      current.includes(event.polarity) ? current : [...current, event.polarity],
    );
    setActive(null);
  }

  function meetParallelSelf() {
    const firstQuestion = world.answers?.[4];
    setMessages([
      {
        role: "echo",
        text: firstQuestion
          ? `你终于来了。我知道你想问：“${firstQuestion}” 现在，你可以亲口问我。`
          : "你终于来了。这里和你想象的一样吗？",
      },
    ]);
    setChatOpen(true);
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = draft.trim();
    if (!message || sending) return;
    setDraft("");
    setMessages((current) => [...current, { role: "you", text: message }]);
    setSending(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify({
          message,
          worldContext: {
            sceneDescription: `一间被浅水淹没的旧卧室。用户打开的岔路是：${world.seed || "另一条没有走过的人生"}。`,
            nearbyObject: `始终没变的是：${world.truth || "选择之后仍然反复出现的渴望"}`,
            collectedItems: events
              .filter((item) => collected.includes(item.polarity))
              .map((item) => item.title),
          },
        }),
      });

      if (!response.ok) throw new Error("model unavailable");
      const body = await response.text();
      const delta = body
        .split("\n")
        .find((line) => line.startsWith("data:") && line.includes('"text"'));
      const reply = delta
        ? (JSON.parse(delta.slice(5).trim()) as { text?: string }).text
        : "";
      setMessages((current) => [
        ...current,
        { role: "echo", text: reply || localReply(message, world) },
      ]);
    } catch {
      await new Promise((resolve) => window.setTimeout(resolve, 620));
      setMessages((current) => [
        ...current,
        { role: "echo", text: localReply(message, world) },
      ]);
    } finally {
      setSending(false);
    }
  }

  return (
    <main className={`memory-world ${entered ? "is-entered" : ""}`}>
      <div className="memory-scene" aria-hidden="true" />
      <div className="memory-vignette" aria-hidden="true" />

      {!entered && (
        <section className="world-intro">
          <p>ECHO / WORLD 01</p>
          <h1>这间房间，已经替你保存了五年。</h1>
          <span>{world.seed || "另一条没有走过的人生"}</span>
          <button type="button" onClick={() => setEntered(true)}>
            进入这条时间线 <b>→</b>
          </button>
          <small>请戴上耳机 · 点击房间里的三个回声</small>
        </section>
      )}

      {entered && (
        <>
          <aside className="world-mission">
            <small>WORLD 01 · 人生证据</small>
            <strong>{collected.length} / 3</strong>
            <p>
              {collected.length < 3
                ? `还差 ${3 - collected.length} 件证据：得到、失去与始终没变`
                : "证据已经齐了。水里的另一个你正在看你。"}
            </p>
          </aside>

          <button
            className="world-exit"
            type="button"
            onClick={() => {
              window.location.href = "/?returned=1";
            }}
          >
            <span>离开这条时间线</span>
            <small>带着证据回到现在 ↗</small>
          </button>

          <div className="memory-hotspots">
            {events.map((event) => {
              const meta = evidenceMeta[event.polarity];
              return (
                <button
                  key={event.polarity}
                  className={`memory-point point-${event.polarity} ${
                    collected.includes(event.polarity) ? "is-collected" : ""
                  }`}
                  type="button"
                  onClick={() => inspect(event)}
                  aria-label={`查看${meta.label}`}
                >
                  <i />
                  <span>{collected.includes(event.polarity) ? "✓" : meta.symbol}</span>
                  <small>{meta.object}</small>
                </button>
              );
            })}
          </div>

          {collected.length === 3 && !chatOpen && (
            <button className="parallel-reflection" type="button" onClick={meetParallelSelf}>
              <span className="reflection-body" />
              <strong>她没有跟着你的动作移动。</strong>
              <small>靠近水面，与另一个自己对话 →</small>
            </button>
          )}
        </>
      )}

      {active && (
        <section className="evidence-dialog" role="dialog" aria-modal="true">
          <button className="dialog-close" type="button" onClick={() => setActive(null)}>
            ×
          </button>
          <p>
            {evidenceMeta[active.polarity].index} /{" "}
            {evidenceMeta[active.polarity].label}
          </p>
          <h2>{active.title}</h2>
          <blockquote>{active.detail}</blockquote>
          <div className="evidence-object">
            <span>{evidenceMeta[active.polarity].symbol}</span>
            <div>
              <small>人生证据</small>
              <strong>{evidenceMeta[active.polarity].object}</strong>
            </div>
          </div>
          <button className="keep-evidence" type="button" onClick={() => keepEvidence(active)}>
            把它带走 <span>→</span>
          </button>
        </section>
      )}

      {chatOpen && (
        <section className="parallel-chat" role="dialog" aria-label={parallelName}>
          <header>
            <div>
              <small>PARALLEL SELF / T+5Y</small>
              <h2>{parallelName}</h2>
            </div>
            <button type="button" onClick={() => setChatOpen(false)}>
              ×
            </button>
          </header>
          <div className="parallel-messages">
            {messages.map((message, index) => (
              <article key={`${message.role}-${index}`} className={`message-${message.role}`}>
                <small>{message.role === "you" ? "现在的你" : parallelName}</small>
                <p>{message.text}</p>
              </article>
            ))}
            {sending && (
              <article className="message-echo is-thinking">
                <small>{parallelName}</small>
                <p>她在想起这五年里的一些事……</p>
              </article>
            )}
          </div>
          <form onSubmit={sendMessage}>
            <textarea
              value={draft}
              autoFocus
              placeholder="你可以问：你后悔吗？你失去了什么？"
              onChange={(event) => setDraft(event.target.value)}
            />
            <button type="submit" disabled={!draft.trim() || sending}>
              发送 →
            </button>
          </form>
          <button
            className="bring-back"
            type="button"
            onClick={() => {
              window.location.href = "/?returned=1";
            }}
          >
            结束对话，带一件东西回到现实
          </button>
        </section>
      )}
    </main>
  );
}
