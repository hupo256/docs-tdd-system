# v4 升级行动方案（2026-09-23）

> 基于 v4-upgrade-plan-20260923.md 的现状诊断

## 🎯 推荐方案：A + B 组合

### Phase 1: 补全 v4.0（1-2 小时，今天完成）

**目标**：让 v4.0 名副其实

**执行**：
```bash
# 1. 备份当前 rule-loader
cp common/engine/agent-scripts/lib/rule-loader-v4.mjs{,.backup}

# 2. 编辑 rule-loader-v4.mjs，修改优先级列表
# 将以下规则加入优先级列表：
#   - api-schema-mapper-core.md (替换 api-and-mapper.md)
#   - i18n-key-literal-rule.md
#   - react-query-zustand-split.md
#   - fameex-shared-components.md

# 3. 验证
node common/engine/agent-scripts/docs-tdd.mjs context PR-02233 standard

# 4. 确认加载了所有新规则且字符数 < 80000

# 5. 提交
git add common/engine/agent-scripts/lib/rule-loader-v4.mjs
git commit -m "feat(v4.0): 集成剩余 4 个新规则文件

- 替换 api-and-mapper.md → api-schema-mapper-core.md
- 新增 i18n-key-literal-rule.md
- 新增 react-query-zustand-split.md  
- 新增 fameex-shared-components.md

standard 档现在加载 10-12 个规则（取决于优先级排序）
总字符数仍在 80K 预算内

Closes v4.0 规则补全"
```

**验收标准**：
- [ ] standard 档加载 ≥ 10 个规则
- [ ] 包含所有 7 个新创建的规则文件
- [ ] 总字符数 < 80000
- [ ] PR-02233 context 命令正常运行

---

### Phase 2: 解除 PR-02419 阻塞（今天决策）

**决策点**：业务信息缺失

**方案 2A：等待业务信息**（如果预计 1-2 天内能拿到）
- 联系产品/后端确认：
  - 公司做市用户的 type ID
  - 修改用户类型的 API 接口
  - 批量设置类型功能的现状
- 设置 deadline：48 小时内拿不到 → 转方案 2B

**方案 2B：换需求实验**（推荐）
- 从 inbox 中找一个无阻塞的小需求：
  - 单页面改动
  - < 3 个文件
  - 纯前端（无 API 依赖或 API 已就绪）
  - 需求描述清晰（不需要反复确认）
- 用人工提炼 + lite work-item 跑一次完整流程
- **目标**：验证 lite 模式技术流程，不是完成特定需求

**执行**：
```bash
# 如果选方案 2B
# 1. 寻找候选需求
ls prds/*/inbox/lark-sync/prd-latest.md | xargs -I {} bash -c 'echo "=== {} ===" && head -50 {}'

# 2. 选一个简单的，启动 lite 实验
docs-tdd kickoff PR-XXXXX --kind feature

# 3. 人工提炼（2-3 分钟）
# 4. 生成 lite work-item（手动或 AI 辅助）
# 5. 实现（记录时间）
# 6. 记录数据：提炼时间、生成时间、实现时间、token 消耗
```

---

### Phase 3: 收集 lite 数据（1-2 周）

**目标**：用数据决策是否推进 v4.1

**执行**（跑 3 个小需求）：

| 指标 | 记录内容 | 对比基线 |
|---|---|---|
| 人工提炼时间 | 看 PRD → 写出"要做什么" | - |
| AI 生成时间 | 提炼 → work-item | full extraction 时间 |
| 实现时间 | work-item → 代码完成 | 历史类似需求 |
| Token 消耗 | 全流程 token | full extraction token |
| 准确率 | 是否需要返工/补充需求 | full extraction 准确率 |

**决策表**：

| 数据结果 | 决策 |
|---|---|
| 节省 ≥ 50% 时间 且 准确率 ≥ 90% | ✅ 推进 v4.1 实施 |
| 节省 30%-50% 时间 且 准确率 ≥ 85% | ⚠️ 简化 v4.1（不改 schema，只改流程） |
| 节省 < 30% 时间 或 准确率 < 80% | ❌ 放弃 lite 模式，探索其他方向 |

---

## 📊 成功指标

### v4.0 完成标准
- [x] 7 个新规则文件已创建
- [ ] 所有新规则文件已集成到 rule-loader ← **待完成**
- [x] standard 档预算控制在 80K 以内
- [ ] 在真实项目中验证规则加载正常

### v4.1 启动标准（数据驱动）
- [ ] 完成 ≥ 3 个 lite 实验
- [ ] 数据显示节省 ≥ 30% 时间
- [ ] 数据显示准确率 ≥ 85%
- [ ] 适用场景评估 ≥ 50% 需求

---

## ⚠️ 风险控制

### 不要做的事
- ❌ 不要在没有数据支撑的情况下推进 v4.1 实施
- ❌ 不要让 PR-02419 阻塞整个 lite 验证
- ❌ 不要在 v4.0 未完成的情况下标记"已完成"
- ❌ 不要花超过 1 周时间在系统迭代上（应该聚焦真实需求）

### 止损线
- 如果 Phase 1 发现集成 4 个规则后超预算 → 只集成优先级最高的 2 个
- 如果 Phase 2B 找不到合适的小需求 → 暂停 lite 验证，回归基本需求
- 如果 Phase 3 数据不支持 → 立即停止 v4.1，转向其他优化方向

---

## 🎯 本周交付物

**必须交付**：
1. [ ] v4.0 补全（4 个规则集成）+ 验证通过
2. [ ] PR-02419 决策（继续 or 换需求）
3. [ ] 至少 1 个 lite 实验完成 + 数据记录

**可选交付**：
- [ ] 3 个 lite 实验全部完成
- [ ] 初步数据分析报告
- [ ] v4.1 实施 go/no-go 决策

---

## 📝 决策记录

**2026-09-23 决策**：
- [x] 采用方案 A+B 组合
- [ ] Phase 1: 补全 v4.0（执行中）
- [ ] Phase 2: 决策 PR-02419 去向
- [ ] Phase 3: 数据收集计划确认

**待决策**：
- [ ] 是否继续 PR-02419？（等 48h vs. 换需求）
- [ ] lite 模式的最小可行验证范围（1 个 vs. 3 个实验）
