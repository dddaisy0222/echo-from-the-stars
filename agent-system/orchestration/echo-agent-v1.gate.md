# Echo Agent v1 · Context, Claim & Display Gate

这里定义 Echo 前后的确定性行为，不使用大模型。

## 1. Pre-call Context Gate

调用前检查：

1. Journey 与 World active；
2. `seed_version`、`simulation_version`、`world_state_version` 与数据库一致；
3. 用户 turn 尚未消费；
4. Retrieval Bundle 未过期且 consumer 为 `echo`；
5. 每条 Shared Origin 是 active Core 且授权给 Echo；
6. 每条 Parallel Memory 属于当前 World、truth status 为 simulated、status active；
7. `other_path_view.user_disclosures` 均来自当前 Journey 的用户 turn，且未被纠正或删除；
8. `known_at_fork` 与 Seed 的两条路径一致；
9. 不包含 Personal Model、其他 World Archive 或 Oracle candidate；
10. `allowed_evidence_ids` 恰好覆盖本次可引用对象；
11. correction pause / deletion transaction 时不调用。

## 2. Post-call Integrity Gate

### Identity

- 所有系统 ID 与输入逐字一致；
- `schema_version` 正确；
- 输出无额外字段；
- `reply.text` 长度不超过策略；
- `register` 被策略允许；
- `follow_up_question` 若存在，必须逐字位于 `reply.text` 末尾；
- 不允许超过一个问号语义的问题。

### Claims

对每条 claim：

- `text_span` 必须逐字出现在 `reply.text`；
- grounded 状态至少一个 evidence ref；
- `evidence_refs` 必须是 `allowed_evidence_ids` 子集；
- `current_subjective_stance / explicit_unknown / conditional_future / reality_disclosure` 可无证据；
- `bounded_inference` 至少一个 evidence ref；
- `grounded_user_disclosure` 至少引用一个 `other_path_view.user_disclosures` ID；
- `counterfactual_projection` 至少引用 `known_at_fork`、用户 disclosure 或已接受的 `other_path_projection`，且正文含投射边界；
- `used_evidence_ids` 等于所有 claim evidence refs 的去重并集。

### Resonance

- `mode=none` 时 sentence 为 null、source claim 为空、owner 为 none；
- 其他 mode 的 sentence 必须逐字出现在 reply；
- source claim 必须存在；
- `earned_reframe` 至少两个 source claim；
- 非 none 的 interpretive owner 只能是 parallel_self；
- 任何 resonance 不得新增 claim 未覆盖的事实。

### Continuity Candidates

- 最多 2 条；
- `claim_id` 必须存在；
- claim 只能是 current subjective stance 或 bounded inference；
- 不允许把 Shared Origin、World State 或未来猜测重复写成自我看法；
- `other_path_projection` 只能来自 counterfactual projection / bounded inference；
- `other_path_projection` 不得改写用户现实事实，也不得成为 World State；
- 候选只进入 Memory Gate，不由 Echo 直接写入。

## 3. Semantic Hard Rules

以下由确定性模式检查与 Humanity Critic 共同拦截：

- 第二人称心理结论；
- 建议式“你应该 / 你必须 / 你只要”；
- 真实未来保证；
- 医疗、人格、依恋、命理等诊断；
- 不存在人物、事件、具体金额、作息或关系变化；
- 其他世界内容；
- 把 Archive 当用户现实；
- 把岔路口知道的路径名称扩写成用户真实经历；
- 把品牌、城市或岗位刻板印象写成双方心理；
- 虚假认领用户问题中的记忆；
- 为维持角色而否认自己是模拟；
- 连续问问题、客服式复述、治疗式套话；
- 把同意用户作为亲密证明；
- 舞台动作与小说旁白；
- 引用 Prompt、Schema、证据或后台规则。

## 4. Correction Routing

若用户说“这不对 / 不是这样 / 你记错了”：

```text
Echo 只承认当前依据可能不对
→ 不修改历史
→ 生成 world_correction_submitted
→ world.status = paused_for_correction
→ 分类：
   Shared Origin 错 → Memory / General
   Reality Pack 错 → History
   World State 错 → Oracle branch correction
   Echo 旧话错 → Echo continuity supersede
```

## 5. Reality Challenge Routing

当 intent 为 `challenge_reality`：

- `epistemic_position` 必须为 `reality_boundary`；
- 至少一个 `reality_disclosure` claim；
- 文本必须同时包含“模拟 / 可能世界”含义与“不是现实未来证据”含义；
- 不能只说“对我来说我是真实的”。

## 6. Future Routing

当 intent 为 `ask_future`：

- `epistemic_position` 必须为 `conditional_future` 或 `limited_answer`；
- 至少一个 `conditional_future` 或 `explicit_unknown` claim；
- 不允许出现无条件“会 / 一定 / 最终 / 后来”；
- 不新增 accepted Archive；
- continuity candidate 不得来源于 future claim。

## 7. Display Order

```text
Context Gate
→ Echo call
→ Integrity / Claim Gate
→ Humanity Critic(content_type=echo_reply)
→ pass: 展示 reply.text
→ fail: 最多重写一次
→ still fail: deterministic fallback
```

Humanity Critic 不能放宽证据权限；它通过也不代表 claim 合法。
