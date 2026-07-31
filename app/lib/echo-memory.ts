"use client";

const STORAGE_KEY = "echo.personalMemory.v1";

export type MinimalProfile = {
  name: string;
  identity: string;
};

export type MemoryRecord = {
  id: string;
  layer: "core" | "archive";
  truthStatus: "user-stated" | "simulated" | "observed";
  kind: "identity" | "decision" | "motivation" | "attachment" | "world" | "evidence" | "dialogue" | "return";
  content: string;
  source: string;
  createdAt: string;
};

export type PersonalHypothesis = {
  id: string;
  statement: string;
  confidence: number;
  basedOn: string[];
  updatedAt: string;
};

export type EchoMemoryState = {
  version: 1;
  coreMemory: MemoryRecord[];
  archiveMemory: MemoryRecord[];
  personalModel: {
    hypotheses: PersonalHypothesis[];
    lastUpdatedAt: string;
  };
};

export type MemorySnapshot = {
  coreCount: number;
  archiveCount: number;
  hypothesis: string;
  confidence: number;
};

function emptyState(): EchoMemoryState {
  return {
    version: 1,
    coreMemory: [],
    archiveMemory: [],
    personalModel: {
      hypotheses: [],
      lastUpdatedAt: new Date().toISOString(),
    },
  };
}

function canUseStorage() {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}

export function readEchoMemory(): EchoMemoryState {
  if (!canUseStorage()) return emptyState();
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "");
    if (
      parsed?.version === 1 &&
      Array.isArray(parsed.coreMemory) &&
      Array.isArray(parsed.archiveMemory) &&
      Array.isArray(parsed.personalModel?.hypotheses)
    ) {
      return parsed as EchoMemoryState;
    }
  } catch {
    // A damaged local snapshot should never block the experience.
  }
  return emptyState();
}

function writeEchoMemory(state: EchoMemoryState) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function record(
  layer: MemoryRecord["layer"],
  truthStatus: MemoryRecord["truthStatus"],
  kind: MemoryRecord["kind"],
  content: string,
  source: string,
): MemoryRecord {
  return {
    id: `${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    layer,
    truthStatus,
    kind,
    content: content.trim(),
    source,
    createdAt: new Date().toISOString(),
  };
}

function upsertByKind(records: MemoryRecord[], next: MemoryRecord) {
  return [...records.filter((item) => item.kind !== next.kind), next];
}

export function rememberOnboarding(
  profile: MinimalProfile,
  answers: string[],
): EchoMemoryState {
  const state = readEchoMemory();
  let core = state.coreMemory;
  core = upsertByKind(
    core,
    record(
      "core",
      "user-stated",
      "identity",
      `${profile.name}；当前身份：${profile.identity}`,
      "arrival",
    ),
  );
  core = upsertByKind(
    core,
    record(
      "core",
      "user-stated",
      "decision",
      `未选择：${answers[0]}；现实选择：${answers[1]}`,
      "world-seed-interview",
    ),
  );
  core = upsertByKind(
    core,
    record(
      "core",
      "user-stated",
      "motivation",
      answers[2],
      "world-seed-interview",
    ),
  );
  core = upsertByKind(
    core,
    record(
      "core",
      "user-stated",
      "attachment",
      answers[3],
      "world-seed-interview",
    ),
  );

  const hypothesis: PersonalHypothesis = {
    id: "choice-pattern-v1",
    statement: `你在选择里可能反复权衡“${answers[0]}”与“不失去${answers[3]}”。`,
    confidence: 0.42,
    basedOn: core
      .filter((item) => ["decision", "motivation", "attachment"].includes(item.kind))
      .map((item) => item.id),
    updatedAt: new Date().toISOString(),
  };

  const next: EchoMemoryState = {
    ...state,
    coreMemory: core,
    personalModel: {
      hypotheses: [
        ...state.personalModel.hypotheses.filter(
          (item) => item.id !== hypothesis.id,
        ),
        hypothesis,
      ],
      lastUpdatedAt: hypothesis.updatedAt,
    },
  };
  writeEchoMemory(next);
  return next;
}

export function rememberGeneratedWorld(world: {
  seed: string;
  truth: string;
  changedVariable: string;
}): EchoMemoryState {
  const state = readEchoMemory();
  const worldRecord = record(
    "archive",
    "simulated",
    "world",
    `${world.seed}；模拟中的暂时发现：${world.truth}`,
    `world:${world.changedVariable}`,
  );
  const next = {
    ...state,
    archiveMemory: [...state.archiveMemory, worldRecord].slice(-80),
  };
  writeEchoMemory(next);
  return next;
}

export function rememberWorldEvidence(item: {
  id: string;
  name: string;
  role: string;
}): EchoMemoryState {
  const state = readEchoMemory();
  const evidence = record(
    "archive",
    "simulated",
    "evidence",
    `${item.name}（${item.role}）`,
    `world-evidence:${item.id}`,
  );
  const next = {
    ...state,
    archiveMemory: [...state.archiveMemory, evidence].slice(-80),
  };
  writeEchoMemory(next);
  return next;
}

export function rememberParallelDialogue(
  userMessage: string,
  selfReply: string,
): EchoMemoryState {
  const state = readEchoMemory();
  const dialogue = record(
    "archive",
    "simulated",
    "dialogue",
    `现在的我问：${userMessage}；平行自我回答：${selfReply}`,
    "parallel-self-dialogue",
  );
  const next = {
    ...state,
    archiveMemory: [...state.archiveMemory, dialogue].slice(-80),
  };
  writeEchoMemory(next);
  return next;
}

export function rememberReturnNote(note: string): EchoMemoryState {
  const content = note.trim();
  if (!content) return readEchoMemory();
  const state = readEchoMemory();
  const next = {
    ...state,
    coreMemory: [
      ...state.coreMemory,
      record("core", "user-stated", "return", content, "return-to-now"),
    ].slice(-80),
  };
  writeEchoMemory(next);
  return next;
}

export function snapshotEchoMemory(
  state: EchoMemoryState = readEchoMemory(),
): MemorySnapshot {
  const latest = state.personalModel.hypotheses.at(-1);
  return {
    coreCount: state.coreMemory.length,
    archiveCount: state.archiveMemory.length,
    hypothesis: latest?.statement || "还没有足够证据形成任何假设。",
    confidence: latest?.confidence || 0,
  };
}
