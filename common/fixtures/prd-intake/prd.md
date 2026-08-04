# PRD Intake Regression Fixture

## 1. 正文需求

正文只描述入口，完整流程仅在图片中。

![审批状态流程](./approval-flow.png)

## 2. 状态定义

| 状态 | 可执行动作 | 下一状态 |
|------|------------|----------|
| 草稿 | 提交 | 审核中 |
| 驳回 | 修改后提交 | 审核中 |

<whiteboard token="fixture-flow"></whiteboard>

![纯装饰背景](./decoration.png)
