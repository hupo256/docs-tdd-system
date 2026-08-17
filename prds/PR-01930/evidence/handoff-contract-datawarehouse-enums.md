# PR-01930 需合约/数仓提供的 2 项枚举定义（对接单）

> 生成时间：2026-08-15。收件人：合约 + 数仓（@Rullin @Peanut，cc kingstar）。
> 背景：后端已确认核心 4 接口（YAPI 231/770）+ 逐条回复 6 项对接单（见 `backend-handoff-remaining-gaps.md`），其中第 5、6 项后端答复「需合约、数仓解答」，转由本单跟进。这 2 项是 PR-01930 剩余阻塞 G5 的全部未销账项（另有落点A 依赖 PR-02015 上线）。

## Rullin 回复与前端处置（2026-08-15）

Rullin 提供 trialFee scene 数字枚举：

```
TRIAL_EXPIRED_SYSTEM(102, "过期回收", "scene.trial.expired.system")
TRIAL_EXPIRED_MANUAL(103, "手动过期", "scene.trial.expired.manual")
TRIAL_EXPIRED_TRANSFER(104, "划转回收", "scene.trial.expired.transfer")
TRIAL_SYSTEM_CLAWBACK(114, "系统失效", "scene.trial.system.clawback")
```

- ✅ **本 PR 事件真码 = 114（TRIAL_SYSTEM_CLAWBACK 系统失效）**：后台记「手动失效（体验金）」、C 端记「系统回收（体验金）」是同一事件、同一码。已落码销账：
  - 现货后台 体验金流水明细（F17，`constants/trialBalance.ts` 数字码 114）——去占位。
  - C 端 合约资金流水 / 交易记录（F21/F22，key `'114'`）——去占位。
  - ⚠ 注意 `103「手动过期」`是既存的**另一种类型**（admin 列表原就有 103），非本 PR，勿混。
- ⚠ **仍未销账**：`order_type`（字符串）与 `businessType`（数字）是另一套编码，Rullin 的 trial-scene 数字枚举不直接落这两个字段——见下方剩余项。

## 剩余仍需确认

### 1a. 合约账户资金流水 / 合约后台资产流水的 `order_type` 值（F18 / F20）

这两处流水按 `order_type` **字符串**编码（如 `create_position`），非 trial-scene 数字码。请给出体验金系统回收事件在该字段的字符串值（当前占位 `manual_invalidate_trial`）。

### 1b. 财务审计资金流水的 `businessType` 值（F19）

财务审计合约账户流水按 `businessType` **数字**编码（i18n key `businessType-N`），非 trial-scene 码。请给出该事件的 `businessType` 真实值（当前占位 `34`）。数仓（@Peanut）确认。

## 1. 「手动失效（体验金）」+「系统回收（体验金）」的资金流水业务类型码

体验金被手动失效后会产生流水，需要在下面各端展示成这两个文案。前端按接口返回的**业务类型码**映射文案，现用占位值，请给真实码：

| 端 | 展示点（PRD F17-F23） | 当前占位码 |
|----|----------------------|-----------|
| 现货后台(admin) | 体验金流水明细 / 合约账户资金流水 / 财务审计 | `114`、`34` |
| 合约后台(futures-admin) | 资产流水查询 | `manual_invalidate_trial` |
| C端 web | 合约资金流水 / 交易记录资金流水 | `114` |

请明确：

- 「手动失效（体验金）」「系统回收（体验金）」各自的业务类型码是多少？
- 是数字还是字符串枚举？**各端是否统一一套码**，还是现货/合约/web 各不同？
- 参考：legacy-admin 字典里疑似候选 `103/48`（来自 PR-02015，未上线），请以正式定义为准。

## 2. C 端卡券记录「系统回收」的识别字段

C 端卡券记录（F23）里「系统回收」这条，前端现在靠 `description` 文案识别。请确认：

- 是继续用 `description` 文案识别，还是新增一个 `recordType`（或类似）字段来标识？

## 提供后前端处置

给到真实码/字段后，前端替换各端占位枚举 + 卡券识别逻辑，跑契约测试与验收即可上线；无需再改接口。
