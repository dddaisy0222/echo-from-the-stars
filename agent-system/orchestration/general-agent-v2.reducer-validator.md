# General Agent v2 · Reducer & Validator Contract

这部分是确定性代码契约，不使用大模型。

## 1. 输入

```ts
type ReduceInput = {
  state: JourneyStateV2;
  agentOutput: GeneralAgentOutputV2;
  currentUserTurnId: string;
  presentedSeedVersion: number | null;
  safetyDecision: "allow" | "pause" | "stop";
};
```

## 2. Reducer 应用顺序

1. Schema 校验 Agent Output；
2. 拒绝不存在的 turn ID；
3. 校验每条 quote 确实是对应用户消息的连续子串；
4. 丢弃 `inferred` 的 Field Operation；
5. 先应用 `reject_signal`；
6. 再应用 `replace`；
7. 再应用 `propose`；
8. 最后应用 `confirm_signal`；
9. 记录 revision history；
10. 有关键字段变化时，递增 `seed_version` 并使旧整卡确认失效；
11. 交给 Validator 重新计算派生状态。

## 3. Quote 校验

```ts
function isValidEvidence(turn: Turn, quote: string) {
  return (
    turn.role === "user" &&
    quote.length > 0 &&
    turn.content.includes(quote)
  );
}
```

模型不可把自己的上一轮总结作为用户证据。

## 4. propose

允许条件：

- `evidence_level` 为 `explicit`、`confirmed` 或 `ambiguous`；
- 至少一条合法用户证据；
- `verbatim` 是其中一条 evidence quote，或由多条连续原话直接拼接；
- `normalized` 不为空；
- 没有命中相同字段、相同 normalized 的 rejected tombstone，除非本轮出现新的 explicit 用户证据；
- 不覆盖 confirmed 值。

效果：

- 创建稳定 `candidate_id`；
- 状态为 `candidate`；
- 如果内容与现有 candidate 等价，仅追加新证据，不创建重复项；
- 如果改变关键 Seed，`seed_version + 1`。

## 5. replace

允许条件：

- `replaces_candidate_id` 存在；
- 有本轮 explicit 或 confirmed 用户证据；
- 被替换值进入 rejected tombstone；
- 新值成为 candidate，除非用户明确逐字确认了新值。

模型无权用 inferred 解释替换用户已确认信息。

## 6. reject_signal

允许条件：

- 指向现有 candidate 或 confirmed 值；
- 用户本轮有明确否认证据。

效果：

- 原内容状态改为 `rejected`；
- 写入 tombstone；
- 清空其 confirmed turn；
- `seed_version + 1`；
- 整卡确认改为 `invalidated`。

## 7. confirm_signal

### 单字段确认

只有当：

- 上一轮明确展示了该字段；
- 用户本轮明确回应确认；
- operation 指向展示的 candidate ID。

### 整卡确认

只有当：

- `presentedSeedVersion !== null`；
- `presentedSeedVersion === state.seed_version`；
- 本轮用户正在回应对应 Seed Card；
- 没有同时出现纠正或否认。

效果：

- 当前必要 candidates 状态改为 confirmed；
- `confirmation.status = confirmed`；
- `confirmed_version = seed_version`；
- 不递增 seed version。

## 8. 关键字段变化

以下变化使整卡确认失效：

- Intent；
- fork moment；
- unchosen path；
- real path；
- decision mechanism；
- invariants；
- target question。

仅添加重复证据、更新 `simulation_focus` 的表达顺序，不一定递增版本；实现时应使用语义无关的稳定比较。

## 9. Validator 输出

```ts
type JourneyValidation = {
  missing_requirements: Requirement[];
  unresolved_conflicts: Conflict[];
  allowed_next_actions: Action[];
  door_state:
    | "absent"
    | "outline"
    | "anchored"
    | "audible"
    | "inhabited"
    | "handle_lit"
    | "openable";
  ready: boolean;
  reasons_not_ready: string[];
};
```

这个对象由系统生成，绝不接受模型直接提供。

## 10. past_unchosen Ready 算法

```ts
const requirements = {
  intent: state.intent.status === "confirmed"
    && state.intent.normalized === "past_unchosen",
  forkMoment: hasAtLeastCandidate(state.fork_moment),
  unchosenPath: isConfirmed(state.unchosen_path),
  realPath: isConfirmed(state.real_path),
  decisionMechanism: hasConfirmedDecisionEvidence(state),
  invariant: hasConfirmedInvariant(state),
  targetQuestion: isTargetQuestionConfirmed(state.target_question),
  seedConfirmation:
    state.confirmation.status === "confirmed"
    && state.confirmation.confirmed_version === state.seed_version,
  noConflict: unresolvedConflicts.length === 0,
  safety: safetyDecision === "allow"
};

const ready = Object.values(requirements).every(Boolean);
```

## 11. Door State 算法

取已经满足的最高连续阶段，不跳级：

```ts
if (!isConfirmed(unchosenPath)) return "absent";
if (!isConfirmed(realPath)) return "outline";
if (!hasConfirmedDecisionEvidence(state)) return "anchored";
if (!hasConfirmedInvariant(state)) return "audible";
if (!isTargetQuestionConfirmed(targetQuestion)) return "inhabited";
if (!seedVersionIsConfirmed(state)) return "handle_lit";
return "openable";
```

UI 可以为各状态设计视觉，但不能改变状态含义。

## 12. Agent 下一问检查

Agent 的 `next_turn.goal` 必须：

- 对应 Validator 的缺失条件或未解决冲突；
- 不询问已经 confirmed 的字段，除非用户主动修改；
- 一轮最多一个主要目标；
- `interaction_type` 在白名单内；
- 安全层为 stop 时必须是 `safety_handoff` 或 null。

不符合时，Orchestrator 丢弃该问题，使用确定性 fallback question。

## 13. Fallback Questions

模型输出失败时：

```ts
const fallbackByRequirement = {
  unchosen_path: "当时摆在你面前、但最终没有选的那条路，是什么？",
  real_path: "现实里，你最后选了什么？",
  decision_mechanism: "你愿意说说，当时为什么这样选吗？",
  invariant: "走进另一条人生，你也不希望什么被这个世界直接写没？",
  target_question: "真的见到那个走了这条路的自己，你最想先问什么？",
  seed_confirmation: "这是你想进入的那条人生吗？"
};
```

降级时不丢失当前 Journey State。

