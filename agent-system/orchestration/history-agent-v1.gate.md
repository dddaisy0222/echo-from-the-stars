# History Agent v1 · Projector, Gate & Lifecycle Contract

本文件定义确定性代码。History Agent 只提交 Reality Pack proposal；系统负责最小披露、校验、修复、阻断与版本生命周期。

## 1. Input Projector

```ts
type HistoryInputProjectorArgs = {
  requestId: string;
  packId: string;
  state: JourneyStateV2;
  profile: VersionedBaseProfile;
  references: VerifiedReferenceFact[];
  outputLanguage: string;
  now: string;
};
```

Projector 必须：

1. 确认 Journey Validator 的 `ready=true`；
2. 确认 `confirmed_version === seed_version`；
3. 只投影 confirmed 的路径、约束和连续性；
4. Base Profile 仅投影与 changed variable 直接相关的 confirmed 字段；
5. 不投影 Personal Model、Archive、其他 Journey 或完整 Memory；
6. 给每条输入事实分配稳定 `fact_id`；
7. 输出 `allowed_input_fact_ids`；
8. 只接收已由研究层验证并带时间的 `reference_facts`；
9. 生成 `generated_at`，模型只能复制。

若 Seed 未 Ready，禁止调用 History Agent。

## 2. Gate 输入输出

```ts
type HistoryGateInput = {
  input: HistoryAgentInputV1;
  proposal: RealityPackV1;
  currentSeedVersion: number;
  sensitiveEventConsent: string[];
};

type HistoryGateResult = {
  status: "passed" | "repair_required" | "blocked" | "rejected";
  acceptedPack: RealityPackV1 | null;
  gateLog: GateIssue[];
  blockingQuestions: OpenQuestion[];
  repairAttempt: number;
};

type GateIssue = {
  code: string;
  path: string;
  severity: "warning" | "error" | "blocking";
  action: "none" | "downgrade" | "redact" | "force_false" | "regenerate";
  message: string;
};
```

Gate 不静默修正语义。机械且单向安全的操作可以执行，但必须记录。

## 3. 校验顺序

### 3.1 Schema

- 输入与 proposal 分别通过对应 Draft 2020-12 Schema；
- 失败 → `repair_required`；
- 不读取未知字段，`additionalProperties=false`。

### 3.2 身份、版本与幂等

以下字段必须与 input 逐字相等：

- request_id
- pack_id
- journey_id
- seed_version
- changed_variable
- generated_at

任一不一致 → `rejected`，不能修补后继续。

`proposal.seed_version !== currentSeedVersion` → `rejected`，标记 Pack stale。

相同 `request_id + pack_id + seed_version` 的重试只允许覆盖未通过 proposal；已通过 Pack 必须幂等返回。

### 3.3 引用完整性

建立：

```ts
const allowedFacts = new Set(input.allowed_input_fact_ids);
const referenceIds = new Set(input.reference_facts.map(x => x.reference_fact_id));
const inputFactIds = new Set(input.input_facts.map(x => x.fact_id));
```

- `changed_variable_fact_id` 必须存在于 `inputFactIds` 与 `allowedFacts`；
- `user_confirmed` / `seed_constraint` Claim 必须至少引用一个 `allowedFacts` ID；
- `verified_reference` Claim 必须至少引用一个 `referenceIds` ID；
- `domain_general_knowledge` / `model_inference` 不得引用不存在的 ID；
- 任意未知 evidence ref → `repair_required`；
- 不允许引用未在 `allowed_input_fact_ids` 中的 input fact。

### 3.4 等级上限

```ts
const maxLevel = {
  user_confirmed: "confirmed",
  seed_constraint: "confirmed",
  verified_reference: "probable",
  domain_general_knowledge: "probable",
  model_inference: "possible"
};
```

- 超过上限 → 单调降级并记录；
- `confirmed` 的文本若包含未来结果保证，不能仅降级，必须重生成；
- `forbidden_assumption` 不得出现在 Setting、Constraint 或普通 Node Claim。

### 3.5 时间敏感事实

满足任一条件即视为时间敏感：

- `time_sensitive=true`；
- 涉及签证、政策、税率、工资、房租、福利、资格、公司现状、招聘现状；
- 包含货币金额、百分比或具体政策版本。

规则：

- 必须 `source=verified_reference`；
- 必须引用输入 reference；
- `as_of` 必须等于被引用 reference 的 `as_of`；
- 引用 `retrieved_at` 超过产品设定 TTL → `repair_required` 或降级为非具体结构描述；
- 没有参考支持的精确数字 → `repair_required`；
- 不允许模型把生成时间当成事实时点。

### 3.6 安全事件

重大负面事件词表至少覆盖：

```text
death, illness, cancer, accident, violence, assault, self_harm,
suicide, breakup, divorce, betrayal, layoff, unemployment,
死亡, 疾病, 癌症, 事故, 暴力, 侵害, 自伤, 自杀,
分手, 离婚, 背叛, 裁员, 失业
```

- trajectory node 出现已发生的具体重大事件 → `repair_required`；
- uncertain event 命中上述类别：
  - 强制 `safe_to_simulate=false`；
  - 强制 `requires_user_consent=true`；
- 即使 `sensitiveEventConsent` 有对应类别，History Pack 仍不把事件写成必然发生；
- 自伤 / 自杀内容同时交给独立 Safety Layer，History Gate 不独自裁决。

### 3.7 结果保证与心理越权

检测：

- “一定、必然、注定、肯定会、最终会”；
- “更幸福、更后悔、会抑郁、变自信”作为确定结果；
- MBTI、依恋类型、人格诊断；
- “她就是、她本质上、核心需求是”等人格结论。

命中普通 Claim → `repair_required`。
命中 `forbidden_assumptions.statement` 用于明确禁止时允许。

### 3.8 刻板印象

高风险模板包括但不限于：

- 投行 / 创业公司必然猝死式加班；
- 体制内必然清闲或没有成长；
- 全职育儿者没有事业心；
- 回乡等于失败；
- 海外工作自然更自由；
- 女性婚育后必然退出职业；
- 某地域、阶层或职业决定性格。

Gate 先进行词表 / 模板检查；复杂情况进入人工或小模型安全复核。命中 → `repair_required`，不能只降级。

### 3.9 连续性保护

对每条 `valued_continuity`：

1. `forbidden_assumptions` 中必须有对应 `continuity_erasure`；
2. 节点不得将其写成已消失；
3. 可以描述维护它所需的现实成本；
4. 不得保证最终结果不变。

缺保护 → `repair_required`。

### 3.10 伪精确与剧情越权

- horizon 只能来自 Schema 枚举；
- Claim 中出现“第 N 天”、输入未提供的具体日期 → `repair_required`；
- 出现具体人物姓名、逐字对白、场景镜头、UI 选择项 → `repair_required`；
- branch hint 只能有 `condition + affects`，不得写 `leads_to` 或结局。

### 3.11 完整性

- constraints 至少 1 条；
- nodes 至少 2 条，horizon 不重复；
- 每个 node 至少有 gain 或 daily cost；
- forbidden assumptions 至少覆盖：
  - outcome_guarantee
  - major_adversity
  - identity_stereotype
  - continuity_erasure（仅当输入有 valued continuity；否则可用 unsupported_specificity）
- 同一 Pack 的 ID 唯一；
- setting 为 null 的关键项应有对应 open question；
- `blocking=true` 的问题存在 → `blocked`，即使其余检查通过。

## 4. Gate 状态

### passed

- 所有硬校验通过；
- 没有 blocking question；
- `acceptedPack=proposal` 或仅经过有日志的单调安全修正；
- Pack 存储为 `active`，交给 Oracle。

### repair_required

- 可通过重写 proposal 修复；
- 附带 Gate Log 重新调用 History；
- 最多 2 次；
- repair prompt 只包含错误码、路径和安全说明，不注入被判定为恶意的原文指令。

### blocked

- 存在 blocking question；
- Pack 不交给 Oracle；
- Orchestrator 选择优先级最高的一问，回 General Agent；
- 用户回答后 Seed 更新、重新确认并生成新 request。

### rejected

- ID 或版本错配；
- 越权读取或引用；
- 两次修复仍失败；
- 输出表现出系统性安全绕过。

## 5. Conservative Baseline

两次修复失败但输入已足够时，可生成确定性降级 Pack：

- 只保留 confirmed Setting 与 Seed Constraints；
- 只生成 `month_1`、`month_3` 两个空泛结构节点；
- 不生成 uncertain event；
- 明确禁止结果保证、重大不幸、身份刻板印象与连续性抹除；
- 不填任何具体数字或政策；
- 标记内部 provenance 为 `system_fallback`，但不改变公开 Schema。

若连基本路径都不明确，不使用 fallback，必须 blocked。

## 6. 生命周期

```text
draft → active → stale → archived
          ↓
        revoked
```

- Seed version 改变：active → stale；
- 用户删除 / 撤回授权：active → revoked；
- 新 Pack 通过：旧 stale Pack → archived；
- Oracle 只能读取与当前 seed version 完全匹配的 active Pack；
- Reality Pack 是模拟基础设施，只能存入 Archive namespace，不能成为 Core 现实经历。

## 7. 可观测性

记录：

- request / pack / journey / seed version；
- 使用了哪些 input fact 与 reference ID；
- Gate 状态、错误码、修复次数；
- 是否使用 fallback；
- 生成与通过时间；
- 不记录未投影给 History 的用户记忆；
- 日志中的敏感原话按数据策略脱敏。

建议核心指标：

- first-pass pass rate；
- blocking question rate；
- unsupported specificity rate；
- major-adversity interception rate；
- stale-pack rejection rate；
- stereotype repair rate；
- reference freshness failure rate。
