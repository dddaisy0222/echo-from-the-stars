# Echo Agent System Bundle

这里保存 Echo 的正式 Agent 设计。每个 Agent 必须同时具备：

1. 清晰的职责与不可越过的边界；
2. 可以直接投入模型调用的 System Prompt；
3. 机器可校验的输入、输出 Schema；
4. 典型用例、反例与验收标准。

## 设计原则

- Agent 是职责边界，不一定对应独立模型或独立服务。
- Orchestrator 只做确定性调度、权限控制和 Schema 校验，不使用大模型。
- 用户明确说过的现实、用户在产品中的真实行为、AI 模拟内容必须分层保存。
- 任何用户模型都只是可修正假设，不是人格判断。
- 平行世界是反事实模拟，不是预测、算命或心理诊断。
- 模型不可因为故事需要而擅自制造疾病、死亡、创伤、背叛等重大事件。
- 世界的目的不是替用户选择，而是让用户看见每条路真实的交换，最终回到现实。
- 具体生活质感必须有事实或状态来源，不能用电影感掩盖编造。
- 独立 Humanity Critic 只做语义审稿，不写状态、不降低 Gate 权限。

## Agent 顺序

| 顺序 | Agent | 责任 | 当前状态 |
|---|---|---|---|
| 01 | General Agent | 与用户共同建立最小充分 World Seed | v2 生产候选已完成；v1 已归档 |
| 02 | Memory Agent | 管理 Core、Observed、Archive 与 Personal Model | v1 生产候选已完成 |
| 03 | History Agent | 建立可追溯、有边界的反事实现实底稿 | v1 生产候选已完成 |
| 04 | Oracle Agent | 校准关键前提，维护因果世界并逐节点推进 | v1.3 生产候选已完成 |
| 05 | Echo Agent | 成为沿另一条路生活、有证据边界与独立立场的平行自我 | v1.1 生产候选已完成 |
| 06 | Reflection Mode | 并置两条人生，让用户带着发现回到现实 | 待设计 |

## 文件约定

- `NN-agent-name.md`：完整产品与推理设计。
- `prompts/*.system.md`：可直接发送给模型的 System Prompt，不混入产品说明。
- `schemas/*.schema.json`：用于后端校验模型输出。
- 每次修改 Prompt 时，应同步修改对应设计文档与 Schema。
- 已进入评审的版本不直接覆盖；旧版本移动到 `archive/`，新版本使用明确版本号。
