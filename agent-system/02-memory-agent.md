# 02 · Memory Agent

版本：v1.0-production-candidate  
状态：等待评审  
一句话职责：把 Echo 发生过的信息整理成可追溯、可纠正、现实与模拟严格隔离的长期状态，并只向每个下游 Agent 披露完成任务所需的最少部分。

## 1. Memory Agent 不是数据库

准确架构是一个 Memory System：

```text
Memory Candidates / Product Events
  ↓
Deterministic Memory Gate
  - 来源校验
  - 用户证据校验
  - 权限与敏感度
  - 现实 / 模拟隔离
  ↓
Memory Agent · Ingest Mode
  - 规范化建议
  - 去重与关系建议
  - 冲突候选
  ↓
Deterministic Memory Reducer
  - 最终写入
  - 版本、时效、纠正与删除
  ↓
Core / Observed / Archive
  ↓
Memory Agent · Reflect Mode
  - 假设候选
  - 支持证据与反证
  ↓
Deterministic Hypothesis Validator
  - 独立证据门槛
  - 状态和强度
  ↓
Personal Model
  ↓
Deterministic Retrieval Policy
  - Agent 读取权限
  - 最小披露
```

模型只能提议；系统负责真实性、状态、权限、写入与删除。

## 2. 四层数据

### 2.1 Core Memory

用户明确提供并被系统接受为现实的信息：

- Base Profile 的版本；
- 用户确认的现实选择；
- 用户确认的原因、现实限制与重要关系；
- 用户对旧信息的纠正；
- 用户主动留下、希望以后继续使用的现实承诺或目标。

Core 不是聊天全文，也不是“用户说过的一切”。

写入条件：

1. 有可验证的用户原话或产品内明确确认；
2. 对之后的连续体验具有明确用途；
3. 满足最小必要原则；
4. 敏感信息具备对应保存授权；
5. 不是模型推断。

### 2.2 Observed Memory

用户在 Echo 内真实做出的、有产品意义的行为：

- 选择进入哪条路径；
- 在节点中做出的明确选择；
- 主动收集或放回哪件人生证据；
- 对 Echo 的理解表示“像我 / 不像我”；
- 用户纠正世界或结束体验；
- 用户主动带回现实的一句话。

Observed 记录“发生了什么”，不记录“这说明什么”。

不应记录：

- 鼠标悬停；
- 细碎停留时长；
- 页面滚动；
- 误触；
- 未经用户预期的隐性心理画像信号。

### 2.3 Archive Memory

由系统生成、只在模拟中成立的内容：

- 平行世界状态；
- 模拟人物、事件与关系；
- 平行自我的经历；
- 生成的场景、物件和时间线；
- 用户与平行自我的完整对话；
- Oracle 的推演结果。

Archive 必须始终携带：

```text
truth_status = simulated
world_id
simulation_version
```

它永远不能成为“用户现实经历”的证据。

### 2.4 Personal Model

前三层之上的可修正假设，不是记忆事实：

```json
{
  "statement": "用户可能比起结果好坏，更反复在意选择是否由自己做出",
  "status": "emerging",
  "supporting_evidence_ids": [],
  "counter_evidence_ids": [],
  "scope": "decision_pattern",
  "user_feedback": "unreviewed"
}
```

Personal Model 禁止存储：

- “用户就是怎样的人”；
- MBTI、依恋类型、诊断、命理结论；
- 由单次行为形成的特质；
- 没有可引用证据的“核心需求”；
- 模拟内容推导出的现实人格。

## 3. 真实性与来源

每条记录必须包含：

### Layer

- `core`
- `observed`
- `archive`

Personal Model 使用独立 Hypothesis 结构，不混在 Memory Record 中。

### Truth Status

- `user_stated`：用户明确说过，但不一定已确认长期保存；
- `user_confirmed`：用户确认内容或确认 Seed；
- `observed_interaction`：产品中真实发生的操作；
- `simulated`：系统生成的世界内容。

### Provenance

- 来源 Agent 或产品组件；
- session / journey / world / turn / event ID；
- 原话证据；
- 创建时间；
- 生成模型版本（仅 Archive）；
- 用户同意范围。

没有 Provenance 的记录不得进入长期存储。

## 4. Memory Record v1

```json
{
  "memory_id": "mem_core_001",
  "layer": "core",
  "truth_status": "user_confirmed",
  "kind": "real_path",
  "content": {
    "verbatim": "我最后留在杭州进了大厂",
    "normalized": "留在杭州进入大厂"
  },
  "provenance": {
    "source_type": "general_agent_candidate",
    "source_id": "journey_01.real_path",
    "turn_ids": ["turn_04"],
    "journey_id": "journey_01",
    "world_id": null,
    "created_by": "user"
  },
  "temporal": {
    "event_time": null,
    "valid_from": null,
    "valid_to": null,
    "recorded_at": "2026-07-31T08:00:00.000Z"
  },
  "sensitivity": "normal",
  "retention": "persistent",
  "status": "active",
  "supersedes": [],
  "superseded_by": null,
  "tags": ["career", "location", "journey_01"]
}
```

## 5. 保存范围与敏感度

### Sensitivity

- `normal`：一般体验信息；
- `sensitive`：关系、经济、健康、家庭、精确位置等；
- `restricted`：产品原则上不应长期保存，除非有明确必要和单独授权。

### Retention

- `session`：关闭本次会话后清除；
- `journey`：只在当前旅程中使用；
- `persistent`：跨旅程保存。

默认规则：

- Archive 对话默认 `journey`，不是永久保存；
- 敏感内容默认不得升级为 `persistent`；
- 用户确认 Seed 不自动等于同意永久保存所有原话；
- Base Profile 与用户主动保存的现实内容可持久化；
- 用户必须能查看、纠正和删除 persistent Memory。

## 6. Ingest Mode

### 6.1 输入

- 已通过来源校验的 Memory Candidate；
- 同一用户、同一 kind 的小范围相似记录；
- 当前权限与保存策略；
- 用户本轮纠正；
- 不向模型提供不相关的完整记忆库。

### 6.2 模型负责

- 提议目标层；
- 生成不增加意义的 normalized；
- 判断与候选记录的关系：
  - `novel`
  - `exact_duplicate`
  - `semantic_duplicate`
  - `update`
  - `conflict`
  - `temporal_successor`
- 提议保留、忽略、替换、建立冲突或缩短 retention；
- 提议 kind 与 tags；
- 解释为什么值得记。

### 6.3 模型不负责

- 最终写入；
- 把 `simulated` 改成 `core`；
- 决定用户已同意；
- 把 inferred 内容升级成事实；
- 删除记录；
- 直接建立 Personal Model。

## 7. 确定性 Memory Gate

### 7.1 硬隔离

```text
truth_status = simulated → layer 必须为 archive
truth_status = observed_interaction → layer 必须为 observed
truth_status = user_stated / user_confirmed → 才可能进入 core
```

任何模型输出都不能突破。

### 7.2 Core 写入门槛

必须同时满足：

1. 来源是用户原话、用户确认或已确认 Journey Seed；
2. quote 能在对应用户 turn 中逐字找到；
3. 具备未来使用目的；
4. 不属于无必要的敏感细节；
5. 没有被用户拒绝或删除；
6. retention 符合授权。

### 7.3 Observed 写入门槛

- 必须来自产品签名事件，而不是模型描述；
- 只记录明确行为；
- 事件必须在白名单；
- 不附加性格解释。

### 7.4 Archive 写入门槛

- 必须有 world ID 与 simulation version；
- 明确标记 simulated；
- 与现实 Core 使用不同索引与检索命名空间。

## 8. 去重、更新与冲突

### 8.1 Exact Duplicate

相同来源与 normalized：不新建，只追加 Provenance。

### 8.2 Semantic Duplicate

表达不同、含义相同：

- 不直接合并用户原话；
- 可共享 canonical group；
- 保留各自证据。

### 8.3 Update

同一事实被补充：

> “我留在杭州。”  
> “我留在杭州进了大厂。”

新记录可 supersede 旧记录，但旧 Provenance 保留。

### 8.4 Temporal Successor

事实随时间变化：

> 7 月：AI 产品经理  
> 11 月：已辞职创业

不能判为冲突。旧记录 `valid_to` 结束，新记录成为当前版本。

### 8.5 Conflict

同一有效时间出现互斥信息：

- 两条都保留为 `disputed`；
- 不替用户解释；
- 下游不得任意选一条；
- 需要时由 General Agent 进行最小确认。

### 8.6 User Correction

用户纠正最高优先级：

- 被纠正记录变成 `superseded` 或 `rejected`；
- 新记录引用纠正 turn；
- 下游默认只读新记录；
- 旧内容不能因相似检索重新出现。

## 9. 删除

### 用户删除

- 删除内容本身、向量、摘要和检索索引；
- 删除依赖该证据且失去门槛的 Hypothesis；
- 重新计算其他 Hypothesis；
- Archive 中引用该现实内容的派生世界不得再作为 Personal Model 证据；
- 可以保留不含内容的最小审计事件，用于防止同步副本复活，但不保留原文。

### 产品过期

- `session` 自动清除；
- `journey` 在旅程结束后的策略期限内清除或压缩；
- `persistent` 只有用户删除、内容过期或版本替换时改变。

## 10. Personal Model · Reflect Mode

Reflection 只能使用通过 Gate 的记录引用。

### 10.1 假设必须可被推翻

正确：

> 在涉及职业迁移的选择中，用户可能反复关注决定是否由自己做出。

错误：

> 用户的核心需求是自由。

正确假设必须限定：

- 发生在哪类情境；
- 哪种行为或表达反复出现；
- 哪些证据支持；
- 哪些证据反对；
- 什么新证据会推翻它。

### 10.2 独立证据

系统用 `context_key` 判断独立性，例如：

```text
journey_01:onboarding
world_01:node_02
journey_02:return
```

同一段对话的重复复述只算一个 context。

### 10.3 状态

- `emerging`：至少 2 条独立证据，来自至少 2 个 context；
- `supported`：至少 4 条独立证据，来自至少 3 个 context，且没有强烈用户否认；
- `contested`：存在强反证或用户表示“不像我”；
- `retired`：用户明确否认，或删除证据后不再满足最低门槛。

状态由 Validator 根据证据数、来源和用户反馈计算，不由模型直接决定。

### 10.4 支持与反证

Reflect Agent 每次都必须主动检索和输出：

- supporting evidence；
- counter evidence；
- missing evidence；
- falsification condition。

没有反证不代表假设正确，只能表示当前未找到。

### 10.5 禁止从 Archive 推断现实人格

模拟事件、Echo 的回答和 Oracle 的剧情不能作为支持用户现实 Pattern 的证据。

Archive 只可以说明：

- 用户在模拟中接触了什么内容；
- 不能说明用户现实中经历过什么。

用户对模拟作出的真实选择属于 Observed，可以作为有限证据。

## 11. Hypothesis Record

```json
{
  "hypothesis_id": "hyp_001",
  "statement": "在职业迁移选择中，用户可能反复关注决定是否由自己做出",
  "scope": "decision_pattern",
  "status": "emerging",
  "supporting_evidence_ids": ["mem_core_04", "mem_obs_12"],
  "counter_evidence_ids": ["mem_core_08"],
  "context_keys": ["journey_01:onboarding", "world_01:node_02"],
  "falsification_condition": "在新的职业选择中，用户明确表示结果稳定性比自主决定更重要",
  "user_feedback": "unreviewed",
  "created_at": "2026-07-31T08:00:00.000Z",
  "updated_at": "2026-07-31T08:00:00.000Z"
}
```

不使用模型随口生成的数值置信度。

## 12. 用户反馈

Personal Model 必须可见、可纠正：

```text
Echo 暂时注意到：
你似乎常在“自己决定”与“保住重要关系”之间来回确认。

依据：
- 你说……
- 在世界节点中，你选择……

[这有点像我]
[不太像我]
[不想让 Echo 记住这些]
```

### 像我

- 记录用户认可事件；
- 不能因此升级为永久人格事实；
- 可作为 Hypothesis 的支持证据。

### 不太像我

- Hypothesis 立即进入 `contested`；
- 记录用户反馈；
- 后续不应以确定口吻向其他 Agent 暴露；
- 可以邀请用户修改，但不能要求解释。

### 不想记住

- 删除相关持久 Memory；
- 重新计算 Hypothesis；
- 不能只隐藏 UI。

## 13. Retrieval

Memory Agent 不应自由翻阅全部用户数据。检索分两步：

1. 确定性权限与 namespace 过滤；
2. 规则评分或可选的模型重排。

候选评分可使用：

- task relevance；
- recency；
- explicit importance；
- current validity；
- user confirmation；
- source diversity。

敏感度和权限是硬过滤，不是评分项。

## 14. Agent 读取矩阵

| Consumer | Core | Observed | Archive | Personal Model |
|---|---|---|---|---|
| General | 与当前岔路相关的 Core、用户纠正 | 不给 | 不给 | 不给，避免问题被旧假设带偏 |
| History | Profile、时间、地点、现实硬约束 | 不给 | 不给 | 不给 |
| Oracle | 已确认 Seed、现实约束、最少相关 Core | 当前世界的明确选择 | 当前 world namespace | 仅允许相关且非 contested 的假设摘要 |
| Echo | 授权的共同过去 | 当前世界内用户选择 | 当前 world 的平行自我记忆 | 不给标签式假设 |
| Reflection | 当前旅程相关 Core | 当前旅程 Observed | 当前 world 摘要 | 相关假设与反证 |

### Echo 特别规则

Echo 可以知道“共同过去”，但不能突然说出用户未在这次体验中授权使用的敏感记忆。用户应该能理解它为什么知道某件事。

Echo 的当前第一人称看法不是用户现实事实，也不是 World State。若需要跨轮保持，只能作为带来源的 `accepted_echo_continuity` 写入当前 World Archive，默认 journey retention；未来猜测、explicit unknown 和未经 Gate 的高层洞察不能成为 continuity。

Echo 对用户现实路径的认知单独维护为 `other_path_view`：

- 岔路时已知的另一个选项来自 confirmed Seed；
- 用户后来向 Echo 披露的现实经历保留 turn provenance；
- 未披露部分维持 explicit unknown；
- Echo 对另一条路的羡慕或想象只能成为 `other_path_projection`，不能写成用户现实事实或 Personal Model；
- 用户纠正现实经历时，相关 disclosure 与 projection 一并重新校验。

Echo 检索采用三段式上下文：

1. 最近对话原文；
2. 带 source turn IDs 的少量 durable context；
3. 当前 World 内已接受的 Parallel Self Archive。

用户在 Echo 对话中说的一句话不会因为进入 Archive 而自动升级为 Core。

## 15. Retrieval Bundle

返回下游的不是全库，而是：

```json
{
  "consumer": "oracle",
  "task": "advance_world_node",
  "records": [],
  "hypotheses": [],
  "excluded_counts": {
    "permission": 4,
    "irrelevant": 12,
    "simulated_reality_boundary": 7
  },
  "generated_at": "..."
}
```

Bundle 带过期时间和用途，不允许下游长期缓存为自己的现实事实。

## 16. 36 小时 Demo

第一版只实现：

1. General Agent 候选经过 Gate；
2. 已确认 Seed 的现实信息写入 Core；
3. 三个世界物件和 Echo 对话写入当前 World Archive；
4. 世界里的明确选择写入 Observed；
5. 离开世界时运行一次 Reflect；
6. 只有满足两条独立证据才展示一条 `emerging` 假设；
7. 用户可以点击“有点像 / 不太像 / 不要记住”；
8. 模拟内容绝不进入 Core。

不做：

- 全量向量数据库；
- 隐式行为画像；
- 跨设备长期同步；
- 数十条假设；
- 自动心理分析；
- 把聊天全文永久保存。

## 17. 验收重点

- simulated 是否在任何情况下都无法进入 Core；
- Observed 是否只保存白名单行为、不附带解释；
- 用户纠正后旧值是否不会被检索复活；
- 时间变化是否被识别为 successor 而不是冲突；
- 假设是否至少有两个独立 context；
- Reflect 是否主动寻找反证；
- Archive 是否不能支持现实人格假设；
- contested 假设是否停止向下游以肯定形式披露；
- 删除是否真正移除内容、索引和依赖假设；
- 每个 Agent 是否只读取权限矩阵允许的最少数据。
