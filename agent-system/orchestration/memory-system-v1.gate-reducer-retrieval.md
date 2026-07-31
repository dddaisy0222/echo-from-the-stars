# Memory System v1 · Gate, Reducer & Retrieval Contract

这里定义确定性系统行为，不使用大模型。

## 1. Candidate Gate

每个 Candidate 进入 Memory Agent 前先校验：

```ts
type MemoryCandidate = {
  candidateId: string;
  userId: string;
  proposedTruthStatus:
    | "user_stated"
    | "user_confirmed"
    | "observed_interaction"
    | "simulated";
  content: {
    verbatim: string | null;
    normalized: string;
  };
  provenance: Provenance;
  requestedRetention: "session" | "journey" | "persistent";
  requestedConsentScope: Consumer[];
};
```

### 硬规则

```ts
function requiredLayer(status: TruthStatus): Layer {
  if (status === "simulated") return "archive";
  if (status === "observed_interaction") return "observed";
  return "core";
}
```

任何模型都不能覆盖 `requiredLayer`。

### 用户证据

Core Candidate 必须满足：

```ts
turn.role === "user"
&& turn.content.includes(candidate.content.verbatim)
```

Seed Card 确认产生的组合记忆可以引用多条原始用户证据和确认 turn，不允许只引用 Agent 总结。

### 产品事件

Observed 只接受签名白名单事件：

- `world_path_selected`
- `world_node_choice_committed`
- `world_evidence_collected`
- `world_evidence_left`
- `world_correction_submitted`
- `reflection_feedback_submitted`
- `journey_ended_by_user`
- `return_note_saved`

白名单事件只记录 payload 中的明确动作，不生成解释字段。

### Archive

必须有：

- `world_id`
- `simulation_version`
- `source_type` 为 world generator / oracle / echo dialogue

## 2. Ingest Reducer

Memory Agent 的提议必须经过以下检查：

1. 输出 Schema 合法；
2. candidate ID 与输入一致；
3. required layer 与 Gate 一致；
4. target memory IDs 都来自本轮候选集；
5. normalized 不增加 verbatim 没有的事实；
6. sensitivity 不得低于规则分类；
7. retention 不得高于 consent 允许上限；
8. rejected / deleted tombstone 不得被无新证据复活；
9. Archive 不得进入现实检索 namespace。

不满足时拒绝模型提议，使用确定性保守 fallback。

## 3. 保守 Fallback

```text
用户现实 + 有合法证据 + 一般信息
→ 以 journey retention 保存 Core candidate，等待用户确认持久化

签名产品事件
→ 保存 Observed，使用 journey retention

模拟内容 + 完整 world provenance
→ 保存 Archive，使用 journey retention

边界不明 / 敏感授权不足
→ ignore 或 require_user_confirmation
```

## 4. 去重

确定性先做：

- source ID 去重；
- content hash 去重；
- candidate key 去重。

模型只处理语义重复。

Semantic duplicate 不删除原话。建立 `canonical_group_id`，检索时可以折叠。

## 5. 时间与冲突

### Successor

只有满足以下条件才关闭旧 `valid_to`：

- kind 属于可随时间变化的字段；
- 新内容有更晚的有效时间或明确“现在已经”表达；
- user ID 相同；
- 不是模拟内容。

### Conflict

若同一有效期、同一事实槽位互斥：

- 两条 `status = disputed`；
- 生成 unresolved conflict；
- 对需要此信息的下游返回“未知/有冲突”，不任意选择；
- 由 General Agent 询问最小确认。

## 6. 用户纠正

用户纠正事件直接进入优先队列：

1. 校验被纠正 memory ID；
2. 原记录改为 `superseded` 或 `rejected`；
3. 新记录必须引用纠正原话；
4. 更新索引；
5. 查找依赖旧证据的 Hypothesis；
6. 重新验证并可能改为 contested / retired；
7. 清除下游缓存 Bundle。

## 7. 删除

用户删除使用事务：

1. 标记删除意图并暂停检索；
2. 删除原文与 normalized；
3. 删除 embedding / sparse index / cached summary；
4. 删除 consumer bundle 缓存；
5. 重新验证依赖 Hypothesis；
6. 保留不可逆的内容无关 tombstone：

```json
{
  "deleted_memory_hash": "...",
  "deleted_at": "...",
  "reason": "user_request"
}
```

Tombstone 不包含原文，只防止离线同步副本复活。

## 8. Hypothesis Validator

模型只输出 Proposal。系统计算状态。

### Evidence Eligibility

可用：

- active Core；
- active Observed 白名单事件。

不可用：

- Archive；
- disputed / superseded / rejected / deleted；
- 没有 consent scope `reflection`；
- 同一个 context 的重复复述作为多条独立证据。

### 状态

```ts
if (userFeedback === "reject") return "contested";
if (eligibleContextCount < 2 || supportingCount < 2) return null;
if (
  eligibleContextCount >= 3
  && supportingCount >= 4
  && !hasStrongCounterEvidence
) return "supported";
return "emerging";
```

如果证据被删除后低于门槛：

- 用户未否认：`retired`
- 用户否认：`contested`，随后可按产品策略归档

### 独立 Context

`context_key` 由产品生成，不由模型生成：

- `journey:{id}:onboarding`
- `world:{id}:node:{id}`
- `world:{id}:echo_dialogue`
- `journey:{id}:return`
- `journey:{id}:reflection_feedback`

## 9. Personal Model 用户反馈

### affirm

- 写入 Observed `reflection_feedback_submitted: affirm`；
- 可以作为一个新 context 的支持证据；
- 不把 Hypothesis 改成事实。

### reject

- 写入 Observed `reflection_feedback_submitted: reject`；
- 状态立即 `contested`；
- Retrieval 默认排除；
- 不要求用户说明原因。

### edit

- 用户编辑的句子成为 Core 候选，但必须明确它是用户对自身的当前表达；
- 原 Hypothesis contested；
- 新表达仍不是永久人格标签。

### forget

- 调用删除事务；
- 删除相关证据或用户选中的范围；
- 重新计算 Hypothesis。

## 10. Consumer 权限

硬过滤顺序：

```text
user_id
→ active status
→ retention 尚有效
→ consent_scope 包含 consumer
→ layer 权限
→ namespace / world / journey 权限
→ sensitivity
→ task relevance candidates
```

之后才允许相关性排序。

### General

- 只读 Core；
- 仅当前岔路相关；
- 包含用户 corrections；
- 不读 Observed、Archive、Hypothesis。

### History

- 只读 Profile、现实时间地点、硬约束；
- 不读情绪、Observed、Archive、Hypothesis。

### Oracle

- 读确认 Seed、最少 Core；
- 读当前 World 的 Observed choices；
- 读当前 World Archive；
- 只读非 contested、与当前 task 直接相关的 Hypothesis 摘要。

### Echo

- 读用户授权的 Shared Origin Core；
- 读当前 World Observed；
- 读当前 World Archive 中属于 Parallel Self 的已接受记忆；
- 读当前对话最近轮次与带 source turn IDs 的 Echo durable context；
- 不读标签式 Personal Model。

Echo 的 `continuity_candidate` 只有通过 Echo Claim Gate 与 Memory Gate 后才能写入当前 World Archive；只接受 current subjective stance / bounded inference，默认 journey retention。未来猜测、unknown、reality disclosure 与用户问题中的隐含前提不得写入 continuity。

`other_path_projection` 必须引用 confirmed fork fact、用户 disclosure 或已有 projection，并明确保持 simulated / projected。它不能进入 Core、Observed 或 Personal Model 的证据集合；用户新增或纠正现实披露时，依赖旧信息的 projection 必须 contested 或 superseded。

Echo 对话整体可以成为 Archive，但其中用户说的话不自动成为 Core。

### Reflection

- 读当前旅程 Core；
- 读当前旅程 Observed；
- 读当前 World 的压缩 Archive 摘要，仅用于说明体验发生了什么；
- Reality Pattern 证据仍只能来自 Core / Observed。

## 11. Retrieval Bundle 生命周期

每个 Bundle 包含：

- consumer；
- task；
- selected IDs；
- purpose；
- generatedAt；
- expiresAt；
- source state versions。

Memory 被纠正、删除或权限变化时，相关 Bundle 立即失效。

下游不得把 Bundle 内容重新写入 Core。
