import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import "./style.css";

type Phase = "intro" | "seed" | "calibration" | "world" | "horizon" | "echo";
type Seed = {
  title: string;
  fields: Array<{ label: string; value: string }>;
  boundary: string;
};
type CalibrationQuestion = {
  topic: string;
  eyebrow: string;
  question: string;
  note: string;
  options: Array<{ label: string; value: string; description: string }>;
};
type Choice = {
  id: string;
  label: string;
  action: string;
  doesNotGuarantee: string;
};
type Node = {
  id: string;
  time: string;
  place: string;
  title: string;
  paragraphs: string[];
  question: string;
  choices: Choice[];
  unresolved: string;
};
type CalibrationAnswer = { topic: string; label: string; value: string };
type NodeMemory = {
  nodeId: string;
  title: string;
  choice: string;
  consequence: string;
};
type ChatMessage = { role: "user" | "echo"; text: string };

const CASE_CONTEXT = {
  currentIdentity: "刚毕业、正在适应第一份工作的 AI 产品经理",
  forkMoment: "两个月前，校招毕业时同时面对两份 Offer",
  realPath: "选择小红书的 AI 产品岗位",
  unchosenPath: "选择宁波移动的校招岗位",
  decisionMechanism:
    "当时更看重 AI 风口、收入和未来发展上限，也担心移动的生活一眼望到头",
  targetQuestion:
    "如果当时选择移动，那条人生会怎样真实展开？那里的我会更开心吗？她是否也会美化没有选择的小红书？",
};

function App() {
  const [phase, setPhase] = useState<Phase>("intro");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [seed, setSeed] = useState<Seed | null>(null);
  const [calibrationStep, setCalibrationStep] = useState(0);
  const [calibrationQuestion, setCalibrationQuestion] =
    useState<CalibrationQuestion | null>(null);
  const [calibration, setCalibration] = useState<CalibrationAnswer[]>([]);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [currentNode, setCurrentNode] = useState<Node | null>(null);
  const [selectedChoice, setSelectedChoice] = useState<Choice | null>(null);
  const [consequence, setConsequence] = useState("");
  const [memories, setMemories] = useState<NodeMemory[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");

  async function start() {
    await run(async () => {
      const result = await api<{ seed: Seed }>("general", {
        caseContext: CASE_CONTEXT,
      });
      setSeed(result.seed);
      setPhase("seed");
    });
  }

  async function beginCalibration() {
    await loadCalibration(0, []);
  }

  async function loadCalibration(
    step: number,
    answers: CalibrationAnswer[],
  ) {
    await run(async () => {
      const result = await api<{ question: CalibrationQuestion }>(
        "calibrate",
        {
          caseContext: CASE_CONTEXT,
          seed,
          step,
          answers,
        },
      );
      setCalibrationStep(step);
      setCalibrationQuestion(result.question);
      setPhase("calibration");
    });
  }

  async function chooseCalibration(
    option: CalibrationQuestion["options"][number],
  ) {
    if (!calibrationQuestion) return;
    const next = [
      ...calibration,
      {
        topic: calibrationQuestion.topic,
        label: option.label,
        value: option.value,
      },
    ];
    setCalibration(next);
    if (calibrationStep < 2) {
      await loadCalibration(calibrationStep + 1, next);
      return;
    }
    await initializeWorld(next);
  }

  async function initializeWorld(answers: CalibrationAnswer[]) {
    await run(async () => {
      const result = await api<{ node: Node }>("oracle_initialize", {
        caseContext: CASE_CONTEXT,
        seed,
        calibration: answers,
      });
      setNodes([result.node]);
      setCurrentNode(result.node);
      setSelectedChoice(null);
      setConsequence("");
      setPhase("world");
    });
  }

  async function commitChoice(choice: Choice) {
    if (!currentNode) return;
    await run(async () => {
      const result = await api<{ consequence: string }>("render_consequence", {
        caseContext: CASE_CONTEXT,
        calibration,
        nodes,
        node: currentNode,
        choice,
      });
      setSelectedChoice(choice);
      setConsequence(result.consequence);
    });
  }

  async function advanceWorld() {
    if (!currentNode || !selectedChoice) return;
    const nextMemory: NodeMemory = {
      nodeId: currentNode.id,
      title: currentNode.title,
      choice: selectedChoice.label,
      consequence,
    };
    const nextMemories = [...memories, nextMemory];
    setMemories(nextMemories);

    if (nodes.length >= 4) {
      setPhase("horizon");
      return;
    }

    await run(async () => {
      const result = await api<{ node: Node }>("oracle_advance", {
        caseContext: CASE_CONTEXT,
        seed,
        calibration,
        nodes,
        memories: nextMemories,
        trigger: nextMemory,
      });
      const nextNodes = [...nodes, result.node];
      setNodes(nextNodes);
      setCurrentNode(result.node);
      setSelectedChoice(null);
      setConsequence("");
    });
  }

  async function meetEcho() {
    await run(async () => {
      const result = await api<{ reply: string }>("echo", {
        caseContext: CASE_CONTEXT,
        calibration,
        memories,
        conversation: [],
        message: "我们终于见面了。你想先对我说什么？",
        opening: true,
      });
      setMessages([{ role: "echo", text: result.reply }]);
      setPhase("echo");
    });
  }

  async function sendMessage(input = draft) {
    const text = input.trim();
    if (!text || loading) return;
    const nextConversation = [...messages, { role: "user" as const, text }];
    setMessages(nextConversation);
    setDraft("");
    await run(async () => {
      const result = await api<{ reply: string }>("echo", {
        caseContext: CASE_CONTEXT,
        calibration,
        memories,
        conversation: nextConversation,
        message: text,
      });
      setMessages((items) => [...items, { role: "echo", text: result.reply }]);
    });
  }

  function restart() {
    setPhase("intro");
    setSeed(null);
    setCalibrationStep(0);
    setCalibrationQuestion(null);
    setCalibration([]);
    setNodes([]);
    setCurrentNode(null);
    setSelectedChoice(null);
    setConsequence("");
    setMemories([]);
    setMessages([]);
    setDraft("");
    setError("");
  }

  async function run(task: () => Promise<void>) {
    setLoading(true);
    setError("");
    try {
      await task();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Agent 暂时没有回应。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="lab">
      <header className="topbar">
        <button type="button" onClick={restart}>◌ ECHO</button>
        <div>
          <span>LIVE AGENT FLOW</span><i /><em>{phaseLabel(phase)}</em>
        </div>
      </header>

      {error && <div className="api-error">{error}</div>}
      {loading && (
        <div className="agent-thinking">
          <i /><span>Agent 正在根据你已经确认的状态继续推演……</span>
        </div>
      )}

      {phase === "intro" && (
        <section className="intro panel">
          <p className="eyebrow">REAL MODEL API · GENERAL → ORACLE → ECHO</p>
          <h1>不看前端，<br />先验证灵魂。</h1>
          <p className="lead">
            这不是写死的剧情。每一次校准、每一个人生节点，以及“另一个你”的回答，都会由 Agent 根据当前状态实时生成。
          </p>
          <button className="primary" type="button" onClick={start} disabled={loading}>
            运行 General Agent <span>→</span>
          </button>
        </section>
      )}

      {phase === "seed" && seed && (
        <section className="seed panel">
          <p className="eyebrow">GENERAL AGENT / WORLD SEED</p>
          <h2>{seed.title}</h2>
          <div className="seed-grid">
            {seed.fields.map((field) => (
              <article key={field.label}>
                <small>{field.label}</small><p>{field.value}</p>
              </article>
            ))}
          </div>
          <p className="boundary">{seed.boundary}</p>
          <div className="actions">
            <button className="secondary" type="button" onClick={restart}>不准确，重新开始</button>
            <button className="primary" type="button" onClick={beginCalibration} disabled={loading}>
              准确，交给 Oracle 校准 <span>→</span>
            </button>
          </div>
        </section>
      )}

      {phase === "calibration" && calibrationQuestion && (
        <section className="calibration panel" key={`${calibrationStep}-${calibrationQuestion.topic}`}>
          <p className="eyebrow">{calibrationQuestion.eyebrow}</p>
          <div className="progress">
            {[0, 1, 2].map((index) => <i className={index <= calibrationStep ? "active" : ""} key={index} />)}
          </div>
          <h2>{calibrationQuestion.question}</h2>
          <p className="lead">{calibrationQuestion.note}</p>
          <div className="option-list">
            {calibrationQuestion.options.map((option) => (
              <button type="button" key={option.value} onClick={() => chooseCalibration(option)} disabled={loading}>
                <span>{option.label}</span><small>{option.description}</small><b>→</b>
              </button>
            ))}
          </div>
        </section>
      )}

      {phase === "world" && currentNode && (
        <section className="world panel" key={currentNode.id}>
          <div className="world-coordinate">
            <span>{currentNode.time}</span><small>{currentNode.place}</small>
          </div>
          <p className="eyebrow">ORACLE / NODE {String(nodes.length).padStart(2, "0")}</p>
          <h2>{currentNode.title}</h2>
          <div className="prose">
            {currentNode.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
          </div>
          {!selectedChoice ? (
            <div className="world-choice">
              <h3>{currentNode.question}</h3>
              <div className="option-list">
                {currentNode.choices.map((choice) => (
                  <button type="button" key={choice.id} onClick={() => commitChoice(choice)} disabled={loading}>
                    <span>{choice.label}</span>
                    <small>{choice.action}<br />不保证：{choice.doesNotGuarantee}</small><b>→</b>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="consequence">
              <small>CHOICE COMMITTED / 状态已经改变</small>
              <p>{consequence}</p>
              <button className="primary" type="button" onClick={advanceWorld} disabled={loading}>
                {nodes.length >= 4 ? "抵达观察节点" : "让 Oracle 生成下一节点"} <span>→</span>
              </button>
            </div>
          )}
          <p className="unresolved">仍未解决：{currentNode.unresolved}</p>
          <div className="node-progress">
            {[0, 1, 2, 3].map((index) => <i className={index < nodes.length ? "active" : ""} key={index} />)}
          </div>
        </section>
      )}

      {phase === "horizon" && (
        <section className="horizon panel">
          <p className="eyebrow">OBSERVATION TARGET REACHED</p>
          <h2>这不是结局。<br />只是她已经活过的部分。</h2>
          <p className="lead">Echo 只能读取下面这些已提交经历。她不知道现实中的你后来具体怎样生活，除非你亲口告诉她。</p>
          <div className="memory-list">
            {memories.map((memory, index) => (
              <p key={memory.nodeId}><span>0{index + 1}</span>{memory.title} · {memory.choice}</p>
            ))}
          </div>
          <button className="primary" type="button" onClick={meetEcho} disabled={loading}>
            调用 Echo Agent <span>→</span>
          </button>
        </section>
      )}

      {phase === "echo" && (
        <section className="echo panel">
          <div className="echo-head">
            <div className="echo-avatar">◐</div>
            <div>
              <p className="eyebrow">ECHO / PARALLEL SELF</p>
              <h2>选择宁波移动的你</h2>
              <small>实时模型 · 有限记忆 · 不知道你的现实结局</small>
            </div>
          </div>
          <div className="chat">
            {messages.map((message, index) => (
              <div className={`message ${message.role}`} key={`${message.role}-${index}`}>
                <small>{message.role === "echo" ? "另一个你" : "现实中的你"}</small>
                <p>{message.text}</p>
              </div>
            ))}
          </div>
          <div className="quick-questions">
            {["你比我更开心吗？", "你会羡慕去了小红书的我吗？", "如果再选一次呢？"].map((question) => (
              <button type="button" key={question} onClick={() => sendMessage(question)} disabled={loading}>{question}</button>
            ))}
          </div>
          <form onSubmit={(event) => { event.preventDefault(); sendMessage(); }}>
            <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="直接问她……" disabled={loading} />
            <button type="submit" disabled={loading}>发送</button>
          </form>
          <button className="restart" type="button" onClick={restart}>重新体验</button>
        </section>
      )}
    </main>
  );
}

async function api<T>(action: string, payload: Record<string, unknown>): Promise<T> {
  const response = await fetch("/api/flow", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...payload }),
  });
  const result = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(result.error || `Agent API ${response.status}`);
  return result;
}

function phaseLabel(phase: Phase) {
  return {
    intro: "入口", seed: "General", calibration: "Oracle 校准",
    world: "Oracle 世界推进", horizon: "观察节点", echo: "Echo 对话",
  }[phase];
}

createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
