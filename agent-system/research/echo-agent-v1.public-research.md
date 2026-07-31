# Echo Agent v1 · Public Research Notes

研究日期：2026-07-31  
用途：记录公开项目中真正转化为 Echo 机制的部分，不作为“照抄 Prompt”的素材库。

## 1. 核心判断

公开项目的共同结论不是“写一个更长的角色 System Prompt”，而是：

```text
可信角色
= 当前处境
+ 有生命周期的记忆
+ 对话历史
+ 有来源的反思
+ 跨情境评测
```

Echo 还必须额外解决反事实产品独有的问题：

- 现实与模拟隔离；
- 不把用户期待写成平行经历；
- 不让角色沉浸变成真实性欺骗；
- 不把角色一致性变成固定人格标签；
- 不把“戳中”优化成谄媚。

## 2. Sources

### Generative Agents

- Paper: https://arxiv.org/abs/2304.03442
- Repository: https://github.com/joonspk-research/generative_agents
- Conversation prompt: https://github.com/joonspk-research/generative_agents/blob/fe05a71d3e4ed7d10bf68aa4eda6dd995ec070f4/reverie/backend_server/persona/prompt_template/v3_ChatGPT/agent_chat_v1.txt
- Evidence prompt: https://github.com/joonspk-research/generative_agents/blob/fe05a71d3e4ed7d10bf68aa4eda6dd995ec070f4/reverie/backend_server/persona/prompt_template/v2/insight_and_evidence_v1.txt

观察：

- 论文架构以完整经历记录、相关检索、高层 reflection 与 planning 形成可信行为；
- 对话 Prompt 显式提供当前角色、过去上下文、当前位置和双方“脑中已知信息”；
- insight prompt 要求每条洞察标出来源 statement 编号。

采用：

- 当前处境与记忆分层；
- 有限相关检索；
- insight-to-evidence；
- 对话不依赖静态角色卡。

不直接采用：

- 自由 reflection 自动成为长期事实；
- 对 NPC 的自由心理建模；
- 为角色自主生活而进行的整日 planning。

### AI Town

- Repository: https://github.com/a16z-infra/ai-town
- Conversation implementation: https://github.com/a16z-infra/ai-town/blob/7b242334bfbfef02f7718bded120d431e8f307df/convex/agent/conversation.ts
- Memory implementation: https://github.com/a16z-infra/ai-town/blob/7b242334bfbfef02f7718bded120d431e8f307df/convex/agent/memory.ts

观察：

- 对话输入组合 identity、plan、related memories、previous conversation 与完整 current chat history；
- 记忆先向量候选，再综合 relevance、recency、importance；
- 对话结束后以第一人称摘要形成 memory；
- reflection 输出 insight 及关联 statement IDs。

采用：

- conversation history 是核心输入，不是可选项；
- 相关记忆不等于全部记忆；
- 第一人称连续性；
- 反思必须引用来源。

改造：

- Echo 的 importance 不等于“越戏剧越重要”；
- 摘要不能写入现实 Core；
- Reflection 必须经过 evidence、world、consent Gate；
- “是否喜欢互动”不能由模型随意永久化。

### MemGPT

- Paper: https://arxiv.org/abs/2310.08560

观察：

- 有限上下文需要 working context 与 archival memory 的层级管理；
- 多会话角色要能记住、反思并随时间演化。

采用：

- Recent Turns / Durable Context / Parallel Archive 分层；
- 明确 retention 与失效机制；
- 删除、纠正后使 Retrieval Bundle 失效。

### PersonaChat

- Paper: https://arxiv.org/abs/1801.07243

观察：

- 无条件闲聊容易泛化、人格不一致、不够具体；
- profile conditioning 能提升具体度与持续性。

采用：

- Echo 必须有可追溯的 Shared Origin 与 Current Self；
- 回答要能依赖个体经历。

风险：

- 固定 persona sentences 会过早把用户压成一个人设；
- Echo 用经历分化，不用性格卡决定所有回答。

### BlendedSkillTalk

- Paper: https://arxiv.org/abs/2004.08449

观察：

- engaging、knowledgeable、empathetic 需要自然融合；
- 单独技能模型容易产生技能选择偏置。

采用：

- 不以“先共情”作为固定模板；
- grounded answer 优先，语气与共情服务于回答。

### RoleLLM

- Paper: https://arxiv.org/abs/2310.00746

观察：

- 角色扮演需要 profile construction、context-based instructions 与专门 benchmark；
- 单靠通用模型能力不能保证角色忠实度。

采用：

- 用结构化 context，而不是一句“你就是另一个用户”；
- 单独建设 Echo evals。

### Character-LLM

- Paper: https://arxiv.org/abs/2310.10158

观察：

- 角色经历、profile、情绪状态共同影响角色表现；
- 评测使用对角色与经历的访谈。

采用：

- 经历必须进入角色；
- 用访谈型问题测试跨情境一致性。

不采用：

- 自由生成角色情绪史；
- 把虚构角色传记模式直接套到真实用户。

### InCharacter

- Paper: https://arxiv.org/abs/2310.17976

观察：

- 只测知识与语言风格不能充分衡量角色忠实度；
- 跨问题的心理访谈能暴露不一致。

采用：

- 测试跨情境立场一致性。

不采用：

- 在产品中给用户或 Echo 输出心理量表标签；
- 把量表结果当“真正人格”。

### PersonaGym

- Paper: https://arxiv.org/abs/2407.18416

观察：

- 自由情境中的 persona consistency 需要动态、大规模评测；
- 模型规模和复杂度不保证 persona capability。

采用：

- 模型选型必须跑 Echo 自有 benchmark；
- 不用一个“很戳”的样例决定质量。

### SOTOPIA

- Paper: https://arxiv.org/abs/2310.11667

观察：

- 社会智能需要多维评估；
- 社会常识、策略与关系不能压缩成任务成功率。

采用：

- 用户继续聊、点赞或情绪强烈不等于回复正确；
- 同时评 world fidelity、关系自然度与非操控性。

### Sycophancy

- Paper: https://arxiv.org/abs/2310.13548

观察：

- 经过人类反馈的模型可能优先匹配用户信念，而不是真实；
- 人类和偏好模型都可能奖励写得有说服力的迎合。

采用：

- 独立 anti-sycophancy suite；
- 虚假记忆、期待性提问、幸福比较必须保持证据边界；
- 不把即时点赞当唯一训练/评测信号。

## 3. 对公开 Prompt 的判断

值得直接学习的不是措辞，而是结构：

- Generative Agents：Current Context + retrieved info + past context；
- AI Town：identity + current plan + related memory + full chat history；
- insight with evidence；
- short, bounded response。

不应照搬：

- “永远不要承认是模拟”的沉浸规则；
- 固定人格与所谓不变量；
- 每轮回忆旧事；
- 每次都问一个问题；
- 每个体验都总结喜欢/不喜欢；
- 以戏剧性给记忆打高分；
- 用心理测试给真实用户定型。

## 4. Echo 的新增贡献

在这些公开方法之上，Echo v1 增加：

1. Shared Origin / Parallel Archive / Present Stance 三层真相；
2. 每句 claim 的 epistemic status；
3. evidence allowlist；
4. earned resonance gate；
5. explicit reality disclosure；
6. anti-sycophancy policy；
7. user correction pause；
8. Echo continuity candidates，而不是模型直接写记忆；
9. ordinary / reflective 节奏控制；
10. 回归集覆盖“会不会承认不知道”。
