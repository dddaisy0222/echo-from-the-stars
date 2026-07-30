"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type WorldEvent = {
  time: string;
  title: string;
  detail: string;
  polarity: "gain" | "cost" | "turn";
};

type WorldChoice = {
  id: string;
  label: string;
  reveals: string;
};

type WorldScene = {
  id: string;
  time: string;
  place: string;
  title: string;
  atmosphere: string;
  situation: string;
  choicePrompt: string;
  choices: WorldChoice[];
  evidence: WorldEvent;
};

type WorldState = {
  version?: number;
  seed?: string;
  truth?: string;
  action?: string;
  centralTension?: string;
  answers?: string[];
  profile?: { name?: string };
  events?: WorldEvent[];
  scenes?: WorldScene[];
};

type ChatMessage = {
  role: "you" | "echo";
  text: string;
};

type ChoiceRecord = {
  sceneId: string;
  choiceId: string;
  label: string;
  consequence: string;
};

const fallbackEvents: WorldEvent[] = [
  {
    time: "第一幕 · 出发后的第一个晚上",
    title: "她真的去了远方",
    detail: "新的城市给了她重新定义自己的自由，也让生活第一次完全由自己承担。",
    polarity: "gain",
  },
  {
    time: "第二幕 · 第 312 天",
    title: "她错过了一些普通的晚上",
    detail: "获得自由的代价，是熟悉的人生继续发生时，她常常只能隔着屏幕看见。",
    polarity: "cost",
  },
  {
    time: "第三幕 · 第五年",
    title: "她还是会问同一个问题",
    detail: "地点变了，真正放不下的东西没有变：她依然希望被理解，也希望自己没有辜负谁。",
    polarity: "turn",
  },
];

const evidenceMeta = {
  gain: { index: "01", label: "她得到的", object: "一张单程票", symbol: "+" },
  cost: { index: "02", label: "她失去的", object: "一段未接语音", symbol: "−" },
  turn: { index: "03", label: "始终没变的", object: "写到一半的便签", symbol: "∞" },
};

function fallbackScenes(events: WorldEvent[]): WorldScene[] {
  return [
    {
      id: "arrival",
      time: events[0].time,
      place: "新生活的第一个房间",
      title: "抵达后的第一个晚上",
      atmosphere: "纸箱还没有拆完。窗外的城市没有想象中那么浪漫，手机同时亮起两条消息。",
      situation: "一条来自新工作，一条来自你没能一起带来的人。",
      choicePrompt: "今晚，你先回应谁？",
      choices: [
        { id: "work", label: "先回复新工作，把第一步站稳", reveals: "你迅速获得信任；家里的通话被推迟到第二天。" },
        { id: "home", label: "先给重要的人回电话", reveals: "你听见熟悉的声音，也第一次承认自己其实很害怕。" },
      ],
      evidence: events[0],
    },
    {
      id: "exchange",
      time: events[1].time,
      place: "第 312 天 · 一次重要机会之前",
      title: "新的生活开始向你索取东西",
      atmosphere: "桌上放着一份会改变未来两年的邀请，手机里还有一条很久没回复的语音。",
      situation: "你得到了一部分想要的自由，也越来越清楚它不会自动解决所有问题。",
      choicePrompt: "这一次，你把时间给谁？",
      choices: [
        { id: "accelerate", label: "接下机会，再向前一步", reveals: "你的名字开始被更多人知道；一些普通晚上从日历里消失。" },
        { id: "repair", label: "停下来，修复正在变远的关系", reveals: "你错过最快的上升，却没有再让忙碌替自己作答。" },
      ],
      evidence: events[1],
    },
    {
      id: "meeting",
      time: events[2].time,
      place: "第五年 · 她独自待着的房间",
      title: "你终于见到了沿这条路生活的自己",
      atmosphere: "她身边有你羡慕的东西，也留下了几件从照片里看不出来的遗憾。",
      situation: "她知道你为什么来，也知道自己不是一个正确答案。",
      choicePrompt: "见到她以后，你先看什么？",
      choices: [
        { id: "achievement", label: "看她终于拥有的东西", reveals: "那些成果是真的，但没有替她回答所有问题。" },
        { id: "ordinary", label: "看她如何度过一个普通晚上", reveals: "真正让你共情的，是她也会犹豫、孤独和想家。" },
      ],
      evidence: events[2],
    },
  ];
}

function localReply(message: string, state: WorldState, choices: ChoiceRecord[]) {
  const first = choices[0]?.consequence;
  const second = choices[1]?.consequence;
  if (/后悔|值得|快乐|选错/.test(message)) {
    return `我后悔过，但后悔不是走错的证据。${first || "这里确实有你向往的东西"}；${second || "也有你从门外看不见的交换"}。我不是你错过的正确答案。`;
  }
  if (/失去|代价|错过/.test(message)) {
    return `代价不是一个抽象名词。${second || "我错过了一些本来会一起吃饭、一起回家的普通晚上"}。得到另一种生活，并没有让我同时保留所有可能。`;
  }
  if (/现在|怎么办|回去|行动/.test(message)) {
    return `回去以后不用复制我。只从你羡慕我的部分拿走一个最小动作：${state.action || "做一件今天就能开始的小事"}。`;
  }
  return `换了城市和生活之后，有件事仍然反复出现：${state.truth || state.centralTension || "我还是想确认自己的选择属于自己"}。也许你想念的不是我的人生，而是那个敢于选择的你。`;
}

export default function WorldPage() {
  const [world, setWorld] = useState<WorldState>({});
  const [entered, setEntered] = useState(false);
  const [sceneIndex, setSceneIndex] = useState(0);
  const [choiceRecords, setChoiceRecords] = useState<ChoiceRecord[]>([]);
  const [showConsequence, setShowConsequence] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const events = useMemo(() => {
    const supplied = Array.isArray(world.events) ? world.events : [];
    return (supplied.length >= 3 ? supplied : fallbackEvents).slice(0, 3);
  }, [world]);

  const scenes = useMemo(() => {
    const supplied = Array.isArray(world.scenes) ? world.scenes : [];
    return supplied.length >= 3 ? supplied.slice(0, 3) : fallbackScenes(events);
  }, [events, world.scenes]);

  const currentScene = scenes[sceneIndex] ?? scenes[0];
  const currentChoice = choiceRecords.find((record) => record.sceneId === currentScene.id);
  const parallelName = world.profile?.name ? `五年后的${world.profile.name}` : "沿另一条路生活的你";
  const progress = choiceRecords.length;

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("echo.worldState");
      if (stored) setWorld(JSON.parse(stored));
    } catch {
      // A complete preset world is always available.
    }
  }, []);

  function choose(choice: WorldChoice) {
    if (currentChoice) return;
    const inherited = sceneIndex > 0 ? choiceRecords[sceneIndex - 1]?.consequence : "";
    const consequence =
      sceneIndex === 1 && inherited
        ? `${choice.reveals} 而你第一晚的选择也还在继续：${inherited}`
        : choice.reveals;
    const record = {
      sceneId: currentScene.id,
      choiceId: choice.id,
      label: choice.label,
      consequence,
    };
    const next = [...choiceRecords, record];
    setChoiceRecords(next);
    setShowConsequence(true);
    try {
      window.localStorage.setItem("echo.choiceRecords", JSON.stringify(next));
    } catch {
      // The experience remains playable without persistence.
    }
  }

  function nextScene() {
    setShowConsequence(false);
    if (sceneIndex < scenes.length - 1) {
      setSceneIndex((index) => index + 1);
      return;
    }
    meetParallelSelf();
  }

  function meetParallelSelf() {
    const firstQuestion = world.answers?.[4];
    setMessages([
      {
        role: "echo",
        text: firstQuestion
          ? `你终于来了。我知道你想问：“${firstQuestion}” 现在，你可以亲口问我。`
          : "你终于来了。你看到的这五年，和你想象的一样吗？",
      },
    ]);
    setChatOpen(true);
  }

  function returnToNow() {
    window.location.href = new URL("../?returned=1", window.location.href).toString();
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
        headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
        body: JSON.stringify({
          message,
          worldContext: {
            sceneDescription: `用户打开的岔路是：${world.seed || "另一条没有走过的人生"}。三幕中用户做出的选择：${choiceRecords.map((item) => `${item.label} → ${item.consequence}`).join("；")}`,
            nearbyObject: `始终没变的是：${world.truth || world.centralTension || "选择之后仍然反复出现的渴望"}`,
            collectedItems: events.map((item) => item.title),
          },
        }),
      });
      if (!response.ok) throw new Error("model unavailable");
      const body = await response.text();
      const delta = body.split("\n").find((line) => line.startsWith("data:") && line.includes('"text"'));
      const reply = delta ? (JSON.parse(delta.slice(5).trim()) as { text?: string }).text : "";
      setMessages((current) => [
        ...current,
        { role: "echo", text: reply || localReply(message, world, choiceRecords) },
      ]);
    } catch {
      await new Promise((resolve) => window.setTimeout(resolve, 520));
      setMessages((current) => [
        ...current,
        { role: "echo", text: localReply(message, world, choiceRecords) },
      ]);
    } finally {
      setSending(false);
    }
  }

  return (
    <main className={`life-world ${entered ? "is-entered" : ""}`}>
      <div
        className="life-backdrop"
        aria-hidden="true"
        style={{
          backgroundImage: `linear-gradient(90deg, rgba(4, 9, 7, .72), rgba(4, 9, 7, .12) 58%, rgba(4, 9, 7, .38)), url("${
            import.meta.env.BASE_URL === "./" ? "../echo-memory-room-v1.png" : "/echo-memory-room-v1.png"
          }")`,
        }}
      />
      <div className="life-vignette" aria-hidden="true" />

      {!entered && (
        <section className="life-intro">
          <p>ECHO / WORLD 01 · CAUSAL STATE READY</p>
          <h1>这不是一段关于未来的文字。</h1>
          <span>你会在这里做三次选择，而世界会记住它们。</span>
          <blockquote>{world.seed || "另一条没有走过的人生"}</blockquote>
          <button type="button" onClick={() => setEntered(true)}>
            开始生活这五年 <b>→</b>
          </button>
          <small>这是一种受真实事实约束的可能人生，不是预测。</small>
        </section>
      )}

      {entered && !chatOpen && (
        <>
          <header className="life-hud">
            <div>
              <small>ECHO / LIFE SIMULATION</small>
              <strong>{currentScene.time}</strong>
            </div>
            <div className="life-progress">
              {scenes.map((scene, index) => (
                <i key={scene.id} className={index <= sceneIndex ? "is-active" : ""} />
              ))}
            </div>
            <button type="button" onClick={returnToNow}>退出这条时间线 ↗</button>
          </header>

          <section className="life-chapter">
            <p className="chapter-place">{currentScene.place}</p>
            <h1>{currentScene.title}</h1>
            <p className="chapter-atmosphere">{currentScene.atmosphere}</p>
            {sceneIndex > 0 && choiceRecords[sceneIndex - 1] && (
              <aside className="inherited-state">
                <small>上一幕仍在发生</small>
                <p>{choiceRecords[sceneIndex - 1].consequence}</p>
              </aside>
            )}
            <div className="chapter-situation">
              <span>{String(sceneIndex + 1).padStart(2, "0")}</span>
              <p>{currentScene.situation}</p>
            </div>

            {!currentChoice ? (
              <div className="chapter-choice">
                <small>{currentScene.choicePrompt}</small>
                <div>
                  {currentScene.choices.map((choice) => (
                    <button key={choice.id} type="button" onClick={() => choose(choice)}>
                      <span>{choice.label}</span>
                      <b>→</b>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className={`choice-consequence ${showConsequence ? "is-visible" : ""}`}>
                <small>世界记住了你的选择</small>
                <h2>{currentChoice.label}</h2>
                <p>{currentChoice.consequence}</p>
                <div className="chapter-evidence">
                  <span>{evidenceMeta[currentScene.evidence.polarity].symbol}</span>
                  <div>
                    <small>{evidenceMeta[currentScene.evidence.polarity].label}</small>
                    <strong>{currentScene.evidence.title}</strong>
                    <p>{currentScene.evidence.detail}</p>
                  </div>
                </div>
                <button type="button" onClick={nextScene}>
                  {sceneIndex < scenes.length - 1 ? "让时间继续向前" : "去见五年后的自己"} <span>→</span>
                </button>
              </div>
            )}
          </section>

          <aside className="world-state-rail">
            <small>WORLD STATE</small>
            <strong>{progress} / 3</strong>
            {choiceRecords.map((record, index) => (
              <div key={record.sceneId}>
                <span>0{index + 1}</span>
                <p>{record.label}</p>
              </div>
            ))}
          </aside>
        </>
      )}

      {chatOpen && (
        <section className="parallel-chat" role="dialog" aria-label={parallelName}>
          <header>
            <div>
              <small>PARALLEL SELF / T+5Y</small>
              <h2>{parallelName}</h2>
            </div>
            <button type="button" onClick={() => setChatOpen(false)}>×</button>
          </header>
          <div className="parallel-messages">
            <div className="life-receipt">
              <small>她记得你怎样生活过这三幕</small>
              {choiceRecords.map((record) => <p key={record.sceneId}>— {record.label}</p>)}
            </div>
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
              placeholder="问她：你后悔吗？你失去了什么？"
              onChange={(event) => setDraft(event.target.value)}
            />
            <button type="submit" disabled={!draft.trim() || sending}>发送 →</button>
          </form>
          <button className="bring-back" type="button" onClick={returnToNow}>
            结束对话，带一个现实行动回去
          </button>
        </section>
      )}
    </main>
  );
}
