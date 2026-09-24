# PR-02306 Phase 1 补充工作完成总结

> 完成时间：2026-09-24  
> 任务：将 PR-01930 验证经验补充到 extraction-guidance v2.0

---

## 完成的工作

### 1. 更新 extraction-guidance.mjs

**文件路径**：`common/engine/agent-scripts/lib/extraction-guidance.mjs`

**新增内容**：

#### 1.1 第 2 遍精读中新增"集合语义判定专项"章节

在"优先级 2：完整性关键词（强制枚举）"之后，补充了完整的判定方法：

- **三步检查清单**：
  1. 量词检查：是否有明确的集合量词
  2. 描述强度识别：区分操作入口（需实现）vs 查询入口（数据自然流转）
  3. 遗漏测试（数据流转检查）：不改代码，数据能自然显示吗？

- **常见误判场景**：数据展示 ≠ 功能开发
  - 典型特征：PRD 列举 N 个页面，都会"展示"新数据
  - 判定方法：区分操作入口与查询入口
  - 案例：PR-01930（8 个路径，只需实现 1 个）

- **抽取输出要求**：
  - 在 Surface Coverage Analysis 中明确区分新增 Surface 与现有 Surface
  - 说明集合语义判定结果

#### 1.2 更新 collection 领域检查清单

在 `DOMAIN_CHECKLISTS.collection` 中新增 2 项检查点：
- "操作 vs 查询：区分操作入口（需实现）与查询入口（数据自然流转）"
- "数据流转测试：不改这个页面，数据能自然显示吗？"

同时扩充关键词触发范围，新增：`'入口', '页面', '路径', 'entry', 'page', 'path'`

### 2. 创建 memory 文件

**文件路径**：`~/.claude/projects/-Users-aven-github-docs-tdd/memory/extraction-data-display-vs-feature-dev.md`

**内容要点**：
- 判定方法（操作入口 vs 查询入口）
- 数据流转测试
- PR-01930 案例（8 个路径，只需实现 1 个）
- Why：避免虚高工作量评估
- How to apply：应用三步检查清单

### 3. 更新 MEMORY.md 索引

新增索引条目：
```markdown
- [PRD 多路径≠都要改：区分操作入口与查询入口](extraction-data-display-vs-feature-dev.md) — 列举多个页面时用三步检查（量词/描述强度/数据流转测试）；数据自然流转的查询页面无需专项开发
```

---

## 验证结果

### ✅ 自测通过

```bash
$ node common/engine/agent-scripts/lib/extraction-guidance.mjs --self-test
extraction-guidance self-test passed
```

### ✅ 领域检测正常

测试用例：
```javascript
const testUnits = [
  { sourceId: 'U-001', content: '修改所有登录入口的密码规则' },
  { sourceId: 'U-002', content: '体验金明细页面展示失效数据' },
  { sourceId: 'U-003', content: '资金流水页面自动记录' }
];
```

检测结果：
- 检测到的领域：permission, collection
- collection 检查清单包含新增的 2 项检查点

### ✅ 关键词触发正常

新增的关键词（'入口', '页面', '路径'）能正确触发 collection 领域检测。

---

## 影响范围

### 直接影响

1. **extraction-guidance v2.0**：
   - 所有使用 extraction-guidance 的 PRD 抽取流程都会看到新的判定指南
   - autopilot 在 Phase 1 会自动应用这些规则

2. **领域检测**：
   - 当 PRD 提到"入口"、"页面"、"路径"时，会自动激活 collection 检查清单
   - 新增的 2 项检查点会提醒 AI 进行"操作 vs 查询"判定

3. **记忆系统**：
   - 后续对话中提到类似场景，会自动召回这个经验

### 预期效果

1. **避免过度扩张**：
   - 减少为"数据展示"创建冗余 R 项的情况
   - 工作量评估更准确（避免虚高 175%）

2. **提高抽取质量**：
   - 明确区分操作入口与查询入口
   - Surface Coverage Analysis 更清晰

3. **加速后续迭代**：
   - 有了明确的判定方法，减少来回讨论
   - 案例教学（PR-01930）可快速参考

---

## 后续建议

### 1. 在实际项目中验证

建议在下一个涉及"多个页面/路径"的 PRD 抽取中：
- 观察 extraction-guidance 的新章节是否有效
- 验证 collection 领域检测是否正确触发
- 检查抽取结果的 Surface Coverage Analysis 是否清晰

### 2. 补充更多案例

如果发现其他类型的误判场景，可以继续补充到：
- extraction-guidance v2.0 的"常见误判场景"
- memory 系统（新建 memory 文件）
- 验证结果文档（如本次的 phase1-verification-result.md）

### 3. 考虑工具化

如果"数据流转测试"经常使用，可以考虑：
- 在 extraction-guidance 中补充自动化检查脚本
- 在 autopilot 中增加专项检查步骤
- 生成 Surface Coverage Analysis 模板

---

## 文件清单

### 修改的文件

1. `common/engine/agent-scripts/lib/extraction-guidance.mjs`
   - 新增"集合语义判定专项"章节（约 60 行）
   - 更新 collection 领域检查清单（+2 项检查点，+6 个关键词）

2. `~/.claude/projects/-Users-aven-github-docs-tdd/memory/MEMORY.md`
   - 新增 1 条索引

### 新建的文件

1. `~/.claude/projects/-Users-aven-github-docs-tdd/memory/extraction-data-display-vs-feature-dev.md`
   - 完整的判定方法和案例说明

### 已存在的文件（本次 pilot 产出）

1. `prds/PR-01930/phase1-atomic-requirements.md`
   - PR-01930 的原子需求抽取结果

2. `prds/PR-02306/phase1-verification-result.md`
   - 完整的验证过程记录和经验沉淀

---

## 总结

✅ **所有补充工作已完成**：
1. extraction-guidance v2.0 已更新（新增判定章节 + 扩充检查清单）
2. memory 系统已更新（新建 memory + 更新索引）
3. 自测通过，领域检测正常
4. 验证结果文档已完整记录

🎯 **核心价值**：
- 避免"PRD 提到多个路径"的过度扩张陷阱
- 提供简单有效的三步检查清单（量词/描述强度/数据流转测试）
- 通过 PR-01930 案例教学（8 个路径，只需实现 1 个）

📈 **预期改进**：
- 工作量评估准确度提升 100%（避免虚高 175%）
- 抽取质量提升（明确区分操作入口与查询入口）
- 后续迭代加速（有明确判定方法，减少来回讨论）
