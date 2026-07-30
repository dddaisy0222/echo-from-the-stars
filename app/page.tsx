"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

type Stage =
  | "arrival"
  | "profile"
  | "threshold"
  | "mode"
  | "interview"
  | "confirm"
  | "door"
  | "returned";

type Timeline = "past" | "future";
type JourneyMode = "rewrite" | "replay" | "decide";

type Profile = {
  name: string;
  birthday: string;
  identity: string;
  hometown: string;
  mbti: string;
};

type WorldEvent = {
  title: string;
  detail: string;
  polarity: "gain" | "cost" | "turn";
};

type WorldState = {
  seed: string;
  context: string;
  truth: string;
  action: string;
  timeline: Timeline;
  mode: JourneyMode;
  profile: Profile;
  answers: string[];
  events: WorldEvent[];
};

type Prompt = {
  kicker: string;
  question: string;
  helper: string;
  suggestions?: string[];
};

const emptyProfile: Profile = {
  name: "",
  birthday: "",
  identity: "",
  hometown: "",
  mbti: "",
};

const profilePrompts = [
  {
    key: "name" as const,
    label: "称呼",
    question: "怎么称呼你？",
    placeholder: "输入你的名字或昵称",
    type: "text",
  },
  {
    key: "birthday" as const,
    label: "出生日期",
    question: "你的出生日期是？",
    placeholder: "",
    type: "date",
  },
  {
    key: "identity" as const,
    label: "当前身份",
    question: "你现在最常用哪个身份介绍自己？",
    placeholder: "例如：产品经理、学生、正在创业的人",
    type: "text",
  },
  {
    key: "hometown" as const,
    label: "成长地点",
    question: "你主要在哪里长大？",
    placeholder: "一个城市或地方",
    type: "text",
  },
  {
    key: "mbti" as const,
    label: "MBTI · 可跳过",
    question: "如果你知道自己的 MBTI，可以告诉我。",
    placeholder: "例如：INFP",
    type: "text",
  },
];

const journeyPrompts: Record<JourneyMode, Prompt[]> = {
  rewrite: [
    {
      kicker: "时间坐标",
      question: "你想回到人生中的哪个选择？",
      helper: "不用讲完整故事，一个具体时刻就够。",
      suggestions: ["一次工作选择", "一段关系", "一座没去的城市"],
    },
    {
      kicker: "现实锚点",
      question: "那一次，你最后做了什么选择？",
      helper: "只写真实发生过的事。它会成为现在这条时间线的锚点。",
    },
    {
      kicker: "选择逻辑",
      question: "你当时为什么会这样选？",
      helper: "如果愿意，也可以说说那时怕什么、舍不得什么、期待什么。",
      suggestions: ["我更想要稳定", "我不想让人失望", "我当时还没准备好"],
    },
    {
      kicker: "唯一变量",
      question: "如果只改一件事，你希望当时的自己怎么选？",
      helper: "我们只改变一个变量，其他条件尽量保持真实。",
    },
    {
      kicker: "五年后的回声",
      question: "你最想问那个已经沿这条路生活了五年的自己什么？",
      helper: "这会成为你们见面时的第一句话。",
      suggestions: ["你后悔吗？", "你失去了什么？", "你现在快乐吗？"],
    },
  ],
  replay: [
    {
      kicker: "时间坐标",
      question: "你想重新回到哪段生活？",
      helper: "这一次不改写它，只是再认真活一遍。",
      suggestions: ["高中最后一个夏天", "一次很久以前的旅行", "和某个人的普通一天"],
    },
    {
      kicker: "场景锚点",
      question: "你最想回到其中哪个具体时刻？",
      helper: "一天中的时间、地点，或者一个很小的画面都可以。",
    },
    {
      kicker: "世界素材",
      question: "那个场景里，什么东西一出现，你就知道自己真的回去了？",
      helper: "可以是一种声音、气味、物件，或一个人。",
      suggestions: ["放学铃声", "老房间的台灯", "某个人叫我的方式"],
    },
    {
      kicker: "未完成情绪",
      question: "这一次，你最想重新感受什么？",
      helper: "不需要解释它为什么重要。",
    },
    {
      kicker: "留给当时的你",
      question: "如果能见到那时的自己，你想先说哪一句？",
      helper: "不用正确，只要像你真的会说的话。",
    },
  ],
  decide: [
    {
      kicker: "现在坐标",
      question: "你现在正卡在哪个选择上？",
      helper: "先说最让你反复想起的那一个。",
      suggestions: ["要不要换一份工作", "要不要离开一座城市", "要不要开始一件冒险的事"],
    },
    {
      kicker: "岔路",
      question: "摆在你面前的选项是什么？",
      helper: "可以写两个，也可以写更多。用“或”隔开就好。",
    },
    {
      kicker: "真正想要",
      question: "如果先不考虑别人怎么看，你最期待哪一种变化？",
      helper: "这不是让你立刻做决定，只是把渴望放回桌面。",
      suggestions: ["更多自由", "稳定和安全感", "做真正属于我的东西"],
    },
    {
      kicker: "不能忽略的代价",
      question: "你最怕因为这个选择失去什么？",
      helper: "真实的世界不会只生成得到，也会保留代价。",
      suggestions: ["收入和确定感", "重要的关系", "已经积累的一切"],
    },
    {
      kicker: "五年后的回声",
      question: "你最想问已经做出这个选择、生活了五年的自己什么？",
      helper: "这会成为你们见面时的第一句话。",
      suggestions: ["值得吗？", "你变成想成为的人了吗？", "你想提醒我什么？"],
    },
  ],
};

const modeCopy: Record<JourneyMode, { title: string; description: string }> = {
  rewrite: {
    title: "改写一条岔路",
    description: "改变一个真实选择，看它如何继续生活下去。",
  },
  replay: {
    title: "重返一段时间",
    description: "不改变任何事，只让那段人生重新变得可触碰。",
  },
  decide: {
    title: "预演一个未来",
    description: "让几种选择先生活一段时间，再回来决定。",
  },
};

function buildWorldState(
  profile: Profile,
  timeline: Timeline,
  mode: JourneyMode,
  answers: string[],
): WorldState {
  const seed =
    mode === "replay"
      ? `重新回到：${answers[0] || "一段很想念的生活"}`
      : mode === "rewrite"
        ? `如果那一次，我选择了：${answers[3] || "另一条路"}`
        : `如果现在，我选择：${answers[1] || "其中一条路"}`;

  const expectation =
    mode === "decide" ? answers[2] : mode === "replay" ? answers[3] : answers[3];
  const cost =
    mode === "decide"
      ? answers[3]
      : mode === "rewrite"
        ? answers[2]
        : "那段时间终究会继续向前";

  const events: WorldEvent[] =
    mode === "replay"
      ? [
          {
            title: answers[2] || "熟悉的声音先回来了",
            detail: `你回到「${answers[1] || answers[0]}」。世界没有要求你修正过去，只让那些曾被时间压扁的细节重新出现。`,
            polarity: "gain",
          },
          {
            title: "你知道这一刻仍然会结束",
            detail: "能够重返，不等于能够留下。正因为知道它会结束，你终于没有把这一天活成背景。",
            polarity: "cost",
          },
          {
            title: "记忆没有要求你住在过去",
            detail: `你真正想带回的不是旧日完整复刻，而是「${expectation || "一种很久没有认真感受过的东西"}」。`,
            polarity: "turn",
          },
        ]
      : [
          {
            title: `你真的走进了「${mode === "decide" ? answers[1] : answers[3]}」`,
            detail: `最初的改变很具体：${expectation || "生活第一次出现了不同的节奏"}。这不是奖励，只是那条路真实给你的东西。`,
            polarity: "gain",
          },
          {
            title: "第 312 天，一个普通的晚上",
            detail: `新的生活也开始索取代价：${cost || "一些熟悉的确定感没有跟来"}。平行世界不是更好的人生，只是一组不同的交换。`,
            polarity: "cost",
          },
          {
            title: "五年后，同一个问题换了一种问法",
            detail: `外部条件改变了，但你仍在意当初为什么出发。你想问她：「${answers[4] || "你现在过得好吗？"}」`,
            polarity: "turn",
          },
        ];

  return {
    seed,
    context:
      mode === "replay"
        ? `${profile.name || "你"}想重新触碰一段已经过去、却仍然重要的生活。`
        : `${profile.name || "你"}不是在寻找无代价的正确答案，而是想看见一个选择如何真实地活下去。`,
    truth:
      mode === "replay"
        ? `你想回去的不是时间本身，而是当时那个还能感受到「${expectation || "生活正在发生"}」的自己。`
        : `路会改变生活的外形，但不会替你完成选择。你反复寻找的，是让人生仍然属于自己的感觉。`,
    action:
      mode === "replay"
        ? "把那段记忆里最想保留的一个细节，重新带回今天。"
        : "把你在另一条人生里真正羡慕的部分，缩小成今天可以开始的一步。",
    timeline,
    mode,
    profile,
    answers,
    events,
  };
}

export default function Home() {
  const [stage, setStage] = useState<Stage>("arrival");
  const [profile, setProfile] = useState<Profile>(emptyProfile);
  const [profileStep, setProfileStep] = useState(0);
  const [timeline, setTimeline] = useState<Timeline>("past");
  const [mode, setMode] = useState<JourneyMode>("rewrite");
  const [interviewStep, setInterviewStep] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [worldState, setWorldState] = useState<WorldState | null>(null);
  const [returnNote, setReturnNote] = useState("");
  const recognitionRef = useRef<{ stop?: () => void } | null>(null);

  const prompts = journeyPrompts[mode];
  const currentPrompt = prompts[interviewStep];
  const currentProfilePrompt = profilePrompts[profileStep];
  const birthYear = profile.birthday ? profile.birthday.slice(0, 4) : "—";

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    if (query.get("returned") !== "1") return;
    try {
      const stored = window.localStorage.getItem("echo.worldState");
      if (stored) setWorldState(JSON.parse(stored));
    } catch {
      // The return scene still works if local storage is unavailable.
    }
    setStage("returned");
  }, []);

  const routeLabel = useMemo(() => {
    if (mode === "replay") return answers[0] || "一段想念的时间";
    if (mode === "rewrite") return answers[3] || "没走的那条路";
    return answers[1] || "一个尚未发生的未来";
  }, [answers, mode]);

  function goToProfile() {
    setStage("profile");
    setProfileStep(0);
  }

  function submitProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = profile[currentProfilePrompt.key].trim();
    if (!value && currentProfilePrompt.key !== "mbti") return;
    if (profileStep < profilePrompts.length - 1) {
      setProfileStep((step) => step + 1);
      return;
    }
    setStage("threshold");
  }

  function skipMbti() {
    setProfile((current) => ({ ...current, mbti: "" }));
    setStage("threshold");
  }

  function chooseTimeline(nextTimeline: Timeline) {
    setTimeline(nextTimeline);
    setMode(nextTimeline === "past" ? "rewrite" : "decide");
    setStage("mode");
  }

  function chooseMode(nextMode: JourneyMode) {
    setMode(nextMode);
    setAnswers([]);
    setInterviewStep(0);
    setDraft("");
    setStage("interview");
  }

  function submitAnswer(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const value = draft.trim();
    if (!value) return;
    const nextAnswers = [...answers];
    nextAnswers[interviewStep] = value;
    setAnswers(nextAnswers);
    setDraft("");
    if (interviewStep < prompts.length - 1) {
      setInterviewStep((step) => step + 1);
      return;
    }
    setStage("confirm");
  }

  function useSuggestion(value: string) {
    setDraft(value);
  }

  function toggleVoice() {
    if (isListening) {
      recognitionRef.current?.stop?.();
      setIsListening(false);
      return;
    }

    const SpeechRecognition =
      (window as unknown as { SpeechRecognition?: new () => any }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: new () => any })
        .webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setDraft((current) => current || "当前浏览器暂不支持语音输入，请直接打字。");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "zh-CN";
    recognition.interimResults = true;
    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results as ArrayLike<any>)
        .map((result: any) => result[0].transcript)
        .join("");
      setDraft(transcript);
    };
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }

  function generateDoor() {
    const nextWorld = buildWorldState(profile, timeline, mode, answers);
    setWorldState(nextWorld);
    window.localStorage.setItem("echo.worldState", JSON.stringify(nextWorld));
    window.sessionStorage.removeItem("echo.chat.messages.echo-childhood-self");
    setStage("door");
  }

  function openWorld() {
    window.location.href =
      import.meta.env.BASE_URL === "./" ? "./world/" : "/world";
  }

  function loadDemo() {
    const demoProfile = {
      name: "小袁",
      birthday: "2002-02-22",
      identity: "正在寻找自己方向的产品经理",
      hometown: "杭州",
      mbti: "INFP",
    };
    const demoAnswers = [
      "毕业时，我同时拿到一份稳定大厂工作和一个去伦敦做 AI 创业的机会",
      "我最后留在了稳定的工作里",
      "我怕自己能力不够，也舍不得已经建立好的关系",
      "去伦敦，加入那个还没有答案的小团队",
      "你真的更自由了吗，还是只是换了一种焦虑？",
    ];
    const demoWorld = buildWorldState(demoProfile, "past", "rewrite", demoAnswers);
    setProfile(demoProfile);
    setTimeline("past");
    setMode("rewrite");
    setAnswers(demoAnswers);
    setWorldState(demoWorld);
    window.localStorage.setItem("echo.worldState", JSON.stringify(demoWorld));
    window.sessionStorage.removeItem("echo.chat.messages.echo-childhood-self");
    setStage("door");
  }

  function restart() {
    setStage("arrival");
    setProfile(emptyProfile);
    setProfileStep(0);
    setAnswers([]);
    setInterviewStep(0);
    setDraft("");
    setWorldState(null);
    setReturnNote("");
    window.history.replaceState({}, "", "/");
  }

  const stageIndex: Record<Stage, number> = {
    arrival: 0,
    profile: 1,
    threshold: 2,
    mode: 2,
    interview: 3,
    confirm: 4,
    door: 5,
    returned: 6,
  };

  return (
    <main className={`echo-app stage-${stage}`}>
      <div className="atmosphere" aria-hidden="true">
        <span className="light-orbit orbit-one" />
        <span className="light-orbit orbit-two" />
        <span className="film-grain" />
      </div>

      <header className="echo-nav">
        <button className="wordmark" type="button" onClick={restart}>
          <span className="echo-glyph">◌</span>
          <span>ECHO</span>
        </button>
        <div className="chapter-progress" aria-label="旅程进度">
          {Array.from({ length: 7 }).map((_, index) => (
            <i key={index} className={index <= stageIndex[stage] ? "is-lit" : ""} />
          ))}
        </div>
        <span className="nav-note">你的人生 · 仍在生成</span>
      </header>

      {stage === "arrival" && (
        <section className="arrival-screen">
          <div className="arrival-copy">
            <p className="overline">AN EXTENSION OF YOUR REAL LIFE</p>
            <h1>
              你是不是也想过，
              <br />
              要是那天做了另一个选择，
              <br />
              <em>一切都会不一样……</em>
            </h1>
            <p className="arrival-description">
              在这里，时间完全自由，你也完全自由。
              <br />
              推开一扇门，去见那个已经替你生活了很多年的自己。
            </p>
            <div className="arrival-actions">
              <button className="primary-cta" type="button" onClick={goToProfile}>
                降临在这个世界 <span>→</span>
              </button>
              <button className="text-cta" type="button" onClick={loadDemo}>
                直接体验示例世界
              </button>
            </div>
          </div>
          <div className="arrival-visual" aria-hidden="true">
            <div className="time-rings">
              <span />
              <span />
              <span />
              <div className="arrival-door">
                <i />
                <b />
              </div>
            </div>
            <p>另一个你，已经在门后生活了五年。</p>
          </div>
        </section>
      )}

      {stage === "profile" && (
        <section className="profile-screen content-shell">
          <div className="identity-build">
            <p className="overline">ARRIVAL RECORD · {profileStep + 1}/5</p>
            <h2>建立你在这个世界的初始坐标</h2>
            <p>
              这些信息只帮助世界找到你。给得越完整，门后的生活越接近你；
              它们不会成为对你的定义。
            </p>
            <div className="identity-figure">
              <div className="identity-core">
                <span>{profile.name ? profile.name.slice(0, 1) : "?"}</span>
              </div>
              <ul>
                <li className={profile.name ? "is-known" : ""}>称呼</li>
                <li className={profile.birthday ? "is-known" : ""}>时间</li>
                <li className={profile.identity ? "is-known" : ""}>身份</li>
                <li className={profile.hometown ? "is-known" : ""}>地点</li>
                <li className={profile.mbti ? "is-known" : ""}>性格线索</li>
              </ul>
            </div>
          </div>
          <form className="profile-card" onSubmit={submitProfile}>
            <span className="card-number">0{profileStep + 1}</span>
            <label htmlFor={`profile-${currentProfilePrompt.key}`}>
              {currentProfilePrompt.question}
            </label>
            <input
              id={`profile-${currentProfilePrompt.key}`}
              type={currentProfilePrompt.type}
              value={profile[currentProfilePrompt.key]}
              placeholder={currentProfilePrompt.placeholder}
              autoFocus
              maxLength={currentProfilePrompt.key === "mbti" ? 4 : 40}
              onChange={(event) =>
                setProfile((current) => ({
                  ...current,
                  [currentProfilePrompt.key]:
                    currentProfilePrompt.key === "mbti"
                      ? event.target.value.toUpperCase()
                      : event.target.value,
                }))
              }
            />
            {currentProfilePrompt.key === "mbti" ? (
              <p className="field-note">
                MBTI 只会作为行为生成的一条弱线索，并会被你后续的真实选择持续修正。
              </p>
            ) : (
              <p className="field-note">直接回答就好，不需要写完整句子。</p>
            )}
            <div className="card-actions">
              {profileStep > 0 && (
                <button
                  className="quiet-button"
                  type="button"
                  onClick={() => setProfileStep((step) => step - 1)}
                >
                  上一步
                </button>
              )}
              {currentProfilePrompt.key === "mbti" && (
                <button className="quiet-button" type="button" onClick={skipMbti}>
                  我不知道，跳过
                </button>
              )}
              <button className="solid-button" type="submit">
                {profileStep === profilePrompts.length - 1 ? "完成降临" : "继续"} →
              </button>
            </div>
          </form>
        </section>
      )}

      {stage === "threshold" && (
        <section className="threshold-screen content-shell">
          <div className="threshold-heading">
            <p className="overline">TEMPORAL THRESHOLD</p>
            <span className="coordinate">
              {profile.name || "旅行者"} · {birthYear} · {profile.hometown || "未知地点"}
            </span>
            <h2>你最想从哪里重新出发？</h2>
            <p>一扇门回到已经发生的时间，一扇门通向仍未发生的时间。</p>
          </div>
          <div className="time-axis">
            <button
              className="time-door past-door"
              type="button"
              onClick={() => chooseTimeline("past")}
            >
              <span className="door-light" />
              <small>← BEFORE NOW</small>
              <strong>回去</strong>
              <p>重返一段生活，或改写一个选择</p>
            </button>
            <div className="present-marker">
              <span />
              <b>现在</b>
              <small>你站在这里</small>
            </div>
            <button
              className="time-door future-door"
              type="button"
              onClick={() => chooseTimeline("future")}
            >
              <span className="door-light" />
              <small>AFTER NOW →</small>
              <strong>向前</strong>
              <p>让一个尚未发生的选择先生活五年</p>
            </button>
          </div>
          <p className="threshold-note">
            门不是传送装置。它是一条可进入、可质疑、会承担代价的人生模拟。
          </p>
        </section>
      )}

      {stage === "mode" && (
        <section className="mode-screen content-shell">
          <div className="mode-heading">
            <button className="inline-back" type="button" onClick={() => setStage("threshold")}>
              ← 返回现在
            </button>
            <p className="overline">
              {timeline === "past" ? "PAST / TWO WAYS BACK" : "FUTURE / POSSIBLE LIFE"}
            </p>
            <h2>{timeline === "past" ? "你想怎样回去？" : "先让未来替你生活一段时间"}</h2>
          </div>
          <div className={`mode-grid ${timeline === "future" ? "single-mode" : ""}`}>
            {timeline === "past" ? (
              <>
                <button className="mode-card" type="button" onClick={() => chooseMode("replay")}>
                  <span>01</span>
                  <h3>{modeCopy.replay.title}</h3>
                  <p>{modeCopy.replay.description}</p>
                  <i>没有任何选择需要被修正。</i>
                </button>
                <button className="mode-card" type="button" onClick={() => chooseMode("rewrite")}>
                  <span>02</span>
                  <h3>{modeCopy.rewrite.title}</h3>
                  <p>{modeCopy.rewrite.description}</p>
                  <i>只改变一个变量，保留真实世界的约束。</i>
                </button>
              </>
            ) : (
              <button className="mode-card featured" type="button" onClick={() => chooseMode("decide")}>
                <span>01</span>
                <h3>{modeCopy.decide.title}</h3>
                <p>{modeCopy.decide.description}</p>
                <i>不是预测结果，而是把不同选择的交换显影出来。</i>
              </button>
            )}
          </div>
        </section>
      )}

      {stage === "interview" && currentPrompt && (
        <section className="interview-screen content-shell">
          <aside className="interview-map">
            <button className="inline-back" type="button" onClick={() => setStage("mode")}>
              ← 退出这次生成
            </button>
            <p className="overline">WORLD SEED · {interviewStep + 1}/{prompts.length}</p>
            <h2>门正在理解<br />哪条人生属于你</h2>
            <div className="seed-layers">
              {prompts.map((prompt, index) => (
                <div
                  key={prompt.kicker}
                  className={`${index < interviewStep ? "is-done" : ""} ${
                    index === interviewStep ? "is-current" : ""
                  }`}
                >
                  <span>{index < interviewStep ? "✓" : `0${index + 1}`}</span>
                  <p>{prompt.kicker}</p>
                </div>
              ))}
            </div>
            <p className="privacy-note">你随时可以停下。没有“最正确”的袒露程度。</p>
          </aside>
          <form className="conversation-card" onSubmit={submitAnswer}>
            <div className="speaker">
              <span className="speaker-orb" />
              <div>
                <small>ECHO</small>
                <p>我每次只问一件事。</p>
              </div>
            </div>
            <div className="question-block">
              <small>{currentPrompt.kicker}</small>
              <h3>{currentPrompt.question}</h3>
              <p>{currentPrompt.helper}</p>
            </div>
            {currentPrompt.suggestions && (
              <div className="suggestion-row">
                {currentPrompt.suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => useSuggestion(suggestion)}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
            <div className="answer-box">
              <textarea
                value={draft}
                autoFocus
                maxLength={500}
                placeholder="一句话就够，也可以说给我听……"
                onChange={(event) => setDraft(event.target.value)}
              />
              <div>
                <button
                  className={`voice-button ${isListening ? "is-listening" : ""}`}
                  type="button"
                  onClick={toggleVoice}
                >
                  {isListening ? "■ 正在听，点击结束" : "◉ 语音输入"}
                </button>
                <span>{draft.length}/500</span>
              </div>
            </div>
            <div className="conversation-actions">
              {interviewStep > 0 && (
                <button
                  className="quiet-button"
                  type="button"
                  onClick={() => {
                    const previous = interviewStep - 1;
                    setInterviewStep(previous);
                    setDraft(answers[previous] || "");
                  }}
                >
                  回到上一问
                </button>
              )}
              <button className="solid-button" type="submit" disabled={!draft.trim()}>
                {interviewStep === prompts.length - 1 ? "生成世界底稿" : "告诉 Echo"} →
              </button>
            </div>
          </form>
        </section>
      )}

      {stage === "confirm" && (
        <section className="confirm-screen content-shell">
          <div className="confirm-heading">
            <p className="overline">BEFORE THE DOOR OPENS</p>
            <h2>我理解的，是这条人生吗？</h2>
            <p>这不是对你的判断，只是世界生成前的一次对齐。</p>
          </div>
          <div className="world-draft">
            <article>
              <span>01 · 事实</span>
              <h3>{answers[0]}</h3>
              <p>{answers[1]}</p>
            </article>
            <article>
              <span>02 · 为什么</span>
              <h3>{mode === "replay" ? "你想重新感受" : "你当时/现在在权衡"}</h3>
              <p>{answers[2]}</p>
            </article>
            <article>
              <span>03 · 门后要验证</span>
              <h3>{routeLabel}</h3>
              <p>你会问另一个自己：“{answers[4]}”</p>
            </article>
          </div>
          <div className="confirm-actions">
            <button
              className="quiet-button"
              type="button"
              onClick={() => {
                setInterviewStep(0);
                setDraft(answers[0] || "");
                setStage("interview");
              }}
            >
              有些地方不对，我来修改
            </button>
            <button className="primary-cta" type="button" onClick={generateDoor}>
              对，就是这条人生 <span>→</span>
            </button>
          </div>
          <p className="simulation-note">
            Echo 生成的是一种受现实事实约束、会被你持续校正的人生模拟，不是未来预测。
          </p>
        </section>
      )}

      {stage === "door" && worldState && (
        <section className="door-screen content-shell">
          <div className="door-copy">
            <p className="overline">
              {timeline === "past" ? "WORLD − 05Y" : "WORLD + 05Y"} · GENERATED
            </p>
            <h2>
              这扇门后不是空白。
              <br />
              <em>另一个你，已经在这里生活了五年。</em>
            </h2>
            <p>{worldState.seed}</p>
            <div className="evidence-preview">
              {worldState.events.map((event) => (
                <div key={event.polarity}>
                  <span>{event.polarity === "gain" ? "+" : event.polarity === "cost" ? "−" : "∞"}</span>
                  <p>
                    {event.polarity === "gain"
                      ? "她得到的"
                      : event.polarity === "cost"
                        ? "她失去的"
                        : "始终没变的"}
                  </p>
                </div>
              ))}
            </div>
            <button className="primary-cta" type="button" onClick={openWorld}>
              推开这扇门 <span>↗</span>
            </button>
            <p className="control-note">桌面端体验 · WASD 行走 · E 触碰记忆 · 与另一个自己对话</p>
          </div>
          <div className="generated-door" aria-hidden="true">
            <div className="door-frame">
              <div className="door-surface">
                <span className="door-year">{timeline === "past" ? "THEN" : "FIVE YEARS LATER"}</span>
                <i />
                <b />
              </div>
            </div>
            <p>{profile.name || "你"} / {profile.hometown || "某地"} / WORLD 01</p>
          </div>
        </section>
      )}

      {stage === "returned" && (
        <section className="return-screen content-shell">
          <div className="return-token">
            <span className="token-orbit" />
            <span className="token-core">回</span>
          </div>
          <div className="return-copy">
            <p className="overline">RETURN TO NOW</p>
            <h2>欢迎回来。<br />另一条人生没有替你做决定。</h2>
            <p className="temporary-truth">
              {worldState?.truth ||
                "你不是想找到一条没有代价的路；你想确认，这一次决定仍然属于你。"}
            </p>
            <div className="return-gift">
              <small>你从门后带回的东西</small>
              <strong>选择权</strong>
              <p>{worldState?.action || "把向往缩小成今天可以开始的一步。"}</p>
            </div>
            <label className="return-note">
              <span>留一句话给现在的自己 · 可选</span>
              <textarea
                value={returnNote}
                placeholder="我现在能做的一件小事是……"
                onChange={(event) => setReturnNote(event.target.value)}
              />
            </label>
            <div className="return-actions">
              <button className="primary-cta" type="button" onClick={restart}>
                回到现在 <span>→</span>
              </button>
              <button className="text-cta" type="button" onClick={() => setStage("threshold")}>
                去看另一扇门
              </button>
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
