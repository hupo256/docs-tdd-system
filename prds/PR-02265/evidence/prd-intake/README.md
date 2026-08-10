# PRD Intake Evidence — PR-02265

> 依据 [lark-doc-sync.md §8](../../../../common/rules/lark-doc-sync.md)。本次因远端漂移重新 intake，不沿用 revision 1009 的旧结论。

## 概况

| 项 | 值 |
|----|----|
| Lark document | `P2xud4WYyoapp6xfjskl7UI3gKc` |
| 远端 revision | `1576`（旧基线 `1009`） |
| 规范化正文 SHA-256 | `1551f02728f41b60f28ecc276a1e29494b3028a023f1f5564d9871538750f31d` |
| Intake source | `inbox/lark-sync/prd-latest.extracted.md` |
| 富媒体总数 | 34（20 图片 + 2 Markdown 表格 + 1 sheet + 11 cite） |
| 已读取 / unresolved | 34 / 0 |
| 本地化附件 | `inbox/lark-sync/assets/img-001.png` ~ `img-020.png` |

## 读取方式

- Lark 文档：`lark-cli docs +fetch --api-version v2 --as user --format json`；解析 JSON 信封中的 document content/revision。
- 图片：同步器下载临时 media URL 到 `assets/img-001.png`~`img-020.png`，manifest 记录二进制 hash；本地 vision + 相邻正文交叉核对。
- 验收 sheet：`PRD-EMBED-003`，读取 `OoeSs7l5xhJy4Xtl40mliE0sgPf / uwyfAZ / A1:D10`，仍为原 9 条验收项。
- cite：`PRD-EMBED-004`~`014` 为变更人/评审人员署名，判为 decorative。
- 空需求表：`PRD-TABLE-002` 为无内容占位，判为 decorative。

## revision 1576 新增/更新需求

| Feature | Source | 提取结论 |
|---------|--------|----------|
| F08 | `PRD-IMG-019` + §5.1 正文 | 合约做市账户新增/编辑费率配置需要即时生效 |
| F09 | `PRD-IMG-019` `PRD-IMG-020` | 合约蓝框改为两条：账号×币对生效规则 + 外部做市商表优先于手续费折扣表 |
| F10 | `PRD-IMG-021` | 现货做市账户蓝框补充外部做市商表优先于会员等级--基础配置表 |
| F11 | `PRD-IMG-034` + 相邻正文 | 用户白名单添加/编辑新增蓝框；主语为「账号若在」 |
| F12 | `PRD-IMG-035` + 相邻正文 | 币对白名单添加/编辑新增蓝框；主语为「账号交易的币对若在」 |
| F13 | `PRD-IMG-022` + 相邻正文 | 合约后台手续费折扣添加/编辑新增蓝框；外部做市商表费率优先 |

## 原有需求图片映射

- `PRD-IMG-016`~`018`：F01/F03，合约负费率输入与校验。
- `PRD-IMG-019`：F02 常驻返佣提示，同时承载新增 F08/F09。
- `PRD-IMG-023`~`026`：F05 前台 web 展示触点。
- `PRD-IMG-027`~`032`：F06 后台展示触点。
- `PRD-IMG-033`：F04 外部做市商列表负费率显示。
- `PRD-TABLE-003`：F07 异常处理；`PRD-EMBED-003`：原 9 条核心验收标准。

## 冲突处理

1. F03：优化后图片短文案与正文不一致，沿用已确认口径——以正文「请输入【-100,100】之间的数字，精度支持6位」为准。
2. F11：图片/alt 疑似显示币对主语，但紧邻正文明确为「账号若在」；正文决定逐字文案，图片只决定位置/样式。
3. F13：图片 OCR/alt 与紧邻正文不一致；正文决定逐字文案，图片只决定位置/样式。

## 漂移复核

`DOC-PRD-010` 每次 gate 重新 fetch 远端并比较规范化正文 hash。hash 不同、baseline 缺失、网络或权限失败均阻塞，要求重新 sync → intake → approve。
