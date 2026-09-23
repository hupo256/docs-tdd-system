# Lite 模式操作指南

> docs_tdd v4.1 - 小需求快速通道

## 什么是 Lite 模式？

Lite 模式是一种跳过完整 PRD extraction 的快速开发流程，适用于需求清晰、影响范围小的场景。

**核心理念**：人工提炼 > AI extraction

**效率对比**（基于实验数据）：
- **时间**：10 分钟 vs. 20-25 分钟（节省 50-60%）
- **Token**：7K vs. 25-30K（节省 76%）
- **准确率**：≥ 95%（人工理解通常更准确）

---

## 一、适用场景判断

### ✅ 适合 Lite 模式

- 需求描述清晰（截图 + 简短文字）
- 影响范围小（单页面、< 3 个文件）
- 技术方案明确（标准 UI 交互、简单逻辑）
- 快速验证类需求
- API 已就绪或纯前端改动

**示例**：
- 按钮添加 loading 效果
- 表单字段调整
- Toast 提示文案修改
- 简单的条件显示/隐藏
- 单个组件的样式调整

### ❌ 不适合 Lite 模式

- 复杂业务逻辑（多端协同、复杂状态机）
- 需求模糊（需要反复确认）
- 高风险改动（支付、权限、数据迁移）
- 多文件协同（> 5 个文件）
- 需要完整追溯性的场景

**示例**：
- 支付流程重构
- 权限系统改造
- 多端同步功能
- 复杂的数据迁移
- 涉及多个系统的集成

---

## 二、操作步骤

### Step 1: 人工提炼（2-3 分钟）

**目标**：用 4 个要点描述清楚需求

**提炼要点**：
1. **要做什么？**
   - 核心功能/改动
   - 用户交互流程
   - 业务规则

2. **影响哪些文件/组件？**
   - 具体文件路径（如果知道）
   - 或页面/组件位置描述
   - 预估文件数量

3. **如何验证？**
   - 浏览器手动测试
   - 或自动化测试方法
   - 验收标准

4. **有什么边界条件？**
   - 特殊情况处理
   - 错误处理
   - 兼容性要求

**示例**（修改密码按钮 loading）：
```
1. 要做什么？
   - 修改登录密码页面，点击"确定"按钮后显示 loading 并禁用按钮

2. 影响哪些文件？
   - apps/admin/src/apps/ChangePassword/index.tsx
   - 预计 1 个文件

3. 如何验证？
   - 浏览器测试：点击按钮 → 看到 loading → 按钮不可再点 → API 返回后恢复

4. 边界条件？
   - API 成功：页面跳转或提示
   - API 失败：按钮恢复 + 错误提示
```

### Step 2: 生成 Work-Item（1-2 分钟）

**2.1 复制模板**
```bash
cp common/templates/lite-work-item-template.json prds/PR-XXXXX/work-item.json
```

**2.2 填充内容**

打开 `prds/PR-XXXXX/work-item.json`，修改以下字段：

1. **projectId**：`"PR-XXXXX"` → 实际项目 ID

2. **requirements**：根据人工提炼填充
   ```json
   {
     "requirementId": "R-001",
     "statement": "修改登录密码页面的'确定'按钮，点击后立即显示 loading 状态并禁用按钮...",
     "affectedSurfaces": [
       {
         "surfaceId": "S-001",
         "locator": "apps/admin/src/apps/ChangePassword/index.tsx - 确定按钮",
         "disposition": "implement"
       }
     ],
     "evidencePlan": [
       {
         "type": "manual-browser",
         "description": "浏览器测试：点击按钮 → loading → 禁用 → 恢复"
       }
     ]
   }
   ```

3. **时间戳**：更新 `completedAt` 和 `lastCheckpointAt` 为当前时间

**2.3 创建人工输入记录**

创建 `prds/PR-XXXXX/human-input.md`：
```markdown
# PR-XXXXX 人工提炼

**提炼时间**：2026-09-23
**提炼人**：[你的名字]

## 需求概述
[一句话描述]

## 提炼要点
1. 要做什么？
   [...]

2. 影响哪些文件？
   [...]

3. 如何验证？
   [...]

4. 边界条件？
   [...]

## 参考资料
- 截图：[路径]
- 原始需求：[路径或链接]
```

### Step 3: 实施（正常流程）

按照 work-item 的 requirements 正常开发，无需特殊处理。

### Step 4: 记录数据（可选）

如果想为 lite 模式收集数据，使用实验记录模板：
```bash
cp common/templates/lite-experiment-template.md prds/PR-XXXXX/lite-experiment-log.md
```

记录：
- 人工提炼时间
- 生成 work-item 时间
- 实施时间
- Token 消耗（如果可以统计）
- 准确率（是否需要返工）

---

## 三、常见问题

### Q1: 如何判断是否适合 lite 模式？

**简单判断法**：
- 你能在 3 分钟内说清楚"要做什么"吗？✅ → 适合
- 影响 < 3 个文件吗？✅ → 适合
- 需求有截图或清晰描述吗？✅ → 适合
- 是高风险改动吗？❌ → 不适合

### Q2: lite 模式会不会遗漏需求？

**数据**：实验显示人工提炼准确率 ≥ 95%

**原因**：
- 人工理解通常比 AI extraction 更准确
- 对于小需求，人工可以快速抓住核心
- 如果不确定，可以回看原始需求

**建议**：
- 如果需求复杂或模糊 → 不要用 lite 模式
- 如果不确定是否遗漏 → 让同事 review 人工提炼

### Q3: lite 模式和 full extraction 可以混用吗？

**可以**。

- 小需求 → lite 模式
- 复杂需求 → full extraction
- 根据场景灵活选择

### Q4: 如果实施时发现需求理解错了怎么办？

**正常流程**：
1. 停止实施
2. 回看原始需求（human-input.md 有记录）
3. 更新 work-item 的 requirements
4. 继续实施

**不影响**：lite 模式的 work-item 也是可追溯、可修改的。

---

## 四、最佳实践

### 1. 人工提炼时

- ✅ 写清楚"要做什么"，不要假设 AI 能补全
- ✅ 尽量写具体的文件路径或组件名
- ✅ 列出明确的验收标准
- ❌ 不要复制粘贴 PRD 原文（lite 模式的目的就是提炼）

### 2. 生成 work-item 时

- ✅ 用模板，不要从零开始写
- ✅ requirements 可以有多个（如果有多个子需求）
- ✅ 每个 requirement 对应明确的 affectedSurfaces
- ❌ 不要省略 evidencePlan（验证很重要）

### 3. 实施时

- ✅ 按照 requirements 逐条实现
- ✅ 如果发现遗漏，立即更新 work-item
- ✅ 记录实际修改的文件（changedPaths）
- ❌ 不要偏离 requirements（如果要改，先更新 work-item）

### 4. 验证时

- ✅ 按照 evidencePlan 逐条验证
- ✅ 覆盖边界条件
- ✅ 如果失败，记录原因
- ❌ 不要跳过验证（即使是小需求）

---

## 五、示例

完整示例见：`prds/PR-02233-BTN-LOADING/`

- `work-item-lite.json` - lite work-item 样例
- `lite-experiment-log.md` - 实验记录（包含时间、token、准确率数据）

---

## 六、反馈和改进

如果你在使用 lite 模式时遇到问题或有改进建议，请：

1. 记录在项目的 `lite-experiment-log.md` 中
2. 或提交 issue/PR 到 docs_tdd 仓库
3. 或在团队会议上讨论

我们会根据反馈持续优化 lite 模式流程。

---

**版本**：v4.1 simplified  
**最后更新**：2026-09-23  
**状态**：实验阶段
