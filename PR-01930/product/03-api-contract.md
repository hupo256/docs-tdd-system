# API Contract — PR-01930 体验金手动失效功能（重做）

> API 未 ready。本项目 **MSW 路线 B 是唯一 mock 策略**（`src/mocks/handlers`）dev-only 占位——不引入任何其他 mock 方案（无 `USE_MOCK` 开关、service 内 mock 分支、静态 fixture 直返或其他拦截库）。service 从第一天按真实占位路径设计，production 代码零 mock 分支。真实接口到位后逐字段对账。

## 环境策略

| 项 | 值 |
|----|-----|
| 网关 | 现货后台体验金核心走 `getUrl('/operate-api/trialFee/...')` + `futuresAdminHeaders`（与现有 `services/api/trialBalance.ts` list/create 口径一致；非合约网关） |
| Mock 策略 | MSW 路线 B，`src/mocks/handlers/*`；本地 admin dev 通过 `NEXT_PUBLIC_ENABLE_MSW=true` 启 worker；dev:test/pre/prod 不注册 |
| 业务开关 | 无 `USE_MOCK` 分支；service 只请求真实占位路径，MSW 在网络层拦截 |

## 接口占位（A1-A6b，真实路径待后端对账）

| 编号 | 用途 | 方法 | 占位路径 | 备注 |
|------|------|------|----------|------|
| A1 | 手动失效列表 | GET | `/operate-api/trialFee/manualInvalidate/list` | searchFetchV2；筛选 uid/configCode/时间区间 |
| A2 | 预校验（汇总影响） | POST | `/operate-api/trialFee/manualInvalidate/preview` | 返回影响用户数/总额/可用/委托冻结/仓位占用 |
| A3 | 执行失效 | POST | `/operate-api/trialFee/manualInvalidate/execute` | 携带 requestId 幂等 |
| A4 | 导出 | GET | `/operate-api/trialFee/manualInvalidate/export` | blob 下载 |
| A5 | 下载模板 | GET | `/operate-api/trialFee/manualInvalidate/template` | blob |
| A6a | 批量预校验 | POST | `/operate-api/trialFee/manualInvalidate/batchPreview` | multipart 上传文件；后端解析+预校验，返回影响汇总（同 A2）+ batchId；不执行 |
| A6b | 批量执行 | POST | `/operate-api/trialFee/manualInvalidate/batchExecute` | 携带 batchId + requestId 幂等；执行已预校验批次失效 |

## 文案契约表（固定中文，逐字 copy PRD，禁意译）

| 键 | 文案（PRD 原文） |
|----|------|
| 添加弹窗标题 | 添加失效任务 |
| UID placeholder | 多个UID用英文逗号分隔，单次最多100个；留空则操作整批用户 |
| 配置编号 placeholder | 多个编号用英文逗号分隔，单次最多100个；留空则操作该用户全批次 |
| 备注 placeholder | 请输入失效原因 |
| UID 超限 | 单次操作UID不可超过100个 |
| 配置编码超限 | 单次操作批次，不可超过100个 |
| 双空拦截 | “用户UID”与“体验金配置编码”不能同时为空，请至少填写一项 |
| 笛卡尔积超限 | 当前待处理配对总量超出 10000条上限，请拆分批次批量上传操作 |
| 批量上传弹窗标题 | 批量手动过期 |
| 二次确认标题 | 确认体验金失效操作（不可逆） |
| 二次确认提示语 | 可用体验金：立即失效，委托冻结体验金：将自动撤单并失效，仓位占用体验金：不自动平仓，用户平仓后再失效 |
| 成功 Toast | 操作成功 |

## 6.1 MSW 路线 B 清单（MSW 落地前置）

| # | 前置 | 落地 |
|---|------|------|
| 1 | handler 覆盖 normal / empty / error / unauthorized / edge 场景 | A1 list 支持 `scenario` 参数切 normal/empty/unauthorized；A2 preview edge（金额边界）；A6a batchPreview error（文件校验失败） |
| 2 | 契约测试：MSW fixture 用真实 `schema.safeParse` 校验，防 mock 与 schema 漂移 | `*.contract.test.ts` 对 A1/A2/A6a 响应跑 schema.parse |
| 3 | dev-only worker 注册：`src/mocks/browser.ts` + `useMockWorker`，仅 dev（`NODE_ENV==development && NEXT_PUBLIC_ENABLE_MSW==true`） | 生产 build 短路，worker 懒加载不入包 |
| 4 | 真实接口 ready 后删/停 handler 即切真实路径，业务代码 0 改动 | service 请求真实占位路径不变，关闭 flag 即回真实接口 |

## 等待真实 API 对账清单

- A1-A6b 路径/方法/DTO/schema/错误码：真实接口 ready 后逐字段替换 + 补真实 fixture 对账测试。
- 批量两阶段（A6a 预校验 / A6b 执行）：对账 batchId 语义与有效期、A6a 返回的影响汇总字段、A6b 幂等口径；文件内容校验（uids/couponCode/remark 缺失/超限/重复/格式错误）的错误码与文案。
- phone/email 脱敏口径、失效数量动态累计字段、仓位占用快照字段：以后端返回为准。
