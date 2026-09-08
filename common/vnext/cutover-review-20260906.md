# docs_tdd vNext 分级切流评审（2026-09-06，历史）

> 状态：**已被 2026-09-08 正式切换决策取代**。当前口径只看 [cutover-decision-20260908.md](./cutover-decision-20260908.md) 与 [README.md](./README.md)。

本次历史评审曾批准新需求默认创建 v2，但把 V2 结果保留为非阻断观察，并计划等待 PR-02233 闭环后再评审正式出口。代码从未实现自动转正；`automaticCutover` 始终为 false。

2026-09-08，owner 明确选择立即正式启用 v2，因而结束上述分级切流：V0/V1/V2 现在统一使用 `mode=enforced` 的正式出口，failed/blocked 均阻断交付。PR-02233 的未闭环项继续使该项目失败，不因系统切换而豁免。
