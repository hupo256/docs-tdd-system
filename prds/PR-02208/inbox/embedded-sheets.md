# PR-02208 embedded Sheet snapshot

- Spreadsheet token: `FXcSsK8wvhpr7stYXCkla79Rgrg`
- Revision: `72`
- Read date: `2026-09-26`
- Purpose: preserve the field lists and rule matrix that are embedded in the PRD but not expanded in the Markdown export.

## `BuUqw1` (`A1:B9`)

| Field | Meaning |
|---|---|
| `orderId` | 订单 ID |
| `tradeId` | 成交 ID |
| `uid` | 用户 UID |
| `source` | 订单来源，API |
| `feeRateType` | Maker/Taker |
| `rateLevel` | 成交时费率档位，如 L1-L5 |
| `feeRate` | 实际执行费率 |
| `fee` | 实际手续费 |

## `hqsIdH` (`A1:B11`)

| Field |
|---|
| UID |
| 原档位 |
| 新档位 |
| 定档成交量 |
| 原 Maker 费率 |
| 新 Maker 费率 |
| 原 Taker 费率 |
| 新 Taker 费率 |
| 生效时间 |
| 计算时间 |

## `jAmLzp` (`A1:C5`)

| Order source | User type | Applied fee rule |
|---|---|---|
| API | 普通用户 | API 动态费率 |
| API | 代理人 | API 动态费率 |
| API | 外部 API 做市商 | 做市商费率 |
| WEB/APP | 普通用户、VIP 用户、代理人等 | 原有费率体系 |

