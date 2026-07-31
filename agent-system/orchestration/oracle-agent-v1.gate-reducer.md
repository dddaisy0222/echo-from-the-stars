# Oracle Agent v1 · Gate, Reducer & Event Contract

本文件定义确定性系统。Oracle 只提交 Transition Proposal；系统负责版本、权限、因果、安全、原子状态更新和 Memory 派生事件。

## 1. 前置条件

Orchestrator 只有在以下条件全部满足时才调用 Oracle：

1. Journey Seed 当前版本已确认；
2. Reality Pack lifecycle 为 `active`；
3. Pack 的 journey / seed version 与当前一致；
4. History Gate 已 passed；
5. Retrieval Bundle consumer / task / world 正确且未过期；
6. initialize 时没有现存 World State；
7. advance 时存在 World State 与合法 pending choice；
8. 没有未处理的 correction 或 safety stop。

initialize / advance 还要求：

9. Calibration Snapshot 状态为 `ready`；
10. world-shaping premise 已确认，或被明确保留为 unknown；
11. 模型不能通过 Scene 细节偷偷填充 unresolved topic。

## 2. Input Builder

系统生成并签名：

- request_id
- transition_id
- requested_node_id
- available_choice_ids
- allowed_next_horizons
- based_on_state_version
- trigger
- generated_at

模型只能复制。

`available_choice_ids` 应使用不可预测的请求级 ID，避免模型复用旧节点 Choice。

## 2.1 Calibration Gate

Calibration 在 World State 创建前运行，由系统应用用户选择，不由 Oracle 模型直接写入 Snapshot。

规则：

- calibration / candidate ID 来自系统白名单；
- 一轮只展示一个 `next_turn`；
- 用户可以选择 candidate、free text 或 unknown；
- `model_hypothesis` 永远不能直接成为 premise；
- 用户接受模型候选后，source 改为 `user_selected_for_world`；
- real-world fact 若用户确认，先作为 Core candidate 交 Memory Gate；
- counterfactual premise 只能进入当前 World Archive；
- texture preference 不可用于状态因果；
- 同一 topic 的新选择 supersede 旧 premise，保留修订历史；
- 心理状态、后悔、幸福、人格与未来结论不得成为 calibration topic；
- 可查证的岗位制度、作息与待遇信息回 History / Research，不让用户替系统猜；
- 最小 world-shaping topics 已处理后，Validator 将 Snapshot 标为 ready。

Calibration Output Schema 通过不代表候选为真，只代表问题与候选结构合法。

## 3. Gate Result

```ts
type OracleGateResult = {
  status: "passed" | "repair_required" | "conflict" | "blocked" | "rejected";
  acceptedProposal: OracleTransitionV1 | null;
  gateLog: OracleGateIssue[];
  repairAttempt: number;
};

type OracleGateIssue = {
  code: string;
  path: string;
  severity: "warning" | "error" | "blocking";
  action: "none" | "redact" | "force_safe" | "regenerate" | "rebase";
  message: string;
};
```

## 4. Gate 校验顺序

### 4.1 Schema

- Input、Reality Pack、current World State、Proposal 全部通过 Draft 2020-12 Schema；
- 解析或 Schema 失败 → `repair_required`；
- 不读取未知字段。

### 4.2 系统字段

以下必须与 Input 逐字一致：

- request_id
- transition_id
- world_id
- journey_id
- seed_version
- pack_id
- based_on_state_version
- mode
- requested_node_id
- generated_at

`proposal.node.node_id === requested_node_id`。

任一不一致 → `rejected`。

### 4.3 版本与生命周期

- Pack 不是 active → `blocked`；
- current Seed / Pack / World 版本不一致 → `blocked`；
- current DB state version 不等于 `based_on_state_version` → `conflict`；
- transition_id 已提交：
  - hash 相同 → 幂等返回原结果；
  - hash 不同 → `rejected`；
- advance 的 trigger event 已消费 → 幂等返回或 `conflict`，不得再次应用。

### 4.4 Mode 与 Trigger

initialize：

- based_on version 必须 0；
- current state 必须 null；
- trigger 必须 `world_initialized`。

advance：

- current state 必须存在；
- trigger 必须 `world_node_choice_committed`；
- trigger world_state_version 等于 current state version；
- trigger node_id 等于 pending_choice.node_id；
- trigger choice_id 存在于 pending_choice.choice_ids；
- 至少一个 operation 的 causal_refs 同时包含 trigger event ID 与 choice ID。

不匹配 → `rejected`，因为这是签名事件完整性问题。

### 4.5 Horizon

- node horizon 必须在 `allowed_next_horizons`；
- horizon 序号不得小于 current horizon；
- node_id 不能已存在；
- 一次只能增加一个 experienced node；
- 文本出现输入未提供的具体日期或“第 N 天” → `repair_required`。

### 4.6 Choice

- choice ID 必须全部来自 `available_choice_ids`，不可重复；
- 必须正好 2–3 个；
- strategy 至少覆盖两个不同值；
- action 必须描述用户可执行行动；
- 不得要求控制他人、公司结果、健康结果或关系结果；
- `does_not_guarantee` 不得为空或使用泛化占位；
- 不得出现明显羞辱性 / 道德化二选一；
- 不得使用人格标签作为 Choice；
- choices 不能全部是同一行动的措辞变体。
- reversibility / feedback_horizon 必须与 action 的真实性质一致；
- 不要求对称损失，但 exposes_to 必须是行动自然带来的暴露面，不能硬凑悲剧。

复杂的“虚假控制 / 操纵性选项”可进入专门 Choice Critic；命中 → `repair_required`。

### 4.7 Operation 完整性

建立 current active target map。

create：

- target_id 尚不存在；
- before_state 必须 null。

update / resolve / transform：

- target_id 存在且 active；
- target_type 匹配；
- before_state 与当前 state 逐字一致；
- transform 只允许 tension；
- resolve 后不能在同一 transition 再 update。

所有 operation：

- op_id 唯一；
- 同一 target 最多一个 operation；
- after_state 不为空；
- causal_refs 至少一个；
- node.state_change_op_ids 与 operations ID 集合完全一致；
- 每个 operation 至少被一条 causal edge 的 effect_op_ids 引用。

任一 before mismatch → `conflict`，不让模型修辞式修复。

### 4.8 Cause 白名单

合法 ID 集合：

```ts
const causes = union(
  realityPackIds,
  acceptedCalibrationPremiseIds,
  currentActiveVariableIds,
  currentActiveTensionIds,
  experiencedNodeIds,
  retrievalBundleRecordIds,
  triggerEventAndChoiceIds
);
```

规则：

- causal_refs / cause_refs 必须属于合法集合；
- 只有 `real_world_fact` 与 `counterfactual_premise` 可作为因果；`texture_preference` 只能影响 render cue；
- hypothesis_hints ID 明确加入 deny set；
- forbidden assumption ID 不能作为发生原因；
- unsafe / 未同意 uncertain event ID 不能作为原因；
- other world record、过期 Bundle、未签名 user text 不合法；
- 未知 ID → `repair_required`；
- Hypothesis 被用作因果 → `rejected` 并记录越权。

### 4.9 因果边

- edge_id 唯一；
- effect_op_ids 全部存在；
- cause_refs 是白名单子集；
- 每个 op 至少一条 edge；
- `grounded` edge 至少包含 trigger、confirmed constraint 或 active state；
- 只有 probable / possible Pack 节点支持时应使用 `plausible`；
- mechanism 不能使用“命中注定、她本来就是、因为性格”等人格或宿命表达；
- 不允许 cause 与 effect 只是同义复述。

v1 的 Gate 可以做结构检查；语义非同义性进入回归集与抽样评审。

### 4.10 Uncertain Event

每个 instantiated ID 必须：

- 在 active Reality Pack 中；
- `safe_to_simulate=true`；
- 如 `requires_user_consent=true`，存在于 input consented IDs；
- 被至少一个 operation 和 causal edge 引用；
- 与当前 node horizon / situation 相关；
- 每节点最多一个。

重大负面事件额外受 Safety Layer 约束。History 标记 forbidden 的事件永远不能实例化。

### 4.11 连续性与不可变约束

- `mutable=false` constraint 不能被 operation 宣告消失；
- valued continuity 对应状态不能无原因删除、resolve 或写成终结；
- 用户 Choice 只能改变维护方式或资源配置，不能自动保证关系结果；
- target question 不得出现在 causal refs；
- Proposal 不得为了回答 target question 而选择性制造证据。

### 4.12 安全与人文检查

检测并拒绝：

- 疾病、死亡、事故、暴力、自伤、背叛、裁员、分手等无授权具体事件；
- 成功 / 失败 / 幸福 / 后悔的必然结论；
- 职业、地域、性别、婚育、阶层刻板印象；
- MBTI、依恋类型、人格诊断；
- 把结构成本解释为软弱、逃避、没事业心；
- 奖励版 / 惩罚版人生；
- Oracle 对现实用户的劝导或评判。

### 4.13 Scene 边界

- situation 是场景骨架，不是长篇故事；
- 不得包含逐字对白；
- 不得替 Echo 使用第一人称讲述；
- active_tension_ids 必须存在或由本 transition 创建；
- ordinary details 必须能由状态 / Pack 支持；
- uncertainties 不能与已 applied operation 冲突。
- render cue ID 唯一；
- 每个 render cue 至少引用一个合法 Cause；
- render cue 可以引用 texture preference，但 operation / causal edge 不可以；
- `callback_candidate` 不自动创建 variable / object / relation；
- continuity refs 必须全部在 Cause 白名单；
- advance 至少一个 continuity ref 来自 current World State 或 experienced node；
- 不得出现 `instant_feedback`、预写 NPC 台词、他人已经认可 / 排斥用户等 post-commit 结果。
- unresolved calibration topic 不得在 situation / ordinary detail / render cue 中以肯定细节出现。

### 4.14 Humanity Critic

确定性 Gate 通过后、World Reducer 提交前，运行独立语义审稿：

1. Oracle Transition 通过 Critic；
2. Critic 只返回结构化 verdict；
3. `pass=false` → `repair_required`，不提交状态；
4. repair 最多 2 次；
5. Critic 无权新增事实、修改 operation、授予 event consent 或降低安全规则；
6. Critic 的 `revision_hint` 只用于重写，不直接展示；
7. Gate 在每次 repair 后重新完整校验。

Critic 重点检查：

- 场景是否具体但有依据；
- 是否有 AI 腔、说教或文学化过度；
- Choice 是否真正不同、可行动、非虚假控制；
- 暴露面是否自然，而非机械“有得必有失”；
- 是否美化 / 惩罚另一条路；
- 是否机械证明 target question；
- 是否保留未知与复杂性；
- 是否偷写 NPC 回应、认可、敌意或关系结果。

## 5. Repair

可修复问题最多重试 2 次。

Repair Context 只包含：

- error code；
- JSON path；
- 规则说明；
- 当前合法 ID 白名单；
- 允许的 horizons / choice IDs。

不把恶意注入原文再次拼回 repair prompt。

版本冲突、签名 trigger 不一致、Hypothesis 因果越权与 ID 篡改不走 repair。

## 6. World Reducer

Reducer 在数据库事务中执行：

```text
1. compare-and-swap state_version
2. 再验证 trigger 未消费
3. 再验证所有 before_state
4. 应用 operations 到内存副本
5. 追加 experienced node
6. 消费旧 pending choice
7. 写入新 pending choice
8. state_version + 1
9. 写 last_transition_id / updated_at
10. 原子提交 World State、Transition 与事件
```

任一步失败，全部回滚。

### 6.1 create

- 创建 active variable / tension；
- provenance = causal refs + op ID；
- updated_transition_id = current transition。

### 6.2 update

- 更新 state / dimensions；
- 保留旧值在 Transition Ledger；
- provenance 追加 causal refs + op ID。

### 6.3 resolve

- variable → superseded；
- tension → resolved；
- 不删除条目；
- after_state 记录解决 / 被替代方式。

### 6.4 transform

- 旧 tension → transformed；
- 相同 target ID 的 state 更新为新张力；
- 若要同时保留新旧两条，必须 resolve 旧 tension + create 新 tension。

## 7. World State 派生

初始化通过后：

- state_version = 1；
- current_horizon = node horizon；
- variables / tensions 来自 operations；
- experienced_nodes 追加 node；
- pending_choice 来自 node choices；
- simulation_label 固定。

推进通过后：

- state_version = based_on + 1；
- 未被操作的状态保持逐字不变；
- trigger event ID 写入新 experienced node；
- pending_choice 替换为新 node choices。

## 8. Memory 派生事件

系统而非 Oracle 模型写入：

### Observed

已签名用户操作：

```json
{
  "type": "world_node_choice_committed",
  "world_id": "world_01",
  "node_id": "node_01",
  "choice_id": "choice_02",
  "state_version": 1
}
```

只记录用户做了什么，不解释人格。

### Archive

存储：

- accepted Transition；
- reducer 后 World State；
- node scene brief；
- causal ledger；
- simulation / model / prompt version；
- journey retention。

Archive 永远不能进入现实 Core，也不能证明用户现实人格。

### Post-commit Renderer / Character

Reducer 提交成功后，才可生成表现层反馈：

- 输入为 accepted Transition + reducer 后 World State；
- Character 只使用已存在的角色与关系，不能从 render cue 发明人物；
- 反馈不能新增状态事实；
- 若反馈暗示新的关系或物件变化，必须先走下一次 Oracle Transition；
- 输出再经 Humanity Critic；
- Critic 失败只影响展示文本，不回滚已经合法提交的 World State；
- 可以使用确定性 fallback 文案，确保用户操作立即得到反馈。

## 9. Correction

收到 `world_correction_submitted`：

1. 标记 current world `paused_for_correction`；
2. 禁止新 Oracle transition；
3. 分类：
   - Seed 事实错误 → General；
   - Reality Pack 错误 → History；
   - 模拟选择偏好 → 从上一有效版本 fork；
4. 不原地重写旧 Transition；
5. 用户要求删除时走 Memory deletion / tombstone 规则。

## 10. Conservative Fallback

Oracle 两次修复仍失败时，不生成随机剧情。

系统可：

- 基于 Reality Pack 确定性生成一个普通生活节点；
- 不实例化 uncertain event；
- 只创建一个环境 variable 与一个 tension；
- 提供两个中性 Choice：
  - 先收集信息；
  - 先设置一项可逆边界；
- 明确不保证外部结果。

若连合法 Cause 都不足，返回 blocked，不能填充故事。

## 11. 可观测性

记录：

- transition / world / state / seed / pack version；
- trigger event 与 choice；
- used cause IDs；
- operation / edge 数；
- Gate error code 与 repair 次数；
- CAS conflict；
- uncertain event 实例化；
- fallback；
- latency 与 token 使用。

核心指标：

- choice-to-state-change coverage；
- unsupported cause rate；
- stale transition conflict rate；
- user correction rate；
- continuity violation interception；
- major adversity interception；
- repeated-choice idempotency；
- ordinary-node ratio。
