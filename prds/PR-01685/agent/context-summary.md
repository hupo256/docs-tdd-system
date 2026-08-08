# PR-01685 活动落地页 · 上下文摘要

> 跨会话恢复只读本文件,别重读 `product/*`(见 rule-router §1.1）。
> 最后更新:2026-08-01 · 项目已关闭，原 worktree `/Users/aven/github/PR-01685-1` 已回收；分支 `feature/PR-01685-1` 保留

## 阶段
G8 已归档。Web 活动落地页于 2026-07-30 合入 `online`（merge `9c17fcd5a2`），2026-08-01 更新上线文档并回收编码 worktree。G0-G4 完成，G2 范围于 2026-06-26 由 Aven 定稿；代码已切真实接口、Mock 零残留拆除(2026-07-03)。历史上未生成 `agent/gate-results.json`，不做事后伪造。

## 落点(责任模块)
- 前端:`apps/web/src/apps/Campaign/`(`index.tsx` / `components/`(Hero、Modals、StatusCta、BottomCta、RuleSection、Skeleton、TaskCards 5 类卡) / `hooks/` / `common/`(mapYapi*、calc、taskDisplay、types、campaignTracking))
- 服务层:`apps/web/src/services/api/campaign/`(`campaign.ts` / `schemas.ts` / `campaignReject.ts` / `__fixtures__/codex-*.json`)
- 路由:`.../campaign/[activityId]/page.tsx`(页面用 `activityId`，service 映射 YApi `campaignId`)
- 其它:`i18n/locales/zh-CN/campaign.json`、`constants/pathnames.ts`(CAMPAIGN_DETAIL)

## 接口
真实接口已联调:`https://webapi.pfyys.com/fe-ex-api/api/activity`(YApi 2026-06-26 cat_1205，14 接口)。detail/ranking/join/claim 均 200;单测 87 passed。无 WebSocket，30s React Query 轮询 + 手动刷新。

## 历史未留证项
- 领取(claim)动态闭环:**后台造数已对接,闭环已跑通**(2026-07-05)。剩余回归可覆盖领取超时/重复领取边界。
- UI 还原:**桌面浅 `9517:137713`/深 `9364:134676` 逐项对照已通过 95%**(2026-07-05,06 §4.8)。
- 联调检查表(06 §4)剩余未勾:报名各态、组合/阶梯/进阶领取、排行榜分页/空态/1000+/UID 脱敏、分享跳转与复制 toast、底部浮层。
- 测试账号(8 类)未到位;G7 QA 比对未留下完整证据，随上线归档，不做事后补写。
- Lark:webhook 待改 interactive 卡片;临时 cloudflare tunnel 已失效需重启。

## 坑
- **契约陷阱(已修 P0)**:真实 detail 的 `taskModeResult` 不返 `claimableTierId`/`claimableRewardIds`;档位领取态改由 `tierViews[].buttonStatus/completed/selected` 表达。`mapTiers` 优先取 `tierViews[]`，旧契约兜底;`codex-ladder-tierviews.json` 回归。
- **DTO 重复**:真实接口同返 `subActivityViews` 与根级 `taskViews`(重复);mapper 用 subActivityViews 去重，已验证无 bug。
- 既有(非本项目)typecheck 错:`campaign.test.ts:76`,未改。(原列的 `mockApi.ts:195` 随 mock 拆除已随文件删除,2026-07-06 核实)
- 规则正文(B10)按纯文本渲染;后端若返 HTML 需补安全渲染。
- `tmp/update_tasks.py` 在 diff 中,疑似临时脚本残留，交付前确认删除。
