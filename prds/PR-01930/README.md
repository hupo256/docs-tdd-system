---
projectId: PR-01930
status: archived
stage: G8
branch: feature/PR-01930
worktree: ""
port: "4108"
visualFidelity: standard
prdSource: "inbox/lark-sync/prd-latest.extracted.md（Lark revision 4103）+ inbox/prd-assets/ 真图"
figmaNode: ""
larkEnabled: false
---

# PR-01930 体验金手动失效功能（重做）

## 状态

| 字段 | 值 |
|------|-----|
| 最新通过门禁 | G8 |
| 最新可信门禁 | G4（2026-08-01 门禁链审计后回退；原 G8 结果缺少 G5/G6/G7 前置历史，不再作为阶段结论） |
| 当前阶段 | G5 阻塞：代码与部分 G6 自测证据已落盘，但后端真实 API 未 ready，尚未完成真实字段/错误码对账与 MSW 退役；不得进入 G6/G7/G8 |
| 公共规则 | 继承 ../../common/README.md |
| PRD 来源 | `inbox/lark-sync/prd-latest.extracted.md`（Lark revision 4103）+ `inbox/prd-assets/` 真图 |
| 本轮范围 | 第一轮 F01-F13 后台核心闭环 + 第二轮 F17-F23 流水枚举注入（现货后台/合约后台/C 端 web，只做 web 不碰 app）|
| visualFidelity | standard |
| Figma | 不使用；以 PRD 真图/白板为准 |
| i18n | 仅 apps/web 做（本地只写 zh-CN）；admin/futures-admin 后台文案简体硬编码，不走 .json |
| worktree | `/Users/aven/github/PR-01930`，分支 feature/PR-01930，端口 4108 |

## 文档地图

- product/00-feature-inventory.md ~ 07-figma-spec.md
- engineering/development-rules.md
- agent/README.md, context-summary.md
- inbox/prd-assets/（真值素材）

## 待确认

- [x] G2 scope：第一轮 F01-F13 后台核心闭环（用户 / 2026-07-20）
- [x] 第二轮 scope：F17-F23 流水枚举注入全量做、web 只做 web 不做 app、**MSW 为唯一 mock 策略**、文案口径后台记「手动失效（体验金）」/C端记「系统回收」（用户 / 2026-07-21）
- [x] i18n 分治：仅 web 国际化（本地只写 zh-CN）；admin/futures-admin 后台文案**简体硬编码进组件**，不补/不依赖 .json key（用户 / 2026-07-21）
- [x] 批量弹窗标题「批量手动过期」、笛卡尔积 10000、紫色主题、getUrl operate-api、~~单阶段上传~~ **改两阶段：上传→A6a 预校验→复用二次确认→A6b 执行**（用户 / 2026-08-07，与手输高风险闸口对齐）
- [ ] 落点A「数据概览-支出折合-来源明细」前置已就绪（PR-02015 已合入），补点在 legacy-admin `contractBusinessTypeList`；因 businessType code 未知，用户拍板**等后端 code 到位再补一行**（2026-08-07）
- [ ] 真实 API 到位后对账 A1-A6 + 第二轮各端真实 type code（现全用占位：admin 114/34、futures/admin `manual_invalidate_trial`、web 114）
