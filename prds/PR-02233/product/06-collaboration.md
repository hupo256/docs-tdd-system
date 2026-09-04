<!-- template-version: 1 -->
<!-- template-effective-since: 2026-07-23 -->

# Collaboration — PR-02233 【用户端】安全验证校验交互优化

## 已确认

| 时间 | 问题 | 结论 | 确认人 | 状态 |
|------|------|------|--------|------|
| 2026-09-04 | API 尚未全部 ready 是否可推进 | 大部分沿用已有逻辑；少量更新逻辑/新增 API 按 MSW 路线 B 推进 | Aven | 已确认 |
| 2026-09-04 | PRD 详情与验收表对“登录切换入口”相互矛盾 | 采用详情章节与前序人工 scope：Web 修复为真实切换；验收表“Web 移除/App 不变”为旧口径 | Aven | 已确认 |
| 2026-09-04 | 本仓责任边界 | `@fameex/web` 只实施 Web；App 需求移交 App owner | Aven / 仓库边界 | 已确认 |
| 2026-09-04 | 开发途中是否主动同步 `online` | 默认不 rebase / merge；仅明确阻塞或负责人要求时先说明再同步 | Aven | 已确认 |
| 2026-09-04 | P2-B 缺少账户邮箱身份验证码字段 / operationType 时如何推进 | 采用临时契约 + MSW；显式标记 provisional，后续由负责人统一找后台对接 | Aven | 已确认 |

## G5 前需销账

| # | 问题 | 影响 | 责任人 | 当前处理 | 状态 |
|---|------|------|--------|----------|------|
| C01 | 登录 bootstrap 返回已绑定方式的最终字段名/结构 | F02 方法列表和默认优先级 | Backend | provisional schema + MSW；字段缺失兼容现状 | 待联调 |
| C02 | 切换渠道是否复用原 token 与既有发码/确认接口，或需新 endpoint | F02 切换链路 | Backend | MSW 建候选契约，不在组件写 mock 分支 | 待联调 |
| C03 | cooldown 截止时间字段、单位、错误码与 limit_type | F06 限频和刷新恢复 | Backend / PR-02235 | MSW 覆盖绝对时间；G5 逐字段对账 | 待联调 |
| C04 | 客服 icon 的统一 Web action | F05 | Web owner | 复用现有客服 SDK，编码前定位具体入口 | 待确认 |
| C05 | App owner / 提测时间 | F08 | App owner | 不阻塞 Web P0/P1 | 待同步 |
| C06 | 修改密码/邮箱/手机场景按 GA→邮箱→手机取前两位时，既有 endpoint 缺少部分邮箱身份校验字段与对应发码 `operationType` | F03/F04 | Backend / Web owner | 已按负责人确认建立 `PR02233_*` provisional operationType + `emailCode` + MSW；后续统一找后台对账替换 | 待后台对账 |

## 假设与失效条件

| 假设 | 使用范围 | 失效条件 | 处理 |
|------|----------|----------|------|
| 现有邮箱/短信发码和登录确认接口可复用 | F01/F02/F06 | 后端确认 token/channel 不兼容 | 调整 service contract 与 MSW，不改组件 API |
| 登录新增字段可选发布 | F02 | 后端要求强制字段或独立查询 | mapper 保持 UI model，替换 hook 数据源 |
| cooldown 使用绝对时间可表达 | F06 | 后端只返回剩余秒数 | mapper 在响应时转换为 `Date.now()+seconds*1000` |

## Code Review

| 时间 | 命令 | findings | 处理结论 | 证据 |
|------|------|----------|----------|------|
| 待 G6 | `/code-review` | 待执行 | 待处理 | `evidence/` |

## 验证证据索引

| 命令 / 证据 | 目标 | 结果 | 备注 |
|-------------|------|------|------|
| `prd-intake.mjs PR-02233 --stage G2` | 51 项富媒体、27 张本地图片、范围映射 | 待 approve 后执行 | 不以远程临时 URL 作为证据 |
| Vitest | resolver/state/schema/payload/literal | 待执行 | fake timers 覆盖 countdown |
| Browser | 登录/注册、帮助、限频、刷新恢复、入口迁移 | 待执行 | MSW 场景可复现 |
| L2 并排 | PRD 截图 001/002/003/004/026/027 | 待执行 | standard fidelity |
