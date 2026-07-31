# 04 · Oracle Agent

版本：v1.3-production-candidate
状态：等待评审
一句话职责：在已通过 Gate 的 Reality Pack 内，一次推进一个生活节点，并把每个变化解释为“哪些既有条件与用户行动，通过什么机制，改变了哪些世界状态”。

## 1. Oracle 不是什么

Oracle 这个名字容易让人误解。它不是预言者、人生结论生成器或小说家，也不判断用户“本来会成为谁”。

它维护的是一条明确标注为模拟的反事实世界：

- 不声称这是用户真实的未来；
- 不把另一条路写成奖励版或惩罚版；
- 不一次性生成完整人生；
- 不用随机戏剧替代因果；
- 不直接写数据库；
- 不从模拟经历推断用户现实人格。

## 2. 架构位置

```text
confirmed Journey Seed
  + active Reality Pack
  + current World State
  + signed user choice
  + scoped Memory Retrieval Bundle
        ↓
Oracle Agent（Transition Proposal）
        ↓
Oracle Gate（权限、版本、因果、安全、连续性）
        ↓
World Reducer（确定性应用状态操作）
        ↓
World State v1 + Archive / Observed 派生事件
        ↓
Scene Renderer / Echo Agent
```

Oracle 只提议。Gate 与 Reducer 才决定变化是否发生。

## 2.1 Phind 宁波文本为什么会“戳中”

那段文本的有效部分，不是它替用户下了“稳定但不甘心”的结论，而是它抓住了五种生活尺度：

1. **钟表尺度**：几点醒、几点到工位、几点能离开；
2. **空间尺度**：住在哪里、离父母和单位多远、通勤是否构成问题；
3. **制度尺度**：可能进入什么部门、如何流转、怎样汇报、什么工作会重复；
4. **地方尺度**：宁波的气候、饮食、城市距离和熟悉的社会坐标；
5. **机会成本尺度**：技能用在何处、晚上属于谁、哪些信息会让人重新比较。

这些尺度共同产生“这像一套能运行的生活”，比抽象地写“稳定与成长的交换”强得多。

但原文本把四种不同地位的信息混在同一种肯定语气里：

- 高可信结构：回宁波后家庭距离更近；
- 可研究事实：单位作息、轮岗、食堂、部门设置；
- 个体反事实假设：父母会置办鄞州小两居；
- 未获证的内心结论：心理平衡、刺痛磨钝、第三年会被惯性困住。

v1.2 的目标不是降低具体度，而是让每个具体细节都知道自己是什么。

## 2.2 三层 World Model

```text
Reality Layer（History / Research）
  岗位制度、组织流程、城市与行业现实、时间敏感资料
        ↓
Premise Layer（World Calibration）
  用户为“这个可能世界”确认住房、岗位起点、家庭安排等关键前提
        ↓
Causal Layer（Oracle）
  已有状态 + 用户行动 → 状态变化 → 下一节点
        ↓
Experience Layer（Renderer / Character / Echo）
  感官细节、人物说话、另一个自己的生活记忆
```

模型的参数知识只适合提出研究问题与候选，不是事实数据库。岗位、薪资、作息、政策、食堂价格和组织安排要由带时间与来源的参考资料支持；无法确认时保持区间、条件或未知。

## 2.3 先体验，后解释

Oracle 优先呈现：

- 用户几点出门；
- 一天被什么任务切开；
- 哪些时间能被自己支配；
- 什么技能确实被使用；
- 哪个消息被点开但没有回应；
- 什么边界被设置、改变或放弃。

它不直接翻译成：

- “你感到妥帖”；
- “你已经自洽”；
- “你内心仍然不甘”；
- “这才是真正的你”。

心理意义由用户在体验中的选择、纠正与 Echo 对话共同生成。行为可以成为对话素材，但不是模型替用户做出的判词。

## 3. 为什么不能让模型直接返回“新 World State”

如果让模型每轮重写完整状态，容易出现：

- 忘掉上一轮选择；
- 无依据地修改关系或身份；
- 用新文本覆盖旧事实，失去审计线索；
- 把 Personal Model 当成因果；
- 为了让故事顺畅而改写 Reality Pack；
- 并发请求互相覆盖。

因此 Oracle 只输出增量操作：

```text
当前状态 version 3
+ 用户签名选择 event_07
+ Oracle 提议的 operations
+ Gate 校验
= Reducer 生成 version 4
```

每个 operation 必须带 `before_state`、`after_state` 和 `causal_refs`。

## 4. 三种 Mode

### 4.0 calibrate

在第一次生成节点前，Oracle 检查 Reality Pack 中仍未确定、但会显著改变生活结构的变量：

- 具体岗位方向；
- 住房来源与是否与父母同住；
- 通勤方式与时间；
- 上下班边界；
- 家庭距离与照护安排；
- 财务基线；
- 用户希望保留或降低的地方生活细节。

它不把这些全部变成问卷。系统按因果影响排序，每次只问一个，允许用户：

- 选择一个候选可能世界；
- 自己改写；
- 明确说现实中确实如此；
- 先保持未知。

校准的结果是 `Calibration Snapshot`，不是现实 Core 的自动更新。

#### 三类前提

| 类型 | 含义 | 能否写入现实 Core |
|---|---|---|
| real_world_fact | 当时现实中已经存在的事实 | 用户确认后可作为 Core 候选 |
| counterfactual_premise | 现实没有发生，但用户选择用于这次模拟的设定 | 只能进当前 World Archive |
| texture_preference | 只影响表达质感，不改变核心因果 | 作为体验配置保存 |

例如“父母当时已经在鄞州有房”与“如果我回来，他们很可能会给我买一套”不是同一种真相。后者即使很合理，也必须由用户明确选择作为 counterfactual premise，不能被模型写成现实事实。

### 4.1 initialize

第一次进入世界：

- 当前 World State 必须为 null；
- Reality Pack 必须 active 且版本一致；
- 创建第一个生活节点；
- 只把必要的现实锚点投影为初始状态；
- 提供 2–3 个真实可行动的下一步；
- 不把 Pack 中的“可能”自动写成已发生。

### 4.2 advance

用户提交一个签名选择后：

- 输入必须包含当前 World State；
- trigger 必须指向当前 `pending_choice`；
- 一次只消费一个 choice event；
- 至少一个状态操作必须直接引用该 event；
- 生成下一个节点及新的选择；
- 不能修改过去节点，只能追加历史。

v1 不支持后台自动跑完整人生，也不支持同一世界并行推进两条分支。

## 5. World State 是唯一模拟事实源

World State 由系统维护，包含：

- 世界、Journey、Seed、Reality Pack 版本；
- 当前时间视野与状态版本；
- `variables`：工作、时间、关系、经济、技能等当前状态；
- `tensions`：仍未解决、已转化或已解决的张力；
- `experienced_nodes`：已经经历的节点；
- `pending_choice`：当前可提交的选项；
- `last_transition_id`：用于幂等与审计。

所有内容都属于模拟 Archive，不属于现实 Core。

Calibration 中用户确认的 real-world fact 需重新经过 Memory Gate，Oracle 自己不能写 Core。

## 6. 因果引用

Oracle 只能引用以下合法 Cause：

1. Reality Pack 中通过 Gate 的 Setting、Constraint、Node、Event；
2. 当前 World State 中 active 的 variable / tension / experienced node；
3. 本次签名 user choice event；
4. 当前 choice ID；
5. 已授权的 Core fact ID，仅用于保持共同过去与现实硬约束。

禁止作为因果：

- Personal Model / Hypothesis；
- 用户目标问题；
- Echo 的对白；
- 未提交的 choice；
- 其他 world 的 Archive；
- 被 superseded / resolved 且与本次无关的状态；
- 模型自己声称的概率、直觉或“命运”。

Personal Model 即使由 Retrieval Bundle 提供，也只能帮助检查“选项是否可能与用户有关”，不能支持事件、状态变化或结局。

## 7. 一个合法的因果变化

```json
{
  "op_id": "op_time_boundary",
  "target_type": "variable",
  "operation": "update",
  "target_id": "var_relationship_time",
  "before_state": "共同时间主要靠临时协调",
  "after_state": "每周预留一段固定的跨时区共同时间",
  "dimensions": ["relational", "time"],
  "causal_refs": [
    "event_choice_001",
    "choice_protect_shared_time",
    "constraint_relationship"
  ]
}
```

这表示用户的行动改变了生活安排，不表示关系必然更好。

## 8. 节点不是剧情

每次 Transition Proposal 包含一个 `node`：

- `horizon`：允许的下一个时间视野；
- `scene_brief`：供渲染层使用的场景骨架；
- `ordinary_details`：普通生活的具体质感；
- `render_cues`：有来源的物件、作息、空间、氛围或界面锚点；
- `continuity_refs`：本节点延续的旧状态与历史；
- `active_tension_ids`：本节点真正相关的张力；
- `state_change_op_ids`：本节点要应用的状态操作；
- `choices`：用户可以采取的下一步行动；
- `uncertainties`：仍不能决定的事情。

Oracle 不写角色对白，不替 Echo 说话，不输出长篇小说。

Oracle 也不输出“生活是妥帖的”“心理大体平衡”“那种刺痛已经磨钝”等内心总结。可呈现的是具体行动、环境和未决张力；用户如何感受，由用户体验和 Echo 对话共同形成。

### 8.1 结构性摩擦，不是“平稳生活”宣传片

普通生活不等于只写便利、边界和小确幸。每个中长期世界都应检查这些自然摩擦是否存在、是否有依据：

- **反馈摩擦**：做了很多事，但结果、评价或影响很慢才返回；
- **制度摩擦**：岗位去向、竞聘、汇报与决策链改变了行动空间；
- **能力中心度**：某项能力偶尔被调用，却未必成为工作的中心；
- **时间转化摩擦**：有空闲不等于有能承接投入的项目；
- **家庭边界摩擦**：离家近同时改变照护、默认可用时间与独立安排；
- **身份可见度摩擦**：外部标签很好解释，日常贡献却未必有清晰反馈；
- **可离开性摩擦**：生活没有坏到必须走，也没有好到不再比较。

不是每个节点都要覆盖全部维度，也不能凭空制造同事敌意、领导打压或制度不公。至少要让长期节点中已有结构的维护成本与未决问题可见，不能只呈现“离家近、通勤短、晚上完整”的获益面。

反事实念头可以作为 `render cue / callback candidate` 出现，例如打开另一条路径的公开职位信息后没有行动；但只有在 Seed 明确存在该岔路、当前触发有依据时才能出现。Oracle 只记录行为与注意力，不写“她其实一直羡慕现实中的自己”。

### 8.2 具体质感的证据规则

具体细节是体验可信度的重要来源，但“具体”不能成为自由编造的借口。

允许：

- 英语工作约束 → 会议笔记里混合出现两种语言；
- 固定共同时间 → 日历里出现一块需要保护的时间；
- 通勤与地理约束 → 早晚被通勤切开的生活节律；
- 已存在的工作流程 → 任务表、工牌、值班界面等渲染锚点。

不允许：

- 凭空创造一个“赏识用户的领导”；
- 未经 Reality Pack 支持写出某办公室的固定布置；
- 为了有戏加入闲话、敌意或认可；
- 把 `render_cues` 当成已经发生的关系或事件。

每个 render cue 必须引用合法 cause。`callback_candidate` 只表示渲染层可以在未来回调这个锚点，不代表它自动成为长期世界状态。

## 9. 用户选择必须真正改变状态

一个 Choice 必须：

- 是用户能采取的行动、边界或资源分配；
- 标明它采用的行动策略；
- 不伪装成对外部结果的控制；
- 说明它承诺什么；
- 说明它保留什么；
- 说明它会暴露于何种成本；
- 明确“不保证什么”；
- 标明可逆性与反馈要多久才能看见；
- 不能是道德上明显正确的唯一选项。

坏选项：

- “努力并成功” vs “放弃人生”；
- “让公司融资成功”；
- “选择不分手”；
- “成为更勇敢的人”。

好选项：

- “接下跨职能任务，但固定每周两晚不加班”；
- “先把精力放在核心岗位，暂缓额外项目”；
- “主动请求明确三个月的职责边界”。

当 `mode=advance` 时，至少一个状态变化必须直接引用用户提交的 choice event。用户选择不能只改变旁白。

不同选项至少覆盖两种策略，例如：

- 先获取清晰度；
- 先保护边界；
- 深入投入一项能力；
- 做一个可逆实验；
- 暂缓承诺并收集信息；
- 请求支持；
- 缩小范围；
- 接受一次短期成本。

不要求每个选项都有对称的坏处。真正需要写清的是它把什么资源放在前面、保留什么、暴露于什么，以及何时才能获得反馈。

## 10. 获得、代价与普通生活

Oracle 不机械执行“有得必有失”，但必须展示交换如何改变：

- 获得可能减少某种成本，也可能增加新的维护成本；
- 代价不一定意味着痛苦，也可能只是时间被占用、选择变少或责任变多；
- 节点应容纳等待、重复、协调、通勤、照护与小幅进展；
- 不是每轮都需要重大事件；
- 没有新依据时，宁可推进普通生活，不制造转折。

## 10.1 Post-commit 反馈

Claude 方案里“选项自带即时 NPC 回应与关系变化”很有戏剧效率，但会提前决定外部结果。v1.1 改为：

```text
Oracle 生成 Choice
→ 用户提交
→ Reducer 更新状态
→ Renderer / Character 读取 accepted state
→ 生成感官反馈或 NPC 台词
→ Humanity Critic 审查
→ 展示
```

这样仍然能获得“世界回应了我”的即时体感，但回应依据的是已经提交的状态，而不是 Oracle 为了让选项好看而预写的奖励或惩罚。

## 11. 时间推进

Orchestrator 计算 `allowed_next_horizons`，Oracle 只能选择其中一个。

规则：

- 一次只推进一个节点；
- horizon 不倒退；
- 不使用具体日期或“第 312 天”；
- 不为赶进度跳过会改变因果结构的未解决张力；
- 年度跨度不能自动把可能事件写成既成事实；
- 节点数量不是人生长度，只是体验采样。

## 12. 不确定事件

Oracle 只有在以下条件全部满足时，才能实例化 Reality Pack 的 uncertain event：

1. event 存在于当前 active Pack；
2. `safe_to_simulate=true`；
3. `requires_user_consent=false`，或系统提供有效 consent；
4. 与当前 horizon 和状态相关；
5. 不是为了制造戏剧；
6. Proposal 明确引用 event ID。

未发生的事件保持未知。`likelihood=high` 也不等于必然发生。

## 13. 连续性与重大变化

对 valued continuity：

- 不能无故消失；
- 可以产生维护成本、边界调整或新的相处方式；
- 不能保证结果永远不变；
- 关系结束、永久健康变化、失业等重大改变，不能由 Oracle 自行实例化；
- 用户明确行动仍不等于外部结果立即确定。

## 14. Memory 使用

Oracle 的 Retrieval Bundle 只允许：

- 当前 Journey 的已授权 Core；
- 当前 World 的签名 Observed choices；
- 当前 World Archive；
- 直接相关、非 contested 的 Hypothesis 摘要。

使用限制：

- Core 可保持共同过去与硬约束；
- Observed choice 可作为本世界已提交行动；
- Archive 只说明当前世界已发生什么；
- Hypothesis 不能作为 causal ref，不能产生状态事实；
- Bundle 到期或用途不匹配时拒绝调用；
- Oracle 输出由系统派生写入 Archive，不由模型直接写 Memory。

## 15. 状态操作

v1 支持：

- `create`：新建 variable 或 tension；
- `update`：更新已有 active 项；
- `resolve`：将 tension 解决或将 variable 标记为 superseded；
- `transform`：只用于 tension，旧张力转化为新表述。

硬规则：

- update / resolve / transform 必须精确匹配 `before_state`；
- create 的 target ID 不能已存在；
- 不允许删除历史；
- 每个 operation 至少一个合法 causal ref；
- 每个 operation 必须被 causal edge 解释；
- 同一 transition 不允许对同一 target 进行冲突操作。

## 16. Causal Edge

每条因果边包含：

- `cause_refs`：合法原因；
- `effect_op_ids`：受影响的状态操作；
- `mechanism`：原因如何传导；
- `strength`：
  - grounded：直接来自用户行动、confirmed constraint 或既有状态；
  - plausible：基于 probable / possible Reality Pack 基线。

`plausible` 不表示概率，只表示这是一条可解释的模拟假设。

## 17. Gate 与 Reducer

Oracle Gate 检查：

1. Schema、ID、版本和幂等；
2. Reality Pack 是否 active；
3. signed choice 是否匹配 pending choice；
4. horizon 是否允许；
5. causal refs 是否在白名单；
6. Hypothesis 是否被当作因果；
7. before state 是否精确匹配；
8. 用户 choice 是否真正产生状态影响；
9. 不确定事件是否合法实例化；
10. 重大不幸、刻板印象、心理结论与结果保证；
11. valued continuity 是否被无故抹除；
12. choices 是否可行动、非操纵、非虚假控制。
13. render cues 是否具体且有合法因果来源；
14. continuity refs 是否真正延续旧状态；
15. Choice 策略、可逆性与反馈周期是否有区分度；
16. 是否偷写了 post-commit NPC 回应或关系结果。

确定性 Gate 通过后，再由独立 Humanity Critic 做语义审稿。Critic 不能改变状态或替 Gate 授权，只能判定是否需要重写表达与选择设计。

World Reducer：

- 先验证所有操作，再原子提交；
- 任一操作失败，整次 transition 不落盘；
- `state_version + 1`；
- 消费旧 pending choice；
- 追加 experienced node；
- 建立新 pending choice；
- 记录 transition hash，防止重复提交。

## 18. 纠正、回滚与分支

用户说“这不对”时：

- 不让 Oracle 在下一轮偷偷改写过去；
- 生成 `world_correction_submitted` Observed event；
- 暂停推进；
- 若纠正的是现实 Seed / Pack，回到 General / History 并创建新版本；
- 若纠正的是模拟偏好，可从上一个有效 World State fork 新分支；
- 原分支 Archive 保留或按用户请求删除；
- 不使用数据库式原地覆盖伪造历史。

## 19. 并发与幂等

- Input 带 `based_on_state_version`；
- Reducer 使用 compare-and-swap；
- 同一 choice event 只能消费一次；
- 重复 request 返回已存在 transition；
- 两个并发 transition 只有一个能提交；
- 失败的一方必须基于新版本重新生成，不能强行 merge 模型文本。

## 20. 36 小时 Demo 范围

必须实现：

- initialize / advance 两个 Mode；
- World State v1；
- 每次一个节点；
- 2–3 个可行动 Choice；
- 增量状态操作；
- 因果边；
- signed choice 与 CAS；
- safe uncertain event 检查；
- valued continuity 保护；
- 有依据的 render cues 与跨节点回调；
- Choice 策略、可逆性、反馈周期；
- 独立 Humanity Critic；
- post-commit Renderer / Character 边界；
- Archive / Observed 派生事件；
- Schema、示例和回归集。

暂不实现：

- 多世界实时并行模拟；
- 自动随机事件引擎；
- 精确经济数值模型；
- NPC 自主 Agent 社会；
- 无用户参与的长期后台演化；
- 用模型自动 merge 并发分支。

## 21. 关联文件

- 输入 Schema：`schemas/oracle-agent.v1.input.schema.json`
- Calibration Schema：`schemas/oracle-agent.v1.calibration-output.schema.json`
- Proposal Schema：`schemas/oracle-agent.v1.transition.schema.json`
- World State Schema：`schemas/world-state.v1.schema.json`
- System Prompt：`prompts/oracle-agent.v1.system.md`
- Runtime Policy：`prompts/oracle-agent.v1.runtime-policy.md`
- Humanity Critic Prompt：`prompts/humanity-critic.v1.system.md`
- Gate / Reducer：`orchestration/oracle-agent-v1.gate-reducer.md`
- Humanity Critic Schema：`schemas/humanity-critic.v1.output.schema.json`
- 输入示例：`examples/oracle-agent.v1.input.example.json`
- Proposal 示例：`examples/oracle-agent.v1.transition.example.json`
- Advance 示例：`examples/oracle-agent.v1.advance-transition.example.json`
- World State 示例：`examples/world-state.v1.example.json`
- Advance 后 World State：`examples/world-state.v1.after-advance.example.json`
- Humanity Critic 示例：`examples/humanity-critic.v1.output.example.json`
- 宁波 Calibration 示例：`examples/oracle-agent.v1.calibration-output.ningbo.example.json`
- 宁波 Calibration 输入：`examples/oracle-agent.v1.calibration-input.ningbo.example.json`
- 宁波首节点示例：`examples/oracle-agent.v1.ningbo-node.example.json`
- 回归集：`evals/oracle-agent.v1.cases.jsonl`
