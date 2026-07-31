import { StrictMode, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./style.css";

type Phase =
  | "intro"
  | "seed"
  | "calibration"
  | "world"
  | "horizon"
  | "echo";

type Calibration = {
  assignment: string;
  housing: string;
  horizon: string;
};

type WorldChoice = {
  label: string;
  consequence: string;
  memory: string;
};

type WorldNode = {
  time: string;
  place: string;
  title: string;
  body: string[];
  question: string;
  choices: WorldChoice[];
};

const seedFacts = [
  ["共同起点", "两个月前，校招毕业时同时面对两份 Offer"],
  ["现实路径", "小红书 · AI 产品岗位"],
  ["平行路径", "宁波移动 · 校招岗位"],
  ["选择原因", "AI 风口、收入和未来发展上限"],
  ["不应被预设", "更幸福、一定后悔、父母买房、具体工资与岗位"],
  ["真正想问", "如果当时选了移动，那里的我会怎样生活？她会更开心吗？"],
];

const calibrations = [
  {
    key: "assignment" as const,
    eyebrow: "CALIBRATION 01 / 工作落点",
    question: "为了开始这条可能世界，入职后的第一份安排先采用哪种设定？",
    note: "这不是历史事实，只是本轮模拟采用的前提。",
    options: [
      ["收到区县轮岗安排", "先采用“入职后被安排去区县轮岗”的设定"],
      ["直接进入市公司", "先采用“入职后留在市公司”的设定"],
      ["保持未知", "不预设岗位落点，等世界推进时再暴露不确定性"],
    ],
  },
  {
    key: "housing" as const,
    eyebrow: "CALIBRATION 02 / 居住结构",
    question: "刚回宁波的这段时间，你先住在哪里？",
    note: "住处会改变通勤、家庭边界和经济结构。",
    options: [
      ["暂时和父母一起住", "采用“入职初期与父母同住”的设定"],
      ["自己租房", "采用“在单位附近独立租住”的设定"],
      ["保持未知", "不预设住处，不生成相应家庭剧情"],
    ],
  },
  {
    key: "horizon" as const,
    eyebrow: "CALIBRATION 03 / 观察节点",
    question: "这一次，先把时间生活到哪里？",
    note: "这不是结局，抵达后仍然可以继续向前。",
    options: [
      ["和现实相同的今天", "先生活到两个月后的今天"],
      ["入职一年后", "观察工作形成日常以后的自己"],
      ["五年后", "跳到更远处，但保留更多未知"],
    ],
  },
];

function buildNodes(calibration: Calibration): WorldNode[] {
  const rotation =
    calibration.assignment === "收到区县轮岗安排"
      ? {
          time: "入职培训结束",
          place: "培训会议室",
          title: "你的名字出现在区县轮岗名单里",
          body: [
            "投影翻到最后一页，你看到自己的名字。有人已经在问住宿，也有人打听这次轮岗究竟会持续多久。",
            "它不是“成长副本”，也不是惩罚。你只知道：接受会让你更快碰到一线业务，争取留下则会让生活更靠近原先设想。",
          ],
          question: "你准备怎样回应这份安排？",
          choices: [
            {
              label: "先接受安排，去现场看看",
              consequence:
                "你开始准备行李。轮岗带来的不是自动成长，而是更多一手问题，以及需要自己争取的学习空间。",
              memory: "面对轮岗时，选择先进入现场获取反馈",
            },
            {
              label: "主动争取留在市公司",
              consequence:
                "你开始询问留下的可能。离家近重新成为一个具体好处，但你也更早面对“稳定分工是否够用”的问题。",
              memory: "面对轮岗时，把靠近家和确定性放在前面",
            },
          ],
        }
      : {
          time: "入职后的第一个完整星期",
          place: "市公司工位",
          title: "新鲜感退下去以后，工作开始显出结构",
          body: [
            "组织关系、工作流程和谁负责哪一步都比你想象得清楚。你不需要持续追赶每天变化的新方向。",
            "清楚带来低摩擦，也带来另一个问题：你还不知道这些工作会把自己的能力带向哪里。",
          ],
          question: "你准备先怎样进入这套系统？",
          choices: [
            {
              label: "主动找一个数字化项目靠近",
              consequence:
                "你获得了更多信息，但项目入口、职责边界和反馈周期都比“主动”两个字更复杂。",
              memory: "入职初期主动寻找数字化项目入口",
            },
            {
              label: "先把手上的流程完整做一遍",
              consequence:
                "你更快理解了日常运转，也暂时没有回答“熟练以后还剩下什么挑战”。",
              memory: "入职初期先理解组织流程与日常运转",
            },
          ],
        };

  const home =
    calibration.housing === "自己租房"
      ? {
          time: "一个普通工作日晚上",
          place: "单位附近的出租屋",
          title: "时间准时还给你以后，晚上并没有自动变得充实",
          body: [
            "房间很安静，通勤也不算难。你第一次完整拥有下班后的几个小时。",
            "但自由时间只是空间，不是答案。你仍要决定它被休息、学习、社交，还是刷手机一点点吃掉。",
          ],
          question: "今晚，你先把时间放在哪里？",
          choices: [
            {
              label: "出门走走，重新建立自己的生活半径",
              consequence:
                "你开始拥有工作之外的城市坐标，但新的关系和生活内容仍需要慢慢长出来。",
              memory: "把一部分下班时间用于建立独立生活",
            },
            {
              label: "留在家里，先让自己彻底休息",
              consequence:
                "身体松下来以后，你仍会在某些晚上点开行业消息。休息解决疲惫，却没有消除比较。",
              memory: "把下班时间优先留给休息，同时仍会比较另一条路",
            },
          ],
        }
      : calibration.housing === "暂时和父母一起住"
        ? {
            time: "入职后的一个工作日晚饭",
            place: "宁波家里",
            title: "回家很近，回到自己的生活却没有那么快",
            body: [
              "饭已经盛好。父母问今天忙不忙、周末有什么安排，以及为什么最近总在房间里看手机。",
              "照顾和边界同时存在。离家近不会自动让关系更好，也不会必然让你失去自由；它只是让边界重新变成每天要处理的事。",
            ],
            question: "这一次，你怎么回应？",
            choices: [
              {
                label: "把边界说清楚，即使气氛会短暂变僵",
                consequence:
                  "问题没有一次解决，但你第一次明确：回宁波是自己的选择，不等于把所有生活安排交回家里。",
                memory: "与父母同住时，选择主动谈成年后的生活边界",
              },
              {
                label: "先不争论，回房间获得一点安静",
                consequence:
                  "冲突暂时消失，疲惫却留下。你开始分清：低压工作和低耗生活并不是一回事。",
                memory: "与父母产生摩擦时暂时回避，保留当晚的安静",
              },
            ],
          }
        : {
            time: "入职后的一个普通晚上",
            place: "尚未确定的住处",
            title: "工作结束了，生活结构仍然没有被替你写好",
            body: [
              "我们没有预设你住在父母家，也没有替你生成一套房子。",
              "目前只能确定：下班后的时间比现实路径更有边界；这段时间如何转化成生活，仍然未知。",
            ],
            question: "你更想先观察哪一部分？",
            choices: [
              {
                label: "观察独处与自由时间",
                consequence:
                  "时间边界变得清楚，但“有时间”没有自动等于“有想过的生活”。",
                memory: "优先观察这条路的自由时间如何被使用",
              },
              {
                label: "观察家人与原有关系",
                consequence:
                  "关系没有被世界删掉，但靠近、照顾和边界如何同时存在，仍需要后续节点回答。",
                memory: "优先观察回宁波后原有关系如何延续",
              },
            ],
          };

  return [
    {
      time: "两个月前 · Offer 截止日",
      place: "学校宿舍",
      title: "这一次，你点下的是宁波移动",
      body: [
        "确认邮件出现时，房间没有任何变化。你先松了一口气，然后才意识到：小红书从现在开始成为那条没有走过的路。",
        "你放下的不只是更高的收入，也包括 AI 风口带来的想象；你得到的也还不是安稳，只是另一组尚未兑现的条件。",
      ],
      question: "确认以后，你先把这件事告诉谁？",
      choices: [
        {
          label: "给父母打电话，说自己决定回宁波",
          consequence:
            "电话那边的高兴来得很快。你的轻松也是真的，只是这个选择从此进入了家人的期待。",
          memory: "确认移动 Offer 后，先把回宁波的决定告诉父母",
        },
        {
          label: "先告诉同学，承认自己仍然有一点不甘心",
          consequence:
            "你第一次把两种感觉放在一起：想回去是真的，舍不得那条更陡峭的路也是真的。",
          memory: "确认移动 Offer 后，先向同学承认自己的矛盾",
        },
      ],
    },
    rotation,
    home,
    {
      time: "第一次完整发薪日",
      place: "下班前的电梯",
      title: "到账短信让两条人生第一次正面相撞",
      body: [
        "数字落在你当时就知道的大致区间，没有意外。但知道和真正收到，仍是两回事。",
        "你没有立刻后悔，只是重新开始计算：如果去了小红书，会多得到什么，又会拿什么去交换。",
      ],
      question: "这股不甘心出现时，你准备怎样处理？",
      choices: [
        {
          label: "去查内部竞聘与数字化项目",
          consequence:
            "你发现这里不是完全没有变化，但机会有自己的节奏、门槛和关系网络。希望变具体以后，也不再浪漫。",
          memory: "工资落差出现后，开始调查内部发展路径",
        },
        {
          label: "先不追赶，把下班后的时间真正用起来",
          consequence:
            "你拥有了更完整的晚上。但自由时间不会自动变成人生，它仍要被你一次次分配。",
          memory: "工资落差出现后，选择先经营工作之外的时间",
        },
      ],
    },
  ];
}

function App() {
  const [phase, setPhase] = useState<Phase>("intro");
  const [calibrationStep, setCalibrationStep] = useState(0);
  const [calibration, setCalibration] = useState<Calibration>({
    assignment: "",
    housing: "",
    horizon: "",
  });
  const [nodeIndex, setNodeIndex] = useState(0);
  const [selected, setSelected] = useState<WorldChoice | null>(null);
  const [memories, setMemories] = useState<string[]>([]);
  const [echoMessages, setEchoMessages] = useState<
    Array<{ role: "echo" | "user"; text: string }>
  >([]);
  const [draft, setDraft] = useState("");
  const nodes = useMemo(() => buildNodes(calibration), [calibration]);

  function chooseCalibration(value: string) {
    const item = calibrations[calibrationStep];
    const next = { ...calibration, [item.key]: value };
    setCalibration(next);
    if (calibrationStep < calibrations.length - 1) {
      setCalibrationStep((step) => step + 1);
    } else {
      setPhase("world");
    }
  }

  function chooseWorld(choice: WorldChoice) {
    setSelected(choice);
    setMemories((items) => [...items, choice.memory]);
  }

  function advanceWorld() {
    if (nodeIndex < nodes.length - 1) {
      setNodeIndex((index) => index + 1);
      setSelected(null);
    } else {
      setPhase("horizon");
    }
  }

  function meetEcho() {
    setEchoMessages([
      {
        role: "echo",
        text: `我已经生活到「${calibration.horizon}」。我知道自己这边发生过什么，但你在小红书后来到底怎么过，我并不知道。你可以直接问我。`,
      },
    ]);
    setPhase("echo");
  }

  function sendMessage(text = draft) {
    const value = text.trim();
    if (!value) return;
    setEchoMessages((items) => [
      ...items,
      { role: "user", text: value },
      { role: "echo", text: echoReply(value, memories, calibration) },
    ]);
    setDraft("");
  }

  function restart() {
    setPhase("intro");
    setCalibrationStep(0);
    setCalibration({ assignment: "", housing: "", horizon: "" });
    setNodeIndex(0);
    setSelected(null);
    setMemories([]);
    setEchoMessages([]);
    setDraft("");
  }

  return (
    <main className="lab">
      <header className="topbar">
        <button type="button" onClick={restart}>◌ ECHO</button>
        <div>
          <span>AGENT FLOW LAB</span>
          <i />
          <em>{phaseLabel(phase)}</em>
        </div>
      </header>

      {phase === "intro" && (
        <section className="intro panel">
          <p className="eyebrow">不接 3D 前端 · 只测试产品动线</p>
          <h1>先体验一遍，<br />另一条人生怎样被建立。</h1>
          <p className="lead">
            这次使用“小红书 / 宁波移动”的真实 Case。你将依次经历世界种子、关键校准、逐节点生活，以及与那个世界的自己对话。
          </p>
          <button className="primary" type="button" onClick={() => setPhase("seed")}>
            开始 Agent 流 <span>→</span>
          </button>
        </section>
      )}

      {phase === "seed" && (
        <section className="seed panel">
          <p className="eyebrow">GENERAL AGENT / WORLD SEED</p>
          <h2>先确认：我们正在改变哪一个变量？</h2>
          <div className="seed-grid">
            {seedFacts.map(([label, value]) => (
              <article key={label}>
                <small>{label}</small>
                <p>{value}</p>
              </article>
            ))}
          </div>
          <p className="boundary">
            这里只确认岔路与问题，不提前生成“你会不会幸福”的答案。
          </p>
          <div className="actions">
            <button className="secondary" type="button" onClick={restart}>
              这不是我要体验的
            </button>
            <button className="primary" type="button" onClick={() => setPhase("calibration")}>
              准确，开始校准 <span>→</span>
            </button>
          </div>
        </section>
      )}

      {phase === "calibration" && (
        <section className="calibration panel" key={calibrationStep}>
          <p className="eyebrow">{calibrations[calibrationStep].eyebrow}</p>
          <div className="progress">
            {calibrations.map((_, index) => (
              <i className={index <= calibrationStep ? "active" : ""} key={index} />
            ))}
          </div>
          <h2>{calibrations[calibrationStep].question}</h2>
          <p className="lead">{calibrations[calibrationStep].note}</p>
          <div className="option-list">
            {calibrations[calibrationStep].options.map(([label, description]) => (
              <button type="button" key={label} onClick={() => chooseCalibration(label)}>
                <span>{label}</span>
                <small>{description}</small>
                <b>→</b>
              </button>
            ))}
          </div>
        </section>
      )}

      {phase === "world" && (
        <section className="world panel" key={nodeIndex}>
          <div className="world-coordinate">
            <span>{nodes[nodeIndex].time}</span>
            <small>{nodes[nodeIndex].place}</small>
          </div>
          <p className="eyebrow">
            ORACLE / NODE {String(nodeIndex + 1).padStart(2, "0")}
          </p>
          <h2>{nodes[nodeIndex].title}</h2>
          <div className="prose">
            {nodes[nodeIndex].body.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
          </div>
          {!selected ? (
            <div className="world-choice">
              <h3>{nodes[nodeIndex].question}</h3>
              <div className="option-list">
                {nodes[nodeIndex].choices.map((choice) => (
                  <button type="button" key={choice.label} onClick={() => chooseWorld(choice)}>
                    <span>{choice.label}</span><b>→</b>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="consequence">
              <small>你的选择改变了下一段状态</small>
              <p>{selected.consequence}</p>
              <button className="primary" type="button" onClick={advanceWorld}>
                {nodeIndex === nodes.length - 1 ? "抵达观察节点" : "让时间继续"} <span>→</span>
              </button>
            </div>
          )}
          <div className="node-progress">
            {nodes.map((_, index) => <i className={index <= nodeIndex ? "active" : ""} key={index} />)}
          </div>
        </section>
      )}

      {phase === "horizon" && (
        <section className="horizon panel">
          <p className="eyebrow">OBSERVATION TARGET / {calibration.horizon}</p>
          <h2>她没有后悔到想逃，<br />也没有安稳到不再比较。</h2>
          <p className="lead">
            你已经走过这条时间线的四个节点。它们不是人生结论，只是她此刻确实拥有的经历。
          </p>
          <div className="memory-list">
            {memories.map((memory, index) => (
              <p key={memory}><span>0{index + 1}</span>{memory}</p>
            ))}
          </div>
          <div className="horizon-actions">
            <button className="primary" type="button" onClick={meetEcho}>
              和这个世界的我对话 <span>→</span>
            </button>
            <button className="secondary" type="button" onClick={() => {
              setCalibration((value) => ({ ...value, horizon: "五年后" }));
              setPhase("echo");
              setEchoMessages([{
                role: "echo",
                text: "五年后的部分还没有被当作事实写好。我们可以从现在继续往前，但需要保留更多未知。你最想先观察工作、关系，还是我对另一条路的看法？",
              }]);
            }}>
              把时间继续推到五年后
            </button>
          </div>
        </section>
      )}

      {phase === "echo" && (
        <section className="echo panel">
          <div className="echo-head">
            <div className="echo-avatar">◐</div>
            <div>
              <p className="eyebrow">ECHO / PARALLEL SELF</p>
              <h2>选择宁波移动的你</h2>
              <small>只知道这个世界已经发生的经历</small>
            </div>
          </div>
          <div className="chat">
            {echoMessages.map((message, index) => (
              <div className={`message ${message.role}`} key={`${message.role}-${index}`}>
                <small>{message.role === "echo" ? "另一个你" : "现实中的你"}</small>
                <p>{message.text}</p>
              </div>
            ))}
          </div>
          <div className="quick-questions">
            {["你比我更开心吗？", "你会羡慕去了小红书的我吗？", "如果再选一次，你会改变吗？"].map((item) => (
              <button type="button" key={item} onClick={() => sendMessage(item)}>{item}</button>
            ))}
          </div>
          <form onSubmit={(event) => { event.preventDefault(); sendMessage(); }}>
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="直接问她一个问题……"
            />
            <button type="submit">发送</button>
          </form>
          <button className="restart" type="button" onClick={restart}>重新体验动线</button>
        </section>
      )}
    </main>
  );
}

function phaseLabel(phase: Phase) {
  return {
    intro: "入口",
    seed: "世界种子",
    calibration: "现实校准",
    world: "时间线推进",
    horizon: "观察节点",
    echo: "开放对话",
  }[phase];
}

function echoReply(
  message: string,
  memories: string[],
  calibration: Calibration,
) {
  const known = memories[0] || "我确实选择了回宁波";
  if (/开心|幸福|更好/.test(message)) {
    return `我没法把两条人生排个名。至少到「${calibration.horizon}」，我这边有更清楚的生活边界，也有收入和发展上的不甘心。${known}，这是真的；但它不能证明我比你更开心。`;
  }
  if (/羡慕|小红书/.test(message)) {
    return "我会想象，如果当时去了小红书，做的东西是不是更接近行业变化，也更容易感觉自己没有停下来。但这部分主要是我的投射——你后来真实经历了什么，你还没告诉我。";
  }
  if (/后悔|再选|改变/.test(message)) {
    return "我现在不会简单说要改。这里得到的陪伴和时间是真的，反复比较也是真的。如果把这些维护成本都带回 Offer 那天，我可能还是会犹豫，而不是突然知道正确答案。";
  }
  if (/工资|钱|收入/.test(message)) {
    return "到账的那一刻我确实重新算过差额。但让我难受的不全是数字，更像是它把“发展上限”从一句话变成了每个月都会出现的提醒。这个感觉只代表我这边，不是你的结论。";
  }
  if (/五年|以后|未来/.test(message)) {
    return "我还没有活到那里。按现在的状态，内部机会、我怎样使用下班时间、以及家庭边界能不能持续维护，都会改变五年后的样子；我不想把这些条件跳过去编成结局。";
  }
  return `这件事我现在没有足够的经历能说准。至少我这边已经发生的是：${known}。你现实里的那条路，我不想靠想象替你补完。`;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode><App /></StrictMode>,
);
