# API Contract — PR-01930 体验金手动失效功能（重做）

> API 未 ready。本项目 **MSW 路线 B 是唯一 mock 策略**（`src/mocks/handlers`）dev-only 占位——不引入任何其他 mock 方案（无 `USE_MOCK` 开关、service 内 mock 分支、静态 fixture 直返或其他拦截库）。service 从第一天按真实占位路径设计，production 代码零 mock 分支。真实接口到位后逐字段对账。

## 环境策略

| 项 | 值 |
|----|-----|
| 网关 | 现货后台体验金核心走 `getUrl('/operate-api/trialFee/...')` + `futuresAdminHeaders`（与现有 `services/api/trialBalance.ts` list/create 口径一致；非合约网关） |
| Mock 策略 | MSW 路线 B，`src/mocks/handlers/*`；本地 admin dev 通过 `NEXT_PUBLIC_ENABLE_MSW=true` 启 worker；dev:test/pre/prod 不注册 |
| 业务开关 | 无 `USE_MOCK` 分支；service 只请求真实占位路径，MSW 在网络层拦截 |

# API Contract — PR-01930 体验金手动失效功能（重做）

> 2026-08-15 更新：后端已交付 4 个后台核心接口（YAPI project 231，catid 770），本文已按真实契约对账落码。**MSW 路线 B 仍为唯一 mock 策略**（`src/mocks/handlers`）dev-only；真实接口 ready 后清空 handler 即切真实路径，业务代码 0 改动。

## 环境策略

| 项 | 值 |
|----|-----|
| 网关 | 现货后台体验金核心走 `getUrl('/operate-api/trialFee/...')` + `futuresAdminHeaders`（与现有 `services/api/trialBalance.ts` list/create 口径一致；YAPI 路径省略 `/operate-api` 网关前缀，落码时补上）|
| Mock 策略 | MSW 路线 B，`src/mocks/handlers/*`；本地 admin dev 通过 `NEXT_PUBLIC_ENABLE_MSW=true` 启 worker；dev:test/pre/prod 不注册 |
| 业务开关 | 无 `USE_MOCK` 分支；service 只请求真实路径，MSW 在网络层拦截 |

## 接口契约（真实，YAPI project 231 / catid 770）

| 编号 | 用途 | 方法 | 真实路径 | YAPI id | 关键字段 |
|------|------|------|----------|---------|----------|
| A1 | 失效记录列表 / 导出 | GET | `/operate-api/trialFee/manualInvalidRecord` | 6028 | query: pageNum/pageSize/configNumber/uid/beginDate/endDate/isExport(0查询 1导出)；rows: id/account/configNumber/trialFeeName/activityName/trialMode(1普通2加强)/endTime/quantity/invalidQuantity/remark/operator/operationTime |
| A2 | 待失效汇总（手输/单） | GET | `/operate-api/trialFee/manualInvalidSummary` | 6031 | query: uid/configNumber(逗号分隔)/remark/uploadFlag(1=文件链路)；data: affectedUserCount/affectedTotalAmount/availableTrialFee/frozenAmount/positionOccupiedAmount |
| A6 | 文件上传解析 | POST | `/operate-api/trialFee/manualInvalidSummary` | 6034 | form: file；data.fileData[]: {uid, configNumber, remark} |
| A3 | 执行失效 | POST | `/operate-api/trialFee/manualInvalid` | 6037 | body: uid/configNumber(逗号串)/remark/manualInvalidUploadRows[]{uid,configNumber,remark}；data:{} |

### 与旧占位契约的差异（已对账修正）

- **路径**：`manualInvalidate/list|preview|execute|batchPreview|batchExecute` → `manualInvalidRecord`(GET) / `manualInvalidSummary`(GET手输·POST文件) / `manualInvalid`(POST执行)。
- **预校验方法**：POST → GET（A2 汇总改为 query 传参）。
- **批量两阶段重构**：旧「A6a 上传返回 batchId → A6b 携 batchId 执行」**不成立**；真实流程 = POST summary(file) 解析出 `fileData` 行 → GET summary(uploadFlag=1) 取汇总 → A3 携 `manualInvalidUploadRows` 执行。**已无 batchId。**
- **requestId 幂等移除**：真实 A3 契约无 `requestId` 字段，已删；幂等改由后端保证 + 前端「确认失效」按钮 loading 期禁点兜双击。⚠ 待后端确认服务端幂等口径。
- **字段重命名**：`configCode→configNumber`、`type→trialMode`、`operateTime→operationTime`、`affectedUsers→affectedUserCount`、`totalAmount→affectedTotalAmount`、`availableAmount→availableTrialFee`、`positionAmount→positionOccupiedAmount`；预校验/执行入参 `couponCodes→configNumbers`。

### ⚠ 真实契约缺口（待后端补，见 evidence §8）

### 契约缺口销账（2026-08-15 后端逐条回复，见 evidence backend-handoff）

- ✅ **uid**：文档漏写已补充，保留为列表正常字段。
- ✅ **仓位占用列**：后端确认列表不再需要，已下线该列/schema/fixture/契约测试（A2 汇总的「仓位占用金额」positionOccupiedAmount 保留）。
- ✅ **批量汇总关联口径**：`uploadFlag=1` 后端按已上传文件自算，前端不再回传 uid/configNumber。
- ✅ **模板下载**：无独立接口，前端本地生成 CSV（表头 `uid,configNumber,remark` + 一行样板数据）。
- ⚠ **F17-F23 各端资金流水枚举码未交付**：admin `114/34`、futures-admin `manual_invalidate_trial`、web `114` 仍为占位；后端回复需合约、数仓解答，占位维持。
- ⚠ **卡券「系统回收」识别字段**：`description` vs 新 `recordType` 待与合约确认，维持 `description` 识别。

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
| 1 | handler 覆盖 normal / empty / error / unauthorized 场景 | A1 record 支持 `scenario` 切 normal/empty/unauthorized + `isExport=1` 返回 csv；A2 summary；A6 文件解析返回 fileData |
| 2 | 契约测试：MSW fixture 用真实 `schema.safeParse` 校验，防 mock 与 schema 漂移 | `manualInvalidateContract.test.ts` 对 A1 行 / A2 汇总 / A6 fileData 跑 schema.parse，并锁死缺口字段不存在 |
| 3 | dev-only worker 注册：`src/mocks/browser.ts` + `useMockWorker`，仅 dev | 生产 build 短路，worker 懒加载不入包 |
| 4 | 真实接口 ready 后删/停 handler 即切真实路径，业务代码 0 改动 | service 请求真实路径不变，关闭 flag 即回真实接口 |

## 等待真实 API 对账清单（剩余）

- 上文「⚠ 真实契约缺口」四项：UID/仓位占用字段、批量 uploadFlag 关联口径、模板下载接口、F17-F23 流水枚举码。
- A3 执行的错误码/文案（无匹配跳过、部分失败）、A2 汇总在文件链路下的确切取数口径：以后端联调为准。
- phone/email 脱敏口径、失效数量动态累计（invalidQuantity）、trialMode 值域：以后端返回为准。
