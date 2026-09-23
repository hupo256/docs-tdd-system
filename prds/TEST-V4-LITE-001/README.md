---
projectId: TEST-V4-LITE-001
workflowVersion: 2
efficiencyRoute: lite
status: implementing
stage: lite-path
createdAt: 2026-09-23T10:17:17.704Z
---

# TEST-V4-LITE-001 (lite-path 快速通道)

> 本项目通过 v4.0 lite-path 快速通道创建，跳过了 extraction/coverage review。

## 需求

改文案

### PRD 原文

```
把 Home.tsx 首页按钮文案从'开始'改成'立即开始'
```

## 改动

| 文件 | 类型 | 变更 |
|------|------|------|
| Home.tsx | copy | 替换 "开始" → "立即开始" |

## 验证

- [ ] Biome: `pnpm biome check --write`

- [ ] 人工确认: 改动符合预期

## 下一步

执行 `docs-tdd checkpoint TEST-V4-LITE-001` 提交改动。
