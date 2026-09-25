# PR-02208 嵌入式电子表格快照

> 来源：PRD 中显式引用的同一电子表格 `FXcSsK8wvhpr7stYXCkla79Rgrg`。以下按每个被引用 sheet 的当前读取结果归一化；保留原始字段和值，不推导业务规则。

## 1. 费率路由规则（sheet `jAmLzp`，范围 `A1:C5`）

| 订单来源 | 用户身份 | 执行费率 |
| --- | --- | --- |
| API | 普通用户 | API动态费率 |
| API | 代理人 | API动态费率 |
| API | 外部API做市商 | 做市商费率 |
| WEB/APP | 普通/VIP用户/代理人等 | 原有费率体系 |

## 2. API 成交接口字段（sheet `BuUqw1`，范围 `A1:B9`）

| 字段 | 说明 |
| --- | --- |
| orderId | 订单ID |
| tradeId | 成交ID |
| uid | 用户UID |
| source | 订单来源，API |
| feeRateType | Maker/Taker |
| rateLevel | 成交时费率档位，如L1-L5 |
| feeRate | 实际执行费率 |
| fee | 实际手续费 |

## 3. 用户档位变化记录字段（sheet `hqsIdH`，范围 `A1:B11`）

| 字段 | 说明 |
| --- | --- |
| UID | 用户UID |
| 原档位 | 变更前档位 |
| 新档位 | 变更后档位 |
| 定档成交量 | 本次定档使用的滚动30天成交量 |
| 原Maker费率 | 变更前Maker费率 |
| 新Maker费率 | 变更后Maker费率 |
| 原Taker费率 | 变更前Taker费率 |
| 新Taker费率 | 变更后Taker费率 |
| 生效时间 | 新档位生效时间 |
| 计算时间 | 系统定档时间 |
