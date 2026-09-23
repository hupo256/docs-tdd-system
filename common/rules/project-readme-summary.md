# 项目 README 摘要

> v4.0 lite 档规则 — 当前项目关键信息

## 必读字段

从项目 `README.md` 提取以下关键信息：

### 1. 项目元数据
- `projectId`: 项目编号（如 PR-02233）
- `workflowVersion`: 1 或 2
- `efficiencyRoute`: micro / lite / standard / high-risk
- `status`: implementing / testing / closed / archived
- `branch`: feature/* 或 fix/*
- `worktree`: worktree 路径（如果有）

### 2. 责任模块
- `deliveryTargetApp`: 改动应用（apps/web, apps/admin 等）
- `责任模块目录`: 具体改动路径（边界白名单）

### 3. 特殊约束
- i18n 策略：apps/web 走 i18n，admin 硬编码
- MSW 策略：是否使用 mock
- visualFidelity: 视觉还原度要求
- 后端依赖：API 状态、字段对齐情况

### 4. 不做范围
- 明确排除的功能
- 延期到下期的需求
- 已确认的边界

## lite 档约束

- 只读项目 README frontmatter（前 20 行）
- 不读完整 PRD / Figma / API 文档
- 边界以 README 声明为准

## 示例

```yaml
---
projectId: PR-02233
workflowVersion: 2
efficiencyRoute: lite
status: implementing
branch: feature/PR-02233
worktree: /Users/aven/github/PR-02233
deliveryTargetApp: apps/web
---

# PR-02233 修改手机号验证优化

责任模块：
- apps/web/src/apps/VerifyPhone
- apps/web/src/components/AccountContact

特殊约束：
- i18n: apps/web 走 i18n（zh-CN/en-US）
- 后端依赖: API 已 ready
```

## 使用

Agent 实现前先读项目 README，确认：
1. 改动边界（只改责任模块内的文件）
2. i18n 策略（是否写 .json key）
3. 后端依赖（API ready 才能调用）
