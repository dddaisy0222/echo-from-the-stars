# 03 · History Agent

版本：v1.0-production-candidate
状态：等待评审
一句话职责：把已确认的人生岔路翻译成一份可追溯、有边界、不过度戏剧化的现实底稿；它不写命运，只描述人在那套制度、关系与日常条件中可能遇到的现实。

## 1. 为什么需要 History Agent

如果只把“去伦敦”“进入运营商”“全职育儿”交给故事模型，最容易出现三种失真：

1. **愿望投射**：另一条路自动更自由、更成功、更浪漫；
2. **苦难投射**：为了有戏，自动加入裁员、分手、疾病或崩溃；
3. **标签投射**：用“投行人”“体制内”“全职妈妈”等标签代替一个人的具体生活。

History Agent 的价值不是预测准确，而是限制想象的任性。它为 Oracle 提供一组现实边界、常见压力、可用资源和条件性分岔，让世界既有重量，又保留人的能动性。

记忆点：

> History 负责可信，Oracle 负责因果，Echo 负责在其中生活。

## 2. 架构位置

```text
General Agent
  → confirmed Journey Seed
  → History Input Projector（确定性最小披露）
  → History Agent（Reality Pack proposal）
  → History Gate（确定性校验 / 修复 / 阻断）
  → Oracle Agent（World State）
```

- 每个已确认的 `changed_variable` 生成一份 Reality Pack；
- Seed 版本变化时，旧 Pack 失效，不能继续驱动世界；
- 日常对话不调用 History Agent；
- History Agent 不直接访问 Memory System，只接收 Projector 允许的事实；
- 时效性强的政策、签证、薪资和资格信息，应先由外部研究层形成 `reference_facts`；History 只能引用，不能假装刚刚查证过。

## 3. 它可以读取什么

允许读取：

- 已确认的岔路与现实路径；
- 已确认的现实约束与珍视的连续性；
- 与该路径直接相关的 Base Profile 最小字段；
- 用户原话的证据引用；
- Orchestrator 提供的、带来源和时间的参考事实；
- 当前 Journey / Seed / Request 的系统 ID 与时间。

禁止读取：

- Personal Model 或任何人格假设；
- Archive 中的模拟事件与 Echo 对话；
- 与当前世界无关的 Core / Observed 记忆；
- 其他旅程的私密内容；
- 未经授权的浏览、位置、联系人或健康信息。

即使禁止内容误入输入，也必须忽略，并在输出中留下 `forbidden_assumption`，不能据此建模。

## 4. 核心产物：Reality Pack

Reality Pack 固定为六个内容板块：

1. `setting`：时间、地点、领域、角色；
2. `constraints`：仍然生效的现实约束，以及可变或不可变属性；
3. `trajectory_nodes`：时间视野内常见的结构性任务、资源、压力与条件分岔；
4. `common_uncertain_events`：常见但不确定的事件类别；
5. `forbidden_assumptions`：本世界明确不得擅自添加的内容；
6. `open_questions`：缺失且不能负责任编造的信息。

元数据不算内容板块，由系统用于版本、追踪和幂等。

### 4.1 Setting

缺失的信息必须是 `null`，同时进入 `open_questions`。禁止用“某城市”“大概某岗位”等貌似完整的文字掩盖未知。

### 4.2 Constraints

约束不是悲观清单。每条约束都应说明它影响的现实维度：

- economic
- relational
- legal_visa
- skill
- time
- health_baseline
- caregiving
- social_environment
- geography
- institutional

`mutable=false` 只用于本次模拟中被 Seed 锁定的条件，不表示它在人生中永远不可改变。

### 4.3 Trajectory Nodes

时间只允许使用视野枚举：

- week_1_2
- month_1
- month_3
- month_6
- year_1
- year_2_plus

节点不是“第 312 天发生什么”，而是“进入这个系统后，这一阶段通常需要处理什么”。

每个节点同时容纳：

- `likely_gains`：可能获得的资源、能力、关系或选择权；
- `daily_costs`：反复出现的时间、金钱、关系或注意力成本；
- `typical_conditions`：常见环境条件；
- `branch_hints`：如果某个条件成立，哪些现实维度可能改变。

`branch_hints` 只标条件与受影响维度，不提前写结局。

### 4.4 Uncertain Events

这里只写事件类别，不写具体发生：

- 可以写“团队方向阶段性调整”；
- 不可以写“第六个月公司裁掉了她”。

对疾病、死亡、事故、暴力、自伤、关系破裂、失业等重大负面事件：

- 默认 `safe_to_simulate=false`；
- 默认 `requires_user_consent=true`；
- 没有用户明确要求时，Oracle 不得实例化。

### 4.5 Forbidden Assumptions

至少覆盖四类风险：

1. 结果保证：必然成功 / 必然失败；
2. 灾难编造：疾病、死亡、事故、背叛、裁员；
3. 身份刻板印象：行业、地域、性别、婚育、阶层标签；
4. 连续性抹除：让 Seed 中的重要关系、责任或价值无故消失。

### 4.6 Open Questions

`blocking=true` 只用于“缺失后会让世界本身变成另一个世界”的信息，例如国家、时代、路径到底是哪一条。

非阻断问题用于改善真实度，但不能把体验变成审讯。Orchestrator 一次只追问一个最重要问题。

## 5. 事实等级与来源

### 5.1 Fact Level

| 等级 | 含义 | 下游用法 |
|---|---|---|
| confirmed | 用户或已确认 Seed 明确给出 | 可作为本世界锚点 |
| probable | 有可靠参考或稳定领域常识支持 | 可作为基线，保持非必然语气 |
| possible | 合理推断但证据不足 | 只能作为候选或条件 |
| forbidden_assumption | 明确禁止实例化 | Oracle 不得使用 |

### 5.2 Source

| 来源 | 最高等级 |
|---|---|
| user_confirmed | confirmed |
| seed_constraint | confirmed |
| verified_reference | probable |
| domain_general_knowledge | probable |
| model_inference | possible |

所有 Claim 必须带 `source` 和 `evidence_refs`：

- 用户 / Seed Claim 必须引用输入中的事实 ID；
- `verified_reference` 必须引用 `reference_fact_id`；
- 领域常识或模型推断可以没有外部引用，但 Gate 会限制等级；
- 模型不得发明 ID、URL、机构或“研究显示”。

## 6. 时效性与知识边界

以下内容默认是 `time_sensitive`：

- 签证与移民政策；
- 职业资格与监管要求；
- 薪资、税率、房租和福利数字；
- 公司的当前经营状态；
- 招聘、组织结构与具体岗位流程。

规则：

1. 没有带 `retrieved_at` 的 `verified_reference`，不得写成当前事实；
2. 不得输出未经输入提供的精确数字；
3. 无法核实时，降级为结构性描述并提出问题；
4. `as_of` 只能复制参考事实时间，不能由模型猜测。

## 7. 人文边界

### 7.1 不把结构压力写成人格缺陷

“照护占用大量连续时间”是现实条件；“她不够有事业心”是价值判断。

“跨文化工作需要适应”是现实条件；“她会自卑”是心理编造。

### 7.2 不把一条路写成道德等级

全职育儿、回乡、进入大厂、加入创业公司、留在关系中或离开，都不能被默认写成更勇敢、更保守、更独立或更失败。

### 7.3 不把关系当剧情道具

珍视的关系必须保持“存在”，除非 Seed 明确改变它；但存在不等于保证结果。History 只能描述维护关系所需的时间、距离和协商成本。

### 7.4 同时保留代价、资源与能动性

一个可信世界不是平均分配好坏，而是不把人锁死：

- 写工作强度，也写可能获得的技能与同伴；
- 写照护成本，也写关系、意义和社会支持；
- 写制度约束，也写可争取的资源和条件分岔。

## 8. 模型提议、系统裁决

History Agent 不能决定：

- 输出是否通过；
- 是否继续世界生成；
- 是否允许重大负面事件；
- 是否接受来源与等级；
- 是否已获得敏感事件同意；
- 是否复用旧 Reality Pack。

History Gate 负责：

1. Schema 校验；
2. ID、Seed 版本与引用完整性；
3. 事实等级上限；
4. 时效性与精确数字检查；
5. 重大负面事件安全检查；
6. Persona / Personal Model 越权检查；
7. 伪精确时间与具体情节检查；
8. Blocking 与最小完整性；
9. 结果保证、刻板印象与连续性抹除检查；
10. 输出 `passed / repair_required / blocked / rejected`。

## 9. 失败与降级

```text
Schema / 可修复违规
  → 附 gate_log 重试，最多 2 次

blocking open question
  → 回 General Agent，只问一个最小问题

两次修复仍失败
  → 使用不含具体事件的 conservative baseline
  → 或转人工评审

Seed version 改变
  → 旧 Pack 立即 stale，重新生成
```

降级不能清空已经确认的 Seed，也不能偷偷换成另一条路径。

## 10. 36 小时 Demo 的实现范围

必须实现：

- 单条已确认岔路输入；
- Reality Pack v1；
- 事实等级、来源与引用；
- 4 个主要时间视野；
- 重大负面事件 Gate；
- Blocking 问题回流；
- Seed 版本失效；
- 至少一份完整示例与回归集。

暂不实现：

- 自动联网研究；
- 多来源事实争议裁决；
- 国家级政策数据库；
- 数值化人生预测；
- 长期自动刷新。

## 11. 关联文件

- 输入 Schema：`schemas/history-agent.v1.input.schema.json`
- 输出 Schema：`schemas/reality-pack.v1.schema.json`
- System Prompt：`prompts/history-agent.v1.system.md`
- Runtime Policy：`prompts/history-agent.v1.runtime-policy.md`
- Gate：`orchestration/history-agent-v1.gate.md`
- 输入示例：`examples/history-agent.v1.input.example.json`
- 输出示例：`examples/reality-pack.v1.example.json`
- 回归集：`evals/history-agent.v1.cases.jsonl`
