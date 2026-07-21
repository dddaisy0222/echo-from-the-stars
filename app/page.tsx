"use client";

import { FormEvent, useMemo, useState } from "react";

type Stage = "intro" | "origin" | "map" | "encounter" | "dialog" | "letter";
type Message = { from: "echo" | "you"; text: string };

const selves = [
  {
    id: "future",
    label: "远星",
    title: "2038 · 终于自由的你",
    note: "在你还没有抵达的清晨，替你守着答案。",
    className: "future",
    position: "north",
  },
  {
    id: "past",
    label: "暗星",
    title: "2012 · 还没学会逞强的你",
    note: "她记得你遗忘的愿望，也记得那条回家的路。",
    className: "past",
    position: "south",
  },
  {
    id: "artist",
    label: "岔星",
    title: "未选择 · 海边的插画师",
    note: "在另一条路上，你把没有说出口的话画成了潮汐。",
    className: "artist",
    position: "west",
  },
  {
    id: "parallel",
    label: "异星",
    title: "平行时空 · 记忆修复师",
    note: "她在霓虹雨里，为陌生人修复褪色的往事。",
    className: "parallel",
    position: "east",
  },
] as const;

const openingMessage =
  "……是你？我等了很久。这里的时间和你那边不太一样，但我一直能听见你犹豫时的声音。";

export default function Home() {
  const [stage, setStage] = useState<Stage>("intro");
  const [name, setName] = useState("袁欣");
  const [selectedId, setSelectedId] = useState("future");
  const [messages, setMessages] = useState<Message[]>([
    { from: "echo", text: openingMessage },
  ]);
  const [draft, setDraft] = useState("");
  const [isReplying, setIsReplying] = useState(false);

  const selected = useMemo(
    () => selves.find((item) => item.id === selectedId) ?? selves[0],
    [selectedId],
  );

  function beginWithDemo() {
    setName("袁欣");
    setStage("map");
  }

  function submitOrigin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStage("map");
  }

  function chooseSelf(id: string) {
    setSelectedId(id);
    setMessages([{ from: "echo", text: openingMessage }]);
    setStage("encounter");
  }

  function sendMessage(text?: string) {
    const content = (text ?? draft).trim();
    if (!content || isReplying) return;
    setDraft("");
    setMessages((current) => [...current, { from: "you", text: content }]);
    setIsReplying(true);
    window.setTimeout(() => {
      const reply = content.includes("后悔")
        ? "我没有替你消灭后悔。我只是终于明白，那些绕远的路也在把我们带到这里。你可以不原谅过去，但别再用它惩罚现在的你。"
        : content.includes("选择") || content.includes("怎么")
          ? "别急着找到最正确的那条路。去选择那件即使无人鼓掌，你仍愿意认真做十年的事。未来不是答案，是你今天反复练习的方向。"
          : "我听见了。你以为自己是在向未来提问，其实你已经把答案藏进了问题里。明天先做一件很小、但更像你的事，好吗？";
      setMessages((current) => [...current, { from: "echo", text: reply }]);
      setIsReplying(false);
    }, 850);
  }

  return (
    <main className={`cosmos stage-${stage}`}>
      <div className="noise" aria-hidden="true" />
      <div className="starfield starfield-a" aria-hidden="true" />
      <div className="starfield starfield-b" aria-hidden="true" />

      <header className="topbar">
        <button className="brand" onClick={() => setStage("intro")} aria-label="返回 Echo 首页">
          <span className="brand-orbit" aria-hidden="true" />
          <span>ECHO</span>
        </button>
        <div className="status">
          <span className="status-dot" />
          {stage === "intro" ? "等待意识信号" : "航行通道已建立"}
        </div>
        <button className="sound-toggle" aria-label="声音模式，当前为静音">
          声音 · 静音
        </button>
      </header>

      {stage === "intro" && (
        <section className="intro-screen" aria-labelledby="hero-title">
          <div className="intro-copy">
            <p className="eyebrow">来自星星的我 · A journey into possible selves</p>
            <h1 id="hero-title">
              未来不是远方，
              <br />
              是一颗正在等待你的星。
            </h1>
            <p className="lead">
              Echo 将散落的记忆、愿望与未选择的人生，编织成一座可穿梭的内在宇宙。
              在这里，你可以和过去和解，向未来发问，也可以遇见另一个可能的自己。
            </p>
            <div className="intro-actions">
              <button className="primary-button" onClick={() => setStage("origin")}>
                开始一次意识航行 <span>↗</span>
              </button>
              <button className="text-button" onClick={beginWithDemo}>
                用示例星核直接体验
              </button>
            </div>
          </div>

          <div className="hero-system" aria-hidden="true">
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />
            <div className="orbit orbit-three" />
            <div className="hero-core">
              <span>此刻的你</span>
            </div>
            <span className="satellite satellite-one" />
            <span className="satellite satellite-two" />
            <span className="satellite satellite-three" />
            <p className="coordinate coordinate-a">TIME / +12Y</p>
            <p className="coordinate coordinate-b">POSSIBILITY / 04</p>
          </div>

          <div className="intro-footer">
            <span>纵向 · 穿越时间</span>
            <span>横向 · 探索可能</span>
            <span>核心 · 重返自我</span>
          </div>
        </section>
      )}

      {stage === "origin" && (
        <section className="origin-screen" aria-labelledby="origin-title">
          <div className="section-index">01 / 创世基点</div>
          <div className="origin-heading">
            <p className="eyebrow">Every universe begins with a coordinate</p>
            <h2 id="origin-title">先让宇宙知道，此刻的你在哪里。</h2>
            <p>这些信息只用来生成本次体验中的星核，不会离开你的设备。</p>
          </div>
          <form className="origin-form" onSubmit={submitOrigin}>
            <label>
              <span>我该如何称呼你？</span>
              <input value={name} onChange={(event) => setName(event.target.value)} required />
            </label>
            <label>
              <span>你正站在人生的哪个坐标？</span>
              <select defaultValue="exploring">
                <option value="exploring">正在寻找下一条路</option>
                <option value="transition">经历一段重要转变</option>
                <option value="stuck">暂时停在原地</option>
                <option value="growing">正在靠近理想生活</option>
              </select>
            </label>
            <fieldset>
              <legend>如果此刻宇宙只剩下你，你会——</legend>
              <label className="choice-row">
                <input type="radio" name="instinct" defaultChecked />
                <span>循着微光，探索未知地形</span>
              </label>
              <label className="choice-row">
                <input type="radio" name="instinct" />
                <span>留在原地，先看一会儿星星</span>
              </label>
            </fieldset>
            <button className="primary-button" type="submit">
              生成我的星核 <span>↗</span>
            </button>
          </form>
          <div className="origin-visual" aria-hidden="true">
            <div className="forming-core" />
            <p>CORE ID<br />ECHO–0721</p>
          </div>
        </section>
      )}

      {stage === "map" && (
        <section className="map-screen" aria-labelledby="map-title">
          <div className="map-copy">
            <div className="section-index">02 / 全息驾驶舱</div>
            <p className="eyebrow">Welcome back, traveler ECHO–0721</p>
            <h2 id="map-title">{name || "旅人"}，你的星图正在回应。</h2>
            <p>靠近一颗星。它不会告诉你标准答案，只会把被时间折叠的声音还给你。</p>
          </div>

          <div className="axis-label axis-time">时间 TIME</div>
          <div className="axis-label axis-possibility">可能 POSSIBILITY</div>
          <div className="map-axis axis-vertical" aria-hidden="true" />
          <div className="map-axis axis-horizontal" aria-hidden="true" />

          <div className="map-core" aria-label="当前的你">
            <span className="map-core-pulse" />
            <strong>NOW</strong>
            <small>此刻的你</small>
          </div>

          {selves.map((item) => (
            <button
              key={item.id}
              className={`self-node node-${item.position} ${item.className}`}
              onClick={() => chooseSelf(item.id)}
              aria-label={`连接 ${item.title}`}
            >
              <span className="node-star" />
              <span className="node-info">
                <small>{item.label}</small>
                <strong>{item.title}</strong>
                <em>{item.note}</em>
              </span>
            </button>
          ))}

          <div className="map-legend">
            <span>拖动星图探索</span>
            <span>选择星体建立通讯</span>
          </div>
        </section>
      )}

      {stage === "encounter" && (
        <section className={`encounter-screen ${selected.className}`} aria-labelledby="encounter-title">
          <button className="back-button" onClick={() => setStage("map")}>← 返回星图</button>
          <div className="encounter-meta">
            <span>信号来源 / {selected.label}</span>
            <span>同步率 / 98.7%</span>
          </div>
          <div className="two-selves" aria-hidden="true">
            <div className="orb orb-you"><span>你</span></div>
            <div className="connection-line" />
            <div className="orb orb-echo"><span>TA</span></div>
          </div>
          <div className="encounter-copy">
            <p className="eyebrow">A signal from another you</p>
            <h2 id="encounter-title">{selected.title}</h2>
            <p>{selected.note}</p>
            <blockquote>“我一直在等你。要来看看吗？”</blockquote>
            <button className="primary-button" onClick={() => setStage("dialog")}>
              建立跨时空通讯 <span>↗</span>
            </button>
          </div>
        </section>
      )}

      {stage === "dialog" && (
        <section className={`dialog-screen ${selected.className}`} aria-labelledby="dialog-title">
          <aside className="dialog-aside">
            <button className="back-button" onClick={() => setStage("map")}>← 断开并返回星图</button>
            <div className="speaker-orb" aria-hidden="true" />
            <p className="eyebrow">正在与 {selected.label} 通讯</p>
            <h2 id="dialog-title">{selected.title}</h2>
            <p>{selected.note}</p>
            <div className="signal-card">
              <span>情绪频率</span><strong>平静 · 诚实</strong>
              <span>时空距离</span><strong>12 光年</strong>
            </div>
          </aside>

          <div className="conversation">
            <div className="message-list" aria-live="polite">
              {messages.map((message, index) => (
                <div className={`message ${message.from}`} key={`${message.from}-${index}`}>
                  <span>{message.from === "you" ? "此刻的你" : selected.label}</span>
                  <p>{message.text}</p>
                </div>
              ))}
              {isReplying && <div className="thinking">星尘正在重新聚合……</div>}
            </div>

            <div className="prompt-chips">
              <button onClick={() => sendMessage("如果你能回来一天，你会提醒我做什么选择？")}>我该怎么选择？</button>
              <button onClick={() => sendMessage("你还会为我们曾经的决定后悔吗？")}>你还会后悔吗？</button>
              <button onClick={() => sendMessage("你现在过着怎样的一天？")}>告诉我你的生活</button>
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
                placeholder="向另一个自己说点什么……"
                aria-label="发送给另一个自己的消息"
              />
              <button type="submit" disabled={!draft.trim() || isReplying}>发送 ↗</button>
            </form>
            <button className="letter-link" onClick={() => setStage("letter")}>结束通讯，并保存这次回声</button>
          </div>
        </section>
      )}

      {stage === "letter" && (
        <section className="letter-screen" aria-labelledby="letter-title">
          <div className="letter-star" aria-hidden="true" />
          <p className="eyebrow">Quantum entanglement remains</p>
          <h2 id="letter-title">通讯结束，但回声没有消失。</h2>
          <p className="letter-lead">你收到一封来自 {selected.title} 的星际信笺。</p>
          <article className="cosmic-letter">
            <div className="letter-header">
              <span>TO / {name || "此刻的你"}</span>
              <span>FROM / {selected.label}</span>
            </div>
            <p>
              亲爱的我：<br /><br />
              谢谢你穿过这么远的时间来见我。请记住，我们不是被某一次选择定义的人，而是那个每次迷路之后，仍愿意重新出发的人。
              明天醒来，替我认真看看清晨的光吧。那是我从未来寄给你的坐标。
            </p>
            <div className="letter-sign">来自星星的你 · 2038</div>
          </article>
          <div className="letter-actions">
            <button className="primary-button" onClick={() => setStage("map")}>继续探索星图 <span>↗</span></button>
            <button className="text-button" onClick={() => setStage("intro")}>结束本次航行</button>
          </div>
        </section>
      )}
    </main>
  );
}
