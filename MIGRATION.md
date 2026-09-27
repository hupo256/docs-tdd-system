# docs_tdd 迁移方案：从自研重型系统到「现成轮子」三层架构

> 状态：提案（2026-09-27）。目标：把「只给需求 → 正确、完整、省 token 地交付」这条链路
> 交给官方 harness + 社区成熟件，docs_tdd 退役为**领域资产库**。
> 决策原则：**能用现成件的不写脚本，能用机械校验的不靠 prompt，能一次确认的不做多次门禁。**

---

## 1. 现状快照（本仓库实测）

| 资产 | 规模 | 处置 |
|---|---|---|
| `common/rules/` | 34 篇 / ~400KB（rule-router 已收敛到 61 行 ✅） | **归档**，仅提炼 2 项（见 §3） |
| `common/engine/` | 236 个文件 / 2.7MB | **归档**，不迁移 |
| `prds/PR-xxxx/` 台账 | 每项目 15+ JSON、agent/product/evidence 目录；PR-02265 一个简单需求 = 8.4MB 文档 | **归档**（git 保留历史），新需求不再建 |
| `inbox/`（PRD/Figma/API 原文） | 唯一不可替代的事实源 | **保留**，改为极简结构 |
| lite 实验数据 | 10 分钟 / 7K token / 覆盖率 100% | **作为目标基线**，新架构按此对标 |

结论：痛点不在某个 bug，而在架构——用 prompt 对抗模型概率性，导致规则军备竞赛；
用 JSON 台账记录流程状态，制造漂移和 token 黑洞；自建编排层与 Claude/Codex 官方
harness（plan mode、skills、hooks、subagents）抢活，且永远落后一代。

---

## 2. 目标架构：三层现成轮子

```
┌─ 第 1 层 分支与工作区 ── git worktree（已在用，保留）
│    kickoff 脚本化：feat/PR-xxxx 分支 + 独立 worktree + .ai/PR-xxxx/ 目录骨架
│
├─ 第 2 层 规格与任务 ── OpenSpec（轻量）或 spec-kit（正式）二选一
│    核心产物只有一个：spec.md —— 原子需求 checklist（R1/R2/…），
│    由 AI 从 PRD 抽取，【人一次性审签】。此后它交付物的唯一验收真值源。
│    TDD 循环交给 superpowers: test-first / spec-kit: specify→implement 命令。
│
├─ 第 3 层 执行与守护 ── 官方 harness，不自研：
│    · plan mode：开工前对齐（替代 G0-G8 前半段）
│    · skills：按需加载领域规范（替代 rules/*.md 常驻阅读）
│    · hooks（Claude Code PostToolUse / Codex 等价物）：保存即 lint/tsc（替代 verify 引擎）
│    · subagent：冷读 review 需求覆盖（替代 coverage-review 流程件）
│
└─ 底座 机械验证 ── eslint + tsc + vitest/playwright + CI
     「漏功能」的最终防线不是规则文本，而是：每条 Rn 必须映射到至少一个测试名。
```

选型建议：**默认 OpenSpec**（changes/ 目录 + 人工审批 spec，心智负担小，适合
「前端简单改动」为主的需求流）；只有跨团队、需要 contract 管理的少数大需求才用
spec-kit。两者都直接解决痛点 2（漏需求）：spec checklist + 人一次审签 + 每条映射测试。

---

## 3. docs_tdd 仅保留的两块资产（其余归档）

1. **领域 checklist skill**：从 `quality-checklist.md`、`ui-style-token-rules.md`、
   `react-component-props-types.md`、`prd-feature-inventory.md` 中提炼成
   1~2 个 SKILL.md（如 `fameex-frontend-checks`），按需加载，不常驻上下文。
2. **来源索引**：飞书 PRD/Figma/API 链接与同步方式（`lark-sources.json` 的简化版），
   放进每个项目的 `spec.md` 头部即可，不需要独立 manifest 体系。

`rule-router.md`（61 行）可暂留作过渡，新架构稳定后并入 AGENTS.md。

---

## 4. 新协议：一个需求的完整生命周期（目标 ≤15 分钟 / ≤20K token）

```
你的一句话:  "PR-02500 <飞书链接>，做完提测"
   │
   ├─ 1. kickoff（脚本，秒级）：worktree + .ai/PR-02500/spec.md 骨架
   ├─ 2. AI 读 PRD → 填 spec.md：R1..Rn 原子需求 + 歧义问题（≤3 个，没有就不问）
   │      ⏸ 唯一人工卡点：你扫一眼 checklist，回复 approve 或改哪条
   ├─ 3. AI 实现：每条 Rn 先写失败测试再实现（TDD），hooks 保证 lint/tsc 不劣化
   ├─ 4. 冷读自查（subagent）：拿 PRD 原文 vs diff，输出「未覆盖项」清单，空则通过
   ├─ 5. commit + push + 提测信息（模板化）
   └─ 6. spec.md 里勾选状态即项目全部档案 —— 不再有 agent/ evidence/ runs.jsonl
```

针对三个痛点的对应关系：

| 痛点 | 旧系统失效原因 | 新架构对策 |
|---|---|---|
| ① 小需求耗时长、token 巨量 | 常驻读 400KB 规则 + 维护十几个 JSON 台账 | 常驻仅 AGENTS.md（<60 行）；产物只有 spec.md 一个文件；规则改 skill 按需加载 |
| ② PRD 明显功能漏做 | 规则文本约束是概率性的，多门禁≠一次有效确认 | spec checklist 人审签 + 每条 Rn 强制映射测试 + 步骤 4 冷读对账（原文 vs diff） |
| ③ 越加规则越慢 | 规则互相引用需交叉推理，拖慢每次决策 | 硬规则 ≤10 条全进 hooks（机器执行零推理成本），prompt 层规则趋近于 0 |

---

## 5. 安装清单（第 0 周即可做完）

```bash
# Claude Code
claude plugin marketplace add anthropics/skills        # 官方 skills
claude plugin install superpowers@superpowers-marketplace  # TDD/debug/planning 纪律
npm i -g @basscss/openspec  # 或：uv tool install specify-cli（spec-kit，二选一）

# 项目内（apps/web）
# hooks 配置写入 .claude/settings.json：PostToolUse -> eslint --fix + tsc --noEmit(增量)
# 复制本仓库提炼出的 fameex-frontend-checks skill 到 ~/.claude/skills/
```

Codex 侧：AGENTS.md 软链机制保持不变（三工具同源已经做对了，保留），
OpenSpec 是纯 CLI+Markdown，两边通用。

---

## 6. 迁移步骤（两周制，含并行验证）

| 阶段 | 动作 | 退出标准 |
|---|---|---|
| W0（1 天） | `git tag docs-tdd-final`；新建 `archive/` 移入 rules/engine（git mv，历史可查）；冻结：不再接受任何新规则条目 | 仓库无新增规则可能 |
| W1 | 装 OpenSpec + superpowers + hooks；写 `kickoff.sh`（worktree+spec 骨架）；提炼领域 checklist skill | 用 1 个**已完成的简单需求**（如重放 PR-01947）走通 §4 全流程，计时计 token |
| W2 | 接下来 2~3 个真实需求全程走新协议；lite 基线对比表贴在 spec.md 底部 | 平均耗时 ≤15min、无漏需求、你的人工介入次数 ≤1/需求 |
| 之后 | 达标 → docs_tdd 正式只读归档；不达标 → 只回滚 §4 的某一步（每一步独立可回退），**不回滚到旧系统整体** | — |

风险控制：
- 旧 prds/ 目录不动，存量 v1/v2 项目如需返工仍按旧 README 执行（自然消亡）。
- 新协议任何一步出问题，最坏损失是该步本身，不存在系统性回归。

---

## 7. 明确不再做的事（防止再次军备竞赛）

1. 不再为「AI 偶尔不守规矩」新增规则文本——先判断能否变成 hook/测试/lint。
2. 不再新建任何流程状态 JSON（spec.md 的 checkbox 是唯一状态）。
3. 不再自建 gate/verify/pipeline 引擎——官方 harness 与社区件够用且更新更快。
4. 规则总量设硬上限：AGENTS.md ≤60 行 + 硬规则 ≤10 条，超出必须先删一条再进一条。
