"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import {
  rememberGeneratedWorld,
  rememberOnboarding,
  rememberReturnNote,
  snapshotEchoMemory,
  type MemorySnapshot,
} from "./lib/echo-memory";

type Stage =
  | "arrival"
  | "profile"
  | "threshold"
  | "interview"
  | "confirm"
  | "door"
  | "returned";

type Timeline = "past" | "future";
type JourneyMode = "rewrite" | "replay" | "decide";

type Profile = {
  name: string;
  identity: string;
};

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
  version: number;
  seed: string;
  context: string;
  truth: string;
  action: string;
  timeline: Timeline;
  mode: JourneyMode;
  profile: Profile;
  answers: string[];
  events: WorldEvent[];
  fixedFacts: string[];
  changedVariable: string;
  centralTension: string;
  userModel: {
    desires: string[];
    fears: string[];
    attachments: string[];
    hypothesis: string;
    confidence: number;
  };
  scenes: WorldScene[];
  persistentTimeline?: {
    forkMoment: string;
    sharedOrigin: string;
    realPath: string;
    counterfactualPath: string;
    observationTarget: string;
    currentHorizon: string;
    status: "active";
  };
};

type Prompt = {
  kicker: string;
  question: string;
  helper: string;
  suggestions?: string[];
};

const emptyProfile: Profile = {
  name: "",
  identity: "",
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
    key: "identity" as const,
    label: "当前身份",
    question: "你现在主要在做什么？",
    placeholder: "例如：产品经理、学生、正在创业的人",
    type: "text",
  },
];

const journeyPrompts: Record<JourneyMode, Prompt[]> = {
  rewrite: [
    {
      kicker: "共同起点",
      question: "那个岔路发生在什么时候？当时的你正站在人生哪个阶段？",
      helper: "例如：两个月前，刚毕业，正在选第一份工作的 Offer。",
      suggestions: ["刚毕业选第一份工作", "准备搬去另一座城市", "收到一个新的机会"],
    },
    {
      kicker: "现实锚点",
      question: "现实里，你最后选了什么？",
      helper: "只写真实发生过的事。这里不会替你改写现实。",
    },
    {
      kicker: "平行选择",
      question: "这一次回到那个时刻，你要让哪个选择真正发生？",
      helper: "这是这条世界唯一固定的大岔路，进入后不再重复选择。",
      suggestions: ["接受另一份 Offer", "去那座没有去的城市", "开始那件没有开始的事"],
    },
    {
      kicker: "当时的理由",
      question: "当时为什么没有选它？什么现实条件不能凭空消失？",
      helper: "可以说收入、发展、关系、家庭、能力或当时未知的事情。",
      suggestions: ["我更看重未来发展", "我担心收入和机会", "我不确定自己是否适合"],
    },
    {
      kicker: "观察节点",
      question: "这一次，你想先把这条时间线生活到哪里？",
      helper: "可以是同一个今天、一年后、五年后、十年后，或一个具体人生节点。以后还能继续。",
      suggestions: ["先走到同一个今天", "看看一年后", "直接观察五年后"],
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
        ? `如果在「${answers[0] || "那个岔路"}」，我选择了：${answers[2] || "另一条路"}`
        : `如果现在，我选择：${answers[1] || "其中一条路"}`;

  const expectation =
    mode === "decide" ? answers[2] : mode === "replay" ? answers[3] : answers[3];
  const cost =
    mode === "decide"
      ? answers[3]
      : mode === "rewrite"
        ? `这条路仍要带着这些现实条件继续：${answers[3] || "当时真实存在的顾虑"}`
        : "那段时间终究会继续向前";

  const desire =
    mode === "decide"
      ? answers[2] || "让生活重新拥有选择"
      : mode === "replay"
        ? answers[3] || "重新感到生活正在发生"
        : answers[2] || "走向那条没有保证的路";
  const fear =
    mode === "decide"
      ? answers[3] || "失去现在拥有的确定感"
      : mode === "rewrite"
        ? answers[3] || "失去当时更看重的东西"
        : "知道这段时间终究会结束";
  const alternative =
    mode === "rewrite"
      ? answers[2] || "做出另一个选择"
      : mode === "decide"
        ? answers[1] || "选择其中一条路"
        : answers[0] || "重新回到那段时间";

  const events: WorldEvent[] =
    mode === "replay"
      ? [
          {
            time: "第一幕 · 回到那一天",
            title: answers[2] || "熟悉的声音先回来了",
            detail: `你回到「${answers[1] || answers[0]}」。世界没有要求你修正过去，只让那些曾被时间压扁的细节重新出现。`,
            polarity: "gain",
          },
          {
            time: "第二幕 · 时间继续走",
            title: "你知道这一刻仍然会结束",
            detail: "能够重返，不等于能够留下。正因为知道它会结束，你终于没有把这一天活成背景。",
            polarity: "cost",
          },
          {
            time: "第三幕 · 离开以前",
            title: "记忆没有要求你住在过去",
            detail: `你真正想带回的不是旧日完整复刻，而是「${expectation || "一种很久没有认真感受过的东西"}」。`,
            polarity: "turn",
          },
        ]
      : [
          {
            time: `第一幕 · ${answers[0] || "岔路发生时"}`,
            title: `你亲手确认了「${alternative}」`,
            detail: `这次大选择已经发生。接下来真正改变时间线的，是你如何进入这条生活，以及当时那些现实条件如何继续留下来。`,
            polarity: "gain",
          },
          {
            time: "第二幕 · 这条生活开始形成日常",
            title: "新的选择第一次碰到现实",
            detail: `你开始获得这条路的反馈，也发现它不会抹掉原来的顾虑：${cost || fear}。`,
            polarity: "cost",
          },
          {
            time: `第三幕 · ${answers[4] || "本次观察节点"}`,
            title: `时间线抵达「${answers[4] || "你想观察的时刻"}」`,
            detail: "共感态在这里暂停。你可以与已经生活到这个节点的自己开放对话，也可以继续选择下一个时间节点。",
            polarity: "turn",
          },
        ];

  const scenes: WorldScene[] =
    mode === "replay"
      ? [
          {
            id: "arrival",
            time: events[0].time,
            place: answers[1] || answers[0] || "记忆里的那个地方",
            title: "你先听见了熟悉的声音",
            atmosphere: `${answers[2] || "那个只属于当时的细节"}重新出现，时间没有倒带的噪音，一切只是继续发生。`,
            situation: "那时的你就在不远处，还不知道这一天后来会被记住这么久。",
            choicePrompt: "这一次，你想先做什么？",
            choices: [
              { id: "stay", label: "什么也不改变，只认真待在这一刻", reveals: "你开始注意到当年忽略的细节。" },
              { id: "approach", label: "走近那时的自己", reveals: "她抬头看你，像认出一个很久以后的念头。" },
            ],
            evidence: events[0],
          },
          {
            id: "passing",
            time: events[1].time,
            place: "同一个地方 · 天色变暗以前",
            title: "你知道它仍然会结束",
            atmosphere: "钟表仍然向前，熟悉的人会离开房间，灯也会按原来的时间熄灭。",
            situation: "你不能把任何人带走，但可以决定最后把注意力放在哪里。",
            choicePrompt: "离开以前，你想把什么看清？",
            choices: [
              { id: "person", label: "好好看一眼那个舍不得的人", reveals: "你终于记起了对方当时的神情，而不只是后来失去的感觉。" },
              { id: "self", label: "看着当时的自己", reveals: "你发现她并没有你记忆里那么无忧无虑。" },
            ],
            evidence: events[1],
          },
          {
            id: "meeting",
            time: events[2].time,
            place: "门再次出现的地方",
            title: "过去把一样东西交还给你",
            atmosphere: "房间没有挽留你。那段生活只把一个仍然有效的部分放在门边。",
            situation: `那时的你问：“${answers[4] || "你后来有好好生活吗？"}”`,
            choicePrompt: "你准备怎么回答？",
            choices: [
              { id: "honest", label: "诚实告诉她，后来并不总是容易", reveals: "她没有失望，只是点了点头。" },
              { id: "promise", label: "告诉她，你会把一种感觉带回去", reveals: "门后的光第一次照向现在。" },
            ],
            evidence: events[2],
          },
        ]
      : [
          {
            id: "arrival",
            time: events[0].time,
            place: mode === "rewrite" ? answers[0] || "岔路发生的地方" : "选择发生后的新生活",
            title: "大选择已经发生",
            atmosphere: `你仍站在共同起点上，但这一次，${alternative}已经成为现实。`,
            situation: `现实中的你选择了「${answers[1] || "原来的路"}」；这条世界从「${alternative}」开始。`,
            choicePrompt: "确认之后，你想先如何进入这条新生活？",
            choices: [
              { id: "tell", label: "先告诉一个重要的人", reveals: "这个选择第一次被说出口，也开始进入你们的关系。" },
              { id: "prepare", label: "先处理眼前最具体的准备", reveals: "你暂时没有解释它，只让这条生活先从一个实际动作开始。" },
            ],
            evidence: events[0],
          },
          {
            id: "exchange",
            time: events[1].time,
            place: "选择之后 · 第一个形成日常的阶段",
            title: "新生活第一次给你真实反馈",
            atmosphere: "最初的新鲜感开始退到背景，工作、关系与日常安排逐渐露出自己的结构。",
            situation: `这条路带来了一些「${desire}」，也让「${fear}」以新的形式留在生活里。`,
            choicePrompt: "当你第一次察觉这种摩擦时，你更想怎么回应？",
            choices: [
              { id: "engage", label: "主动靠近，弄清这套生活怎样运转", reveals: "你获得更多一手反馈，也投入了更多注意力。" },
              { id: "protect", label: "先保留边界，不急着适应所有要求", reveals: "你保住了一部分自己的节奏，但一些关系与机会仍保持距离。" },
            ],
            evidence: events[1],
          },
          {
            id: "meeting",
            time: events[2].time,
            place: answers[4] || "用户指定的观察节点",
            title: "你与这条路上的自己重新分开",
            atmosphere: "刚才由你亲历的生活停在这个节点。倒影拥有同样的世界记忆，但只知道自己走过的这一边。",
            situation: `她已经生活到「${answers[4] || "这个观察节点"}」，也可能在想象你走过的另一条路。`,
            choicePrompt: "开始开放对话以前，你想先让她记住哪一部分？",
            choices: [
              { id: "gain", label: "这条路目前真实得到的部分", reveals: "她会承认得到，但不会用得到证明选择正确。" },
              { id: "friction", label: "这条路目前仍然摩擦的部分", reveals: "她会带着未解决的问题与你见面，而不是提供结论。" },
            ],
            evidence: events[2],
          },
        ];

  return {
    version: 2,
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
    fixedFacts: [
      `共同起点：${answers[0] || "岔路发生的时刻"}`,
      `现实中的你最终选择：${answers[1] || "当前这条生活"}`,
      `平行世界固定选择：${alternative}`,
    ],
    changedVariable: alternative,
    centralTension: mode === "replay" ? "怀念与继续生活" : `${desire} 与 ${fear}`,
    userModel: {
      desires: [desire],
      fears: [fear],
      attachments: [answers[3] || "重要的人与已有关系"],
      hypothesis:
        mode === "replay"
          ? "你想回去的也许不是某个年代，而是当时仍能被你清楚感受到的生活。"
          : "你反复想象另一条路，也许不是因为它更完美，而是它替你保存了主动选择的感觉。",
      confidence: 0.68,
    },
    scenes,
    persistentTimeline:
      mode === "rewrite"
        ? {
            forkMoment: answers[0] || "岔路发生时",
            sharedOrigin: answers[0] || "共同起点",
            realPath: answers[1] || "现实路径",
            counterfactualPath: alternative,
            observationTarget: answers[4] || "同一个今天",
            currentHorizon: "fork",
            status: "active",
          }
        : undefined,
  };
}

function isWorldState(value: unknown): value is WorldState {
  if (!value || typeof value !== "object") return false;
  const state = value as Partial<WorldState>;
  return (
    typeof state.seed === "string" &&
    typeof state.truth === "string" &&
    typeof state.action === "string" &&
    Array.isArray(state.events) &&
    state.events.length >= 3 &&
    Array.isArray(state.scenes) &&
    state.scenes.length >= 3
  );
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
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationNote, setGenerationNote] = useState("");
  const [returnNote, setReturnNote] = useState("");
  const [memorySnapshot, setMemorySnapshot] = useState<MemorySnapshot | null>(null);
  const recognitionRef = useRef<{ stop?: () => void } | null>(null);

  const prompts = journeyPrompts[mode];
  const currentPrompt = prompts[interviewStep];
  const currentProfilePrompt = profilePrompts[profileStep];

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    if (query.get("returned") !== "1") return;
    try {
      const stored = window.localStorage.getItem("echo.worldState");
      if (stored) setWorldState(JSON.parse(stored));
      setMemorySnapshot(snapshotEchoMemory());
    } catch {
      // The return scene still works if local storage is unavailable.
    }
    setStage("returned");
  }, []);

  function goToProfile() {
    setStage("profile");
    setProfileStep(0);
  }

  function submitProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = profile[currentProfilePrompt.key].trim();
    if (!value) return;
    if (profileStep < profilePrompts.length - 1) {
      setProfileStep((step) => step + 1);
      return;
    }
    setStage("threshold");
  }

  function beginUnchosenLife() {
    setTimeline("past");
    setMode("rewrite");
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

  async function generateDoor() {
    if (isGenerating) return;
    setIsGenerating(true);
    setGenerationNote("Echo 正在让这条时间线从岔路开始生活……");

    let nextWorld = buildWorldState(profile, timeline, mode, answers);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 22_000);
    try {
      const response = await fetch("/api/world", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          profile,
          timeline,
          mode,
          answers,
        }),
      });
      if (response.ok) {
        const payload = (await response.json()) as { world?: unknown };
        if (isWorldState(payload.world)) nextWorld = payload.world;
      } else {
        setGenerationNote("模型暂时没有抵达，已用 Echo 的因果规则完成生成。");
      }
    } catch {
      setGenerationNote("模型暂时没有抵达，已用 Echo 的因果规则完成生成。");
    } finally {
      window.clearTimeout(timeout);
    }

    setWorldState(nextWorld);
    window.localStorage.setItem("echo.worldState", JSON.stringify(nextWorld));
    rememberOnboarding(profile, answers);
    const memory = rememberGeneratedWorld(nextWorld);
    setMemorySnapshot(snapshotEchoMemory(memory));
    ["gain", "cost", "truth"].forEach((id) =>
      window.sessionStorage.removeItem(`echo.inventory.${id}`),
    );
    window.localStorage.removeItem("echo.persistentTimeline.v1");
    window.sessionStorage.removeItem("echo.chat.messages.echo-childhood-self");
    window.localStorage.removeItem("echo.persistentTimeline.v1");
    setStage("door");
    setIsGenerating(false);
  }

  function openWorld() {
    window.location.href =
      import.meta.env.BASE_URL === "./" ? "./world/" : "/world";
  }

  function loadDemo() {
    const demoProfile = {
      name: "小袁",
      identity: "刚毕业、正在适应第一份工作的 AI 产品经理",
    };
    const demoAnswers = [
      "两个月前，刚毕业，正在选择第一份工作的 Offer",
      "我选择了小红书的 AI 产品岗位",
      "接受宁波移动的校招岗位",
      "我当时更看重 AI 方向、收入和未来发展，也担心移动的工作一眼望到头",
      "先走到和现实相同的今天",
    ];
    const demoWorld = buildWorldState(demoProfile, "past", "rewrite", demoAnswers);
    setProfile(demoProfile);
    setTimeline("past");
    setMode("rewrite");
    setAnswers(demoAnswers);
    setWorldState(demoWorld);
    window.localStorage.setItem("echo.worldState", JSON.stringify(demoWorld));
    rememberOnboarding(demoProfile, demoAnswers);
    const memory = rememberGeneratedWorld(demoWorld);
    setMemorySnapshot(snapshotEchoMemory(memory));
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
    setIsGenerating(false);
    setGenerationNote("");
    setReturnNote("");
    window.history.replaceState(
      {},
      "",
      new URL("./", window.location.href).toString(),
    );
  }

  const stageIndex: Record<Stage, number> = {
    arrival: 0,
    profile: 1,
    threshold: 2,
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
            <p>另一条时间线，正在门后等待第一次选择。</p>
          </div>
        </section>
      )}

      {stage === "profile" && (
        <section className="profile-screen content-shell">
          <div className="identity-build">
            <p className="overline">ARRIVAL RECORD · {profileStep + 1}/2</p>
            <h2>建立你在这个世界的初始坐标</h2>
            <p>
              这里只需要一个最小身份。Echo 不用测试定义你，
              它会在你真正做选择时慢慢认识你。
            </p>
            <div className="identity-figure">
              <div className="identity-core">
                <span>{profile.name ? profile.name.slice(0, 1) : "?"}</span>
              </div>
              <ul>
                <li className={profile.name ? "is-known" : ""}>称呼</li>
                <li className={profile.identity ? "is-known" : ""}>身份</li>
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
              maxLength={40}
              onChange={(event) =>
                setProfile((current) => ({
                  ...current,
                  [currentProfilePrompt.key]: event.target.value,
                }))
              }
            />
            <p className="field-note">直接回答就好，不需要写完整句子。</p>
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
            <p className="overline">THE UNCHOSEN LIFE</p>
            <span className="coordinate">
              {profile.name || "旅行者"} · {profile.identity || "现在的你"}
            </span>
            <h2>你没选的那条路，<br />没有停在那一天。</h2>
            <p>它已经继续向前生活。先告诉我是哪条路，我会找到那扇只属于你的门。</p>
          </div>
          <div className="time-axis single-threshold">
            <button
              className="time-door past-door unchosen-door"
              type="button"
              onClick={beginUnchosenLife}
            >
              <span className="door-light" />
              <small>WORLD 01 · NOT YET FOUND</small>
              <strong>找到那条没走的路</strong>
              <p>只改变当年的一个选择，让它承担真实的时间与代价</p>
            </button>
            <div className="present-marker">
              <span />
              <b>现在</b>
              <small>所有世界都从这里返回</small>
            </div>
          </div>
          <p className="threshold-note">
            Demo 只打开一扇门：不是因为时间只有一个方向，而是先把一次相遇做得足够真实。
          </p>
        </section>
      )}

      {stage === "interview" && currentPrompt && (
        <section className="interview-screen content-shell">
          <aside className="interview-map">
            <button className="inline-back" type="button" onClick={() => setStage("threshold")}>
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
              <h3>共同起点：{answers[0]}</h3>
              <p>现实选择：{answers[1]}</p>
            </article>
            <article>
              <span>02 · 为什么</span>
              <h3>这次固定发生的平行选择</h3>
              <p>{answers[2]}</p>
            </article>
            <article>
              <span>03 · 门后要验证</span>
              <h3>先生活到：{answers[4]}</h3>
              <p>不能被模拟抹掉：{answers[3]}。抵达后仍可继续选择下一个时间节点。</p>
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
            <button
              className="primary-cta"
              type="button"
              onClick={generateDoor}
              disabled={isGenerating}
            >
              {isGenerating ? "正在生成另一条人生…" : "对，就是这条人生"} <span>→</span>
            </button>
          </div>
          <p className="simulation-note">
            {generationNote ||
              "Echo 生成的是一种受现实事实约束、会被你持续校正的人生模拟，不是未来预测。"}
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
              <em>这条时间线，将从那个岔路重新开始。</em>
            </h2>
            <p>{worldState.seed}</p>
            <div className="evidence-preview">
              <div><span>01</span><p>亲手确认平行选择</p></div>
              <div><span>02</span><p>经历它第一次碰到现实</p></div>
              <div><span>03</span><p>抵达观察节点，与她对话</p></div>
            </div>
            <button className="primary-cta" type="button" onClick={openWorld}>
              回到那个岔路 <span>↗</span>
            </button>
            <p className="control-note">桌面端体验 · WASD 行走 · E 进入剧情节点 · 抵达后开放对话</p>
          </div>
          <div className="generated-door" aria-hidden="true">
            <div className="door-frame">
              <div className="door-surface">
                <span className="door-year">{timeline === "past" ? "THEN" : "FIVE YEARS LATER"}</span>
                <i />
                <b />
              </div>
            </div>
            <p>{profile.name || "你"} / {profile.identity || "现在的身份"} / WORLD 01</p>
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
            {memorySnapshot && (
              <div className="memory-receipt">
                <small>PERSONAL MEMORY AGENT · 暂时认识</small>
                <p>{memorySnapshot.hypothesis}</p>
                <span>
                  现实记忆 {memorySnapshot.coreCount} 条 · 模拟档案{" "}
                  {memorySnapshot.archiveCount} 条 · 假设置信度{" "}
                  {Math.round(memorySnapshot.confidence * 100)}%
                </span>
                <i>模拟经历只进入 Archive，不会被写成你的现实。</i>
              </div>
            )}
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
              <button
                className="text-cta"
                type="button"
                onClick={() => {
                  const memory = rememberReturnNote(returnNote);
                  setMemorySnapshot(snapshotEchoMemory(memory));
                }}
              >
                把这句话留给 Echo
              </button>
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
