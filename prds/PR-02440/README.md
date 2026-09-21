---
projectId: PR-02440
status: active
stage: G0
branch: ""
worktree: ""
port: ""
visualFidelity: standard
prdSource: https://qfglxo2m3dc.sg.larksuite.com/wiki/ZD3kw2H19isuUYk1vF8l9vIAgkh
figmaNode: ""
larkEnabled: false
---

# PR-02440 福利中心 API 交易限制优化

## 状态

| 字段 | 值 |
|------|-----|
| 当前阶段 | G0（需求理解） |
| 最新通过门禁 | - |
| 公共规则 | 继承 ../../common/README.md |
| PRD 来源 | https://qfglxo2m3dc.sg.larksuite.com/wiki/ZD3kw2H19isuUYk1vF8l9vIAgkh |
| visualFidelity | standard |
| 范围 | 只做前端部分 |

## 需求概述

**背景**：区分 API 自动化交易与真实用户交易

**目标**：
1. 福利中心任务及活动仅统计非 API 交易
2. API 交易订单不可使用福利中心卡券

**前端范围**：
1. 活动规则页面文案修改
2. API 创建时的前端校验提示

## 待确认

- [ ] 具体涉及哪些活动页面
- [ ] API 创建入口在哪个页面
- [ ] 是否有 Figma 设计稿
- [ ] 后端 API 是否已就绪
