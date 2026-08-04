# PR-01988 协作记录

> 状态：G2 已确认。本文记录已确认结论、后续联调项、冲突和裁剪结论。

## 待确认项

| ID | 阶段 | 问题 | 责任人 | 状态 | 影响 |
|----|------|------|--------|------|------|
| Q1 | G2 | 当前需求是否由本仓同时实现 `apps/admin` 后台页面与 `apps/web` 用户侧埋点？App、服务端埋点是否只做联调验收？ | 产品 / 负责人 | 已确认：本仓做 Admin + Web；App 另端；服务端主责前端联调 | 决定开发范围 |
| Q2 | G2 | `预测市场二期管理后台原型.html` 或 Figma node 是否可提供？ | 产品 / 设计 | 已确认：先按 PRD 截图低保真实现 | 影响 Admin UI 还原 |
| Q3 | G3/G5 | 请确认真实联调环境、Admin permission code、YApi 带时间戳路径是否稳定、字段精度和错误码。 | 后端 | YApi project 459 已拉取 32 个接口；mock-first 保留兜底，真实联调待权限 / 环境 | 影响 schema / mapper / real-mode 验收 |
| Q4 | G2 | 分类管理是否本期做？PRD 范围一览未列，但正文有完整章节。 | 产品 | 已确认：本期做 | 影响页面数量和菜单 |
| Q5 | G2 | Admin 菜单分组、路由命名、权限码、legacy 菜单是否已配置？ | 后端 / Admin 负责人 | 已确认：预测市场独立菜单组，route `/prediction/...`，permission code 后端补 | 影响路由、权限、菜单和 legacy redirect |
| Q6 | G2 | 收入统计“毛利”是否扣除 PM 手续费/Gas？PRD 同时写成本字段和毛利=三类收入。 | 产品 / 财务 | 已确认开发口径：毛利由后端返回 | 影响展示字段和计算 |
| Q7 | G3 | PM 手续费精度以 8 位还是 5 位为准？PRD 落库要求和资料说明不一致。 | 后端 / 财务 | 待后端联调确认 | 影响 formatter / schema |
| Q8 | G2 | 手动平账是否需要审批流、操作白名单、最大份额限制、独立权限？ | 技术 / 风控 / 运营 | 已确认：独立权限 + 二次确认 + 审计；真实 mutation 后续确认 | 高风险操作边界 |
| Q9 | G3 | Lark webhook 是前端可配置还是只配置开关/脱敏状态？是否允许前端保存 secret？ | 后端 / 安全 | 已确认：secret 不回显；真实保存后续安全确认 | 告警配置安全边界 |
| Q10 | G2 | legacy `/polymarket_config` 私钥、钱包、Relayer API Key 配置页是否保留在 legacy，还是迁移到本期 Next Admin？ | 产品 / Admin 负责人 | 已确认：保留 legacy，不纳入本期迁移 | 影响菜单和配置迁移范围 |
| Q11 | G2 | 是否启用本项目 docs_tdd Lark 主动通知或群内 @ 应用转 task？ | 负责人 | 主动通知脚本已接入，本机 webhook 配置已就绪；群内 @ 应用转 task 未启用 | 影响协作方式，不阻塞开发 |
| Q12 | G7 | 是否提供 QA 用例和验收环境账号？ | QA / 负责人 | 待确认 | 影响 G7 执行 |

## G2 确认结论

```text
G2 确认人：aven
G2 日期：2026-06-17
scope：按 08-g2-scope-review.md 默认建议
API：YApi project 459 已提供 32 个接口；mock-first 保留兜底，真实接口等待环境 / 权限 / 路径稳定性联调
原型：按 PRD 截图低保真实现
菜单权限：预测市场独立菜单组，route 用 /prediction/...，permission code 后端补
财务口径：毛利由后端返回，PM fee 精度待后端
安全边界：手动平账独立权限 + 二次确认 + 审计；Lark secret 不回显；polymarket_config 保留 legacy
```

## PRD / 代码现状差异

| ID | 类型 | 描述 | 当前结论 | 后续动作 |
|----|------|------|----------|----------|
| D01 | 代码基线 | 当前 worktree 未找到一期 Web Prediction 路径：`apps/web/src/apps/Prediction/`、`apps/web/src/services/api/prediction/`、`apps/web/src/services/api/predict/` | Web F01/F07 开发前需确认代码来源、是否在其他分支，或是否从当前 WorldCup / marketing 结构补新实现 | 继续推进 Admin mock-first，不误改 Web |
| D02 | 范围 | 分类管理不在二期范围一览，但正文完整 | G2 已确认本期做 | 进入 G4 mock-first |
| D03 | 财务口径 | 毛利是否扣成本表述不一致 | G2 确认毛利由后端返回，前端不自行算账 | PM fee 精度后续联调 |
| D04 | 原型 | PRD 提到 HTML 原型但本地未提供 | G2 确认按 PRD 截图低保真实现 | HTML / Figma 后续如有再补 |
| D05 | legacy 配置 | legacy 已有 `/polymarket_config`，用于提交 privateKey、funderAddress、relayerApiKey 到 `/polymarket/kx/upload` | G2 确认保留 legacy，不迁移 | 本期不触碰私钥迁移 |
| D06 | RDP 资料 | 用户确认主仓为 `/Users/aven/github/fameex-web`；worktree 已软链 `/Users/aven/github/PR-01988/apps/web/docs_tdd` 到主仓 `apps/web/docs_tdd` | 已通过软链读取 `PR-01988/inbox/【PR-01988】预测市场二期方案.md` | 后续 API / 原型 / 补充 RDP 继续放主仓 `docs_tdd/PR-01988/inbox/` |
| D07 | Admin mock-first / real-mode | 已完成 `/prediction/**` 路由、独立菜单、zh-CN 文案、mock hooks、RDP 核心字段、空态、`__error` 错误态和导出 mock 反馈；YApi 32 个接口已形成快照 | 可继续 Admin 桌面自测；真实 API 已到达后端但受权限阻断，高风险 mutation 仍待安全联调 | 待真实环境、测试账号权限、正式 permission code、路径稳定性和字段精度确认 |

## Scope 裁剪记录

| PRD 条目 | 裁剪结论 | 确认人 | 日期 | 对验收标准影响 |
|---------|---------|--------|------|---------------|
| 三期规划 | 二期不做，仅记录候选 | PRD | 2026-06-17 | 无 |
| 用户侧新交易玩法 / 限价单 / 自动补资 / 多语言法币结算 / 理财沉淀收益 | 二期不做 | PRD | 2026-06-17 | 无 |
| 最近告警记录页面 | 不做 | PRD | 2026-06-17 | 告警留痕由各告警源系统侧记录 |

## 通知与同步

| 能力 | 当前决策 | 说明 |
|------|----------|------|
| Lark 主动通知 | 已接入脚本，本机 webhook 配置已就绪 | 已完成 G4 阻塞/补信息真实通知；后续实际发送记录写入 `agent/notification-log.md` |
| 群内 @ 应用转 task | 未启用 | 如需启用必须另接 Lark 应用事件订阅 + Bot Gateway + Worker；当前群反馈由人工整理为任务 |
