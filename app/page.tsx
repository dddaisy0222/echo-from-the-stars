"use client";

import { FormEvent, useMemo, useState } from "react";

type Stage =
  | "intro"
  | "seed"
  | "map"
  | "encounter"
  | "dialog"
  | "shard"
  | "ending";

type Message = {
  from: "echo" | "you";
  text: string;
};

type World = {
  id: string;
  code: string;
  label: string;
  year: string;
  title: string;
  shortTitle: string;
  note: string;
  scene: string;
  gained: string;
  cost: string;
  truth: string;
  shard: string;
  position: "north" | "south" | "west" | "east";
  tone: string;
};

const worlds: World[] = [
  {
    id: "leap",
    code: "WORLD–01",
    label: "跃迁线",
    year: "2031",
    title: "离开安全答案的你",
    shortTitle: "离开的你",
    note: "她没有变得更确定，只是终于允许自己边走边成为。",
    scene: "海边工作室 · 第 1,826 个清晨",
    gained: "自由、作品，以及一套自己选择的生活节奏",
    cost: "失去确定感，也失去一些曾经熟悉的认可",
    truth: "勇敢不是不害怕，是不再把害怕当作禁止通行。",
    shard: "不确定，不等于走错。",
    position: "north",
    tone: "violet",
  },
  {
    id: "stay",
    code: "WORLD–02",
    label: "定居线",
    year: "2031",
    title: "留在原定轨道的你",
    shortTitle: "留下的你",
    note: "她把一条路走得很深，也仍会在某些夜里想起另一扇门。",
    scene: "城市顶楼 · 一场发布会之后",
    gained: "稳定、熟练，以及被许多人信任的位置",
    cost: "需要反复确认，安稳究竟是选择还是惯性",
    truth: "留下也可以是一种选择，前提是每天仍愿意重新选择它。",
    shard: "稳定，不必以背叛渴望为代价。",
    position: "south",
    tone: "silver",
  },
  {
    id: "wild",
    code: "WORLD–03",
    label: "无名线",
    year: "2029",
    title: "拒绝被一种身份定义的你",
    shortTitle: "无名的你",
    note: "她不再回答自己是谁，只认真回答今天想创造什么。",
    scene: "流动实验室 · 没有职位的一天",
    gained: "跨越边界的创造力，以及随时重写自己的权利",
    cost: "很难用一句话解释自己，也很少得到标准答案",
    truth: "To define is to limit. 但不被定义，也需要承担迷路。",
    shard: "你可以拥有方向，而不必成为一个固定答案。",
    position: "west",
    tone: "amber",
  },
  {
    id: "tender",
    code: "WORLD–04",
    label: "共生线",
    year: "2034",
    title: "让技术学会陪伴的你",
    shortTitle: "共生的你",
    note: "她没有造出更像人的 AI，而是让人更清楚地听见自己。",
    scene: "深夜研究站 · 第 10,004 次对话",
    gained: "一项真正属于自己的研究，与被理解的少数人",
    cost: "长期面对边界、依赖，以及无法替别人生活的无力",
    truth: "好的陪伴不会替你给出答案，只会把决定权慢慢还给你。",
    shard: "陪伴的终点，是重新回到自己的生活。",
    position: "east",
    tone: "cyan",
  },
];

const replyBank: Record<string, Record<string, string>> = {
  leap: {
    choice:
      "我当然后悔过。后悔不是走错路的证据，它只是选择产生的影子。真正改变我的，是发现没有一条人生能够同时保留所有可能。",
    day:
      "我早上替一位陌生人修改体验，下午沿海走了很久。收入还会波动，但日历上那些空白第一次真的属于我。",
    cost:
      "我失去过一些人的理解，也失去过“只要照做就不会错”的安全感。可那之后，我终于不再把自己交给标准答案保管。",
    default:
      "你以为我比你勇敢，其实我只是比你早几年发现：确定感从来不是出发的前提。",
  },
  stay: {
    choice:
      "别把我想象成一个失败的版本。我拥有过真实的满足，也建立了很深的关系。只是我后来学会每天问自己：今天留下，是选择，还是害怕变化？",
    day:
      "我处理了很多复杂的事，别人依赖我的判断。晚上回家时很累，但桌上那盏灯和熟悉的人也都是真的。",
    cost:
      "代价不是留下本身，而是有几年我停止了追问。我把熟练误认为热爱，把被需要误认为被看见。",
    default:
      "如果你选择留下，请主动选择它。不要让惯性替你签下未来十年的名字。",
  },
  wild: {
    choice:
      "我不再寻找唯一正确的身份。我用项目而不是头衔来理解自己：今天做研究，明天写故事，后天把两者放进同一个产品。",
    day:
      "今天没人问我的职位。我们只围着一个问题工作：怎样让技术不替人活，却让人更愿意活进自己的生活。",
    cost:
      "解释自己很累。很多机会只想要一个清晰标签，而我必须接受有些门不会为复杂的人打开。",
    default:
      "你不是缺少定义。你只是还在练习，如何在没有定义保护的时候，也相信自己确实存在。",
  },
  tender: {
    choice:
      "我选择的不是“AI 情感陪伴”这几个字，而是一个更难的问题：技术怎样在靠近人的时候，仍尊重人的边界。",
    day:
      "今天我们关掉了一个留存率很高的功能。它让用户更依赖，却没有让他们更自由。那是一次很昂贵、但很像我们的决定。",
    cost:
      "你会不断遇到无法被产品解决的痛苦。承认边界并不会让你显得无能，反而是这条路最重要的能力。",
    default:
      "别急着证明 AI 能理解一切。先做一个能在不知道时诚实停下来的产品。",
  },
};

const openingBank: Record<string, string> = {
  leap:
    "你终于来了。我知道你最想问什么：那一步之后，我有没有后悔。答案没有你想的那么整齐。",
  stay:
    "别用同情的眼神看我。我不是那个“没有勇气”的版本。留下，也让我看见了你从远处看不到的风景。",
  wild:
    "这里没人问我到底是做市场、AI，还是艺术。我猜你来，是因为你已经厌倦只准自己成为一种人。",
  tender:
    "我记得你第一次说，想做一种能让人被自己看见的 AI。后来我们花了很多年，学习什么时候应该靠近，什么时候应该沉默。",
};

const approaches = [
  { id: "gain", label: "问她得到了什么", symbol: "＋" },
  { id: "cost", label: "问她付出了什么", symbol: "−" },
  { id: "listen", label: "先听她讲完", symbol: "◌" },
];

export default function Home() {
  const [stage, setStage] = useState<Stage>("intro");
  const [name, setName] = useState("袁欣");
  const [question, setQuestion] = useState(
    "如果我选择一条没人能保证的路，我会后悔吗？",
  );
  const [instinct, setInstinct] = useState("possibility");
  const [selectedId, setSelectedId] = useState("leap");
  const [approach, setApproach] = useState("listen");
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [isReplying, setIsReplying] = useState(false);
  const [collected, setCollected] = useState<string[]>([]);
  const [resonance, setResonance] = useState(18);

  const selected = useMemo(
    () => worlds.find((world) => world.id === selectedId) ?? worlds[0],
    [selectedId],
  );

  const progress = useMemo(() => {
    if (stage === "intro") return 0;
    if (stage === "seed") return 1;
    if (stage === "map") return 2;
    if (stage === "encounter") return 3;
    if (stage === "dialog") return 4;
    if (stage === "shard") return 5;
    return 6;
  }, [stage]);

  function resetJourney() {
    setStage("intro");
    setCollected([]);
    setResonance(18);
    setMessages([]);
  }

  function beginDemo() {
    setName("袁欣");
    setQuestion("如果我选择一条没人能保证的路，我会后悔吗？");
    setInstinct("possibility");
    setStage("map");
  }

  function submitSeed(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStage("map");
  }

  function enterWorld(id: string) {
    setSelectedId(id);
    setApproach("listen");
    setMessages([]);
    setStage("encounter");
  }

  function establishContact() {
    const approachLead =
      approach === "cost"
        ? "你第一眼就看见了我付出的代价。很好，至少你不是来这里偷一个轻松答案的。"
        : approach === "gain"
          ? "你想知道我得到了什么。可以，但别忘了，每一种得到都会改变你和旧世界的关系。"
          : openingBank[selected.id];
    setMessages([{ from: "echo", text: approachLead }]);
    setStage("dialog");
  }

  function getReply(content: string) {
    const bank = replyBank[selected.id];
    if (
      content.includes("选择") ||
      content.includes("后悔") ||
      content.includes("值得")
    ) {
      return bank.choice;
    }
    if (
      content.includes("一天") ||
      content.includes("生活") ||
      content.includes("现在")
    ) {
      return bank.day;
    }
    if (
      content.includes("代价") ||
      content.includes("失去") ||
      content.includes("害怕")
    ) {
      return bank.cost;
    }
    return bank.default;
  }

  function sendMessage(text?: string) {
    const content = (text ?? draft).trim();
    if (!content || isReplying) return;
    setDraft("");
    setMessages((current) => [...current, { from: "you", text: content }]);
    setIsReplying(true);
    window.setTimeout(() => {
      setMessages((current) => [
        ...current,
        { from: "echo", text: getReply(content) },
      ]);
      setResonance((current) => Math.min(99, current + 9));
      setIsReplying(false);
    }, 760);
  }

  function collectShard() {
    setCollected((current) =>
      current.includes(selected.id) ? current : [...current, selected.id],
    );
    setResonance((current) => Math.min(99, current + 17));
    setStage("shard");
  }

  return (
    <main className={`cosmos stage-${stage} tone-${selected.tone}`}>
      <div className="grain" aria-hidden="true" />
      <div className="starfield starfield-a" aria-hidden="true" />
      <div className="starfield starfield-b" aria-hidden="true" />
      <div className="aurora" aria-hidden="true" />

      <header className="topbar">
        <button className="brand" onClick={resetJourney} aria-label="返回 Echo 首页">
          <span className="brand-mark" aria-hidden="true">
            <i />
          </span>
          <span>
            ECHO
            <small>POSSIBLE WORLDS</small>
          </span>
        </button>

        {stage !== "intro" && (
          <div className="journey-progress" aria-label={`旅程进度 ${progress}/6`}>
            {[1, 2, 3, 4, 5, 6].map((step) => (
              <span className={progress >= step ? "active" : ""} key={step} />
            ))}
          </div>
        )}

        <div className="hud">
          <span>回声碎片 {collected.length}/4</span>
          <span>共振 {resonance}%</span>
        </div>
      </header>

      {stage === "intro" && (
        <section className="intro-screen" aria-labelledby="hero-title">
          <div className="intro-copy">
            <p className="eyebrow">一场关于选择的平行世界游戏</p>
            <h1 id="hero-title">
              如果人生有另一条路，
              <br />
              那里的你，过得好吗？
            </h1>
            <p className="lead">
              写下一个此刻困住你的问题。穿过四条世界线，遇见做出不同选择的自己。
              她们不会替你决定，只会把每种人生的得到与代价还给你。
            </p>
            <div className="intro-actions">
              <button className="primary-button" onClick={() => setStage("seed")}>
                建立我的世界原点 <span>↗</span>
              </button>
              <button className="ghost-button" onClick={beginDemo}>
                直接进入示例宇宙
              </button>
            </div>
            <div className="game-loop">
              <span>01 写下问题</span>
              <b>→</b>
              <span>02 穿越世界线</span>
              <b>→</b>
              <span>03 带回碎片</span>
            </div>
          </div>

          <div className="hero-system" aria-label="四条可能世界围绕此刻的你">
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />
            <div className="orbit orbit-three" />
            <div className="hero-core">
              <span>NOW</span>
              <small>此刻的你</small>
            </div>
            {worlds.map((world, index) => (
              <span
                className={`satellite satellite-${index + 1}`}
                key={world.id}
                title={world.shortTitle}
              >
                <i />
              </span>
            ))}
            <p className="coordinate coordinate-a">TIME / +08Y</p>
            <p className="coordinate coordinate-b">POSSIBILITY / 04</p>
            <p className="coordinate coordinate-c">ORIGIN / YOU</p>
          </div>

          <div className="intro-footer">
            <span>体验时长 / 3–5 MIN</span>
            <span>世界数量 / 04</span>
            <span>没有标准结局</span>
          </div>
        </section>
      )}

      {stage === "seed" && (
        <section className="seed-screen" aria-labelledby="seed-title">
          <div className="section-index">01 / 世界原点</div>
          <div className="seed-heading">
            <p className="eyebrow">Every world begins with a question</p>
            <h2 id="seed-title">先告诉宇宙，<br />此刻什么困住了你。</h2>
            <p>
              Echo 不预测未来。你的问题只是一枚种子，用来生成不同人生的观察坐标。
            </p>
          </div>

          <form className="seed-form" onSubmit={submitSeed}>
            <label className="field">
              <span>旅人姓名</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
              />
            </label>
            <label className="field">
              <span>你最想问另一个自己什么？</span>
              <textarea
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                maxLength={100}
                required
              />
              <small>{question.length}/100</small>
            </label>
            <fieldset className="instinct-field">
              <legend>此刻，你最不想失去的是——</legend>
              {[
                ["security", "确定", "被接住的安全感"],
                ["possibility", "可能", "仍能重新选择的权利"],
                ["recognition", "认可", "被重要的人真正看见"],
              ].map(([value, title, copy]) => (
                <label
                  className={instinct === value ? "selected" : ""}
                  key={value}
                >
                  <input
                    type="radio"
                    name="instinct"
                    value={value}
                    checked={instinct === value}
                    onChange={() => setInstinct(value)}
                  />
                  <strong>{title}</strong>
                  <span>{copy}</span>
                </label>
              ))}
            </fieldset>
            <button className="primary-button" type="submit">
              生成四条世界线 <span>↗</span>
            </button>
          </form>

          <div className="seed-orb" aria-hidden="true">
            <span />
            <i />
            <p>WORLD SEED<br />ECHO–0725</p>
          </div>
        </section>
      )}

      {stage === "map" && (
        <section className="map-screen" aria-labelledby="map-title">
          <div className="map-copy">
            <div className="section-index">02 / 世界线地图</div>
            <p className="eyebrow">Question synchronized</p>
            <h2 id="map-title">{name || "旅人"}，四个你已经醒来。</h2>
            <p className="current-question">“{question}”</p>
            <p>选择一颗星。进入她的日常，而不只是听一个答案。</p>
          </div>

          <div className="map-axis axis-vertical" aria-hidden="true" />
          <div className="map-axis axis-horizontal" aria-hidden="true" />
          <span className="axis-label axis-time">时间 TIME</span>
          <span className="axis-label axis-possibility">可能 POSSIBILITY</span>

          <button
            className="map-core"
            onClick={() => collected.length > 0 && setStage("ending")}
            aria-label={
              collected.length > 0 ? "带着回声返回此刻" : "此刻的你，需要先取得一枚回声"
            }
          >
            <span className="map-core-pulse" />
            <strong>NOW</strong>
            <small>{collected.length > 0 ? "返回自己" : "此刻的你"}</small>
          </button>

          {worlds.map((world) => {
            const done = collected.includes(world.id);
            return (
              <button
                key={world.id}
                className={`world-node node-${world.position} ${world.tone} ${done ? "completed" : ""}`}
                onClick={() => enterWorld(world.id)}
                aria-label={`进入 ${world.title}`}
              >
                <span className="node-star">
                  {done && <i>✓</i>}
                </span>
                <span className="node-info">
                  <small>{world.code} · {done ? "回声已取得" : "可进入"}</small>
                  <strong>{world.year} · {world.shortTitle}</strong>
                  <em>{world.note}</em>
                </span>
              </button>
            );
          })}

          <div className="map-objective">
            <span>当前目标</span>
            <strong>
              {collected.length === 0
                ? "进入任意世界，带回第一枚回声"
                : collected.length < 4
                  ? "继续探索，或点击 NOW 返回自己"
                  : "所有世界线已完成"}
            </strong>
          </div>
        </section>
      )}

      {stage === "encounter" && (
        <section
          className={`encounter-screen ${selected.tone}`}
          aria-labelledby="encounter-title"
        >
          <button className="back-button" onClick={() => setStage("map")}>
            ← 返回世界线地图
          </button>
          <div className="encounter-meta">
            <span>{selected.code}</span>
            <span>同步率 / 98.7%</span>
          </div>

          <div className="world-window" aria-hidden="true">
            <div className="world-sun" />
            <div className="world-horizon" />
            <div className="world-figure">
              <span />
            </div>
            <p>{selected.scene}</p>
          </div>

          <div className="encounter-copy">
            <p className="eyebrow">{selected.label} · {selected.year}</p>
            <h2 id="encounter-title">{selected.title}</h2>
            <p className="encounter-note">{selected.note}</p>

            <div className="world-balance">
              <div>
                <span>她得到了</span>
                <p>{selected.gained}</p>
              </div>
              <div>
                <span>她付出了</span>
                <p>{selected.cost}</p>
              </div>
            </div>

            <div className="approach-title">你想怎样靠近她？</div>
            <div className="approach-grid">
              {approaches.map((item) => (
                <button
                  className={approach === item.id ? "selected" : ""}
                  key={item.id}
                  onClick={() => setApproach(item.id)}
                >
                  <i>{item.symbol}</i>
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
            <button className="primary-button" onClick={establishContact}>
              进入这个世界 <span>↗</span>
            </button>
          </div>
        </section>
      )}

      {stage === "dialog" && (
        <section
          className={`dialog-screen ${selected.tone}`}
          aria-labelledby="dialog-title"
        >
          <aside className="dialog-aside">
            <button className="back-button" onClick={() => setStage("map")}>
              ← 中断通讯
            </button>
            <div className="speaker-orb" aria-hidden="true">
              <span />
            </div>
            <p className="eyebrow">{selected.code} / LIVE</p>
            <h2 id="dialog-title">{selected.shortTitle}</h2>
            <p>{selected.scene}</p>
            <div className="signal-card">
              <span>共振</span><strong>{resonance}%</strong>
              <span>世界状态</span><strong>稳定</strong>
              <span>已取得碎片</span><strong>{collected.length}/4</strong>
            </div>
          </aside>

          <div className="conversation">
            <div className="dialog-question">
              <span>你的原始问题</span>
              <p>“{question}”</p>
            </div>
            <div className="message-list" aria-live="polite">
              {messages.map((message, index) => (
                <div className={`message ${message.from}`} key={`${message.from}-${index}`}>
                  <span>{message.from === "you" ? "此刻的你" : selected.label}</span>
                  <p>{message.text}</p>
                </div>
              ))}
              {isReplying && <div className="thinking">世界线正在重新聚合……</div>}
            </div>

            <div className="prompt-chips">
              <button onClick={() => sendMessage("这个选择，值得你付出的代价吗？")}>
                值得吗？
              </button>
              <button onClick={() => sendMessage("你现在过着怎样的一天？")}>
                你的一天
              </button>
              <button onClick={() => sendMessage("你为此失去了什么？")}>
                你失去了什么？
              </button>
            </div>
            <form
              className="message-form"
              onSubmit={(event) => {
                event.preventDefault();
                sendMessage();
              }}
            >
              <input
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="向这个世界的自己发问……"
                aria-label="向平行世界的自己发送消息"
              />
              <button type="submit" disabled={!draft.trim() || isReplying}>
                发送 ↗
              </button>
            </form>
            <button className="extract-button" onClick={collectShard}>
              <span>◇</span>
              {collected.includes(selected.id) ? "重新读取这枚回声" : "结束通讯，取回回声碎片"}
            </button>
          </div>
        </section>
      )}

      {stage === "shard" && (
        <section className={`shard-screen ${selected.tone}`} aria-labelledby="shard-title">
          <div className="section-index">05 / 回声提取完成</div>
          <div className="shard-visual" aria-hidden="true">
            <div className="shard-halo" />
            <div className="shard-gem">◇</div>
          </div>
          <p className="eyebrow">{selected.code} · MEMORY ACQUIRED</p>
          <h2 id="shard-title">你从这个世界，带回了一句话。</h2>
          <blockquote>“{selected.shard}”</blockquote>
          <p className="shard-truth">{selected.truth}</p>
          <div className="shard-stats">
            <span>回声碎片 <strong>{Math.max(collected.length, 1)}/4</strong></span>
            <span>共振度 <strong>{resonance}%</strong></span>
          </div>
          <div className="shard-actions">
            <button className="primary-button" onClick={() => setStage("map")}>
              继续探索世界线 <span>↗</span>
            </button>
            <button className="ghost-button" onClick={() => setStage("ending")}>
              带着碎片返回自己
            </button>
          </div>
        </section>
      )}

      {stage === "ending" && (
        <section className="ending-screen" aria-labelledby="ending-title">
          <button className="back-button" onClick={() => setStage("map")}>
            ← 继续探索
          </button>
          <div className="ending-copy">
            <p className="eyebrow">THE ONLY WORLD YOU CAN LIVE</p>
            <h2 id="ending-title">
              欢迎回来，
              <br />
              此刻的你。
            </h2>
            <p>
              你没有找到一条没有代价的人生。你找到的是：
              每个世界都保留了你的一部分，但只有这里仍然可以被你改变。
            </p>
          </div>

          <div className="compass">
            <div className="compass-orbit" />
            <div className="compass-core">
              <span>NOW</span>
              <small>{name || "你"}</small>
            </div>
            {collected.map((id, index) => {
              const world = worlds.find((item) => item.id === id);
              return (
                <span className={`compass-shard shard-${index + 1}`} key={id}>
                  {world?.shard}
                </span>
              );
            })}
          </div>

          <article className="return-card">
            <div className="return-card-head">
              <span>选择罗盘 / ECHO–0725</span>
              <span>{collected.length} 条世界线已观测</span>
            </div>
            <p className="return-question">你问：“{question}”</p>
            <div className="return-grid">
              <div>
                <span>你真正靠近的</span>
                <strong>
                  {instinct === "security"
                    ? "一种由自己建立的确定"
                    : instinct === "recognition"
                      ? "被看见，但不再由目光定义"
                      : "保留继续成为别人的可能"}
                </strong>
              </div>
              <div>
                <span>你可以先做的</span>
                <strong>把这个还不完整的想法，交给一个真实的人体验。</strong>
              </div>
            </div>
            <blockquote>
              “选择不是找到不会后悔的世界，而是决定愿意为哪个世界承担代价。”
            </blockquote>
          </article>

          <div className="ending-actions">
            <button className="primary-button" onClick={resetJourney}>
              开启新的宇宙 <span>↗</span>
            </button>
            <button className="ghost-button" onClick={() => setStage("map")}>
              回到世界线地图
            </button>
          </div>
          <p className="safety-note">
            Echo 是一场自我探索游戏，不预测未来，也不替你做出现实决定。
          </p>
        </section>
      )}
    </main>
  );
}
