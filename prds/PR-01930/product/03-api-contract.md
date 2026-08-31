# API Contract — PR-01930 体验金手动失效功能（重做）

> API 未 ready。本项目 **MSW 路线 B 是唯一 mock 策略**（`src/mocks/handlers`）dev-only 占位——不引入任何其他 mock 方案（无 `USE_MOCK` 开关、service 内 mock 分支、静态 fixture 直返或其他拦截库）。service 从第一天按真实占位路径设计，production 代码零 mock 分支。真实接口到位后逐字段对账。

## 环境策略

| 项 | 值 |
|----|-----|
| 网关 | 现货后台体验金核心走 `getUrl('/operate-api/trialFee/...')` + `futuresAdminHeaders`（与现有 `services/api/trialBalance.ts` list/create 口径一致；非合约网关） |
| Mock 策略 | MSW 路线 B，`src/mocks/handlers/*`；本地 admin dev 自动启 worker（对齐 PR-01947，仅 `NODE_ENV === 'development'` 注册，无 `NEXT_PUBLIC_ENABLE_MSW` 开关）；dev:test/pre/prod 不注册 |
| 业务开关 | 无 `USE_MOCK` 分支；service 只请求真实占位路径，MSW 在网络层拦截 |

# API Contract — PR-01930 体验金手动失效功能（重做）

> 2026-08-15 更新：后端已交付 4 个后台核心接口（YAPI project 231，catid 770），本文已按真实契约对账落码。**MSW 路线 B 仍为唯一 mock 策略**（`src/mocks/handlers`）dev-only；真实接口 ready 后清空 handler 即切真实路径，业务代码 0 改动。
>
> 2026-08-18 PRD 同步（rev 4123→4165）：唯一实质变更 = 入口位置/命名——旧「福利中心-卡券记录-新增页面 + 手动失效入口按钮」划删，改为「福利中心-**卡券管理**，位置在**手续费返现卡下方**，命名**体验金手动失效管理**」。前端落点本已一致（route `/card-manage/manual-invalidate`、sider 叶子紧跟手续费返利卡之后、MSW menu handler 注入到卡券管理分组），**功能代码 0 改动**，仅校准 siderItems 注释。

## 环境策略

| 项 | 值 |
|----|-----|
| 网关 | 现货后台体验金核心走 `getUrl('/operate-api/trialFee/...')` + `futuresAdminHeaders`（与现有 `services/api/trialBalance.ts` list/create 口径一致；YAPI 路径省略 `/operate-api` 网关前缀，落码时补上）|
| Mock 策略 | MSW 路线 B，`src/mocks/handlers/*`；本地 admin dev 自动启 worker（对齐 PR-01947，无 `NEXT_PUBLIC_ENABLE_MSW` 开关）；dev:test/pre/prod 不注册 |
| 业务开关 | 无 `USE_MOCK` 分支；service 只请求真实路径，MSW 在网络层拦截 |

## 接口契约（真实，YAPI project 231 / catid 770）

> **2026-08-21 D3 退役（§8.4.2 逐接口拆）**：A1/A2/A6/A3 四接口已部署 dev，`trialBalanceManualInvalidate.ts` handler + `contractFixtures.ts` + `manualInvalidateContract.test.ts` 已删除，`browser.ts` 只余 `menuHandlers`。真实 schema（`types/trialBalanceManualInvalidate.ts`）与 F17 枚举测试（`manualInvalidateEnum.contract.test.ts`）保留。menu handler 保留（服务端菜单树未下发「体验金手动失效管理」叶子）。

| 编号 | 用途 | 方法 | 真实路径 | YAPI id | 状态 | 关键字段 |
|------|------|------|----------|---------|------|----------|
| A1 | 失效记录列表 / 导出 | GET | `/operate-api/trialFee/manualInvalidRecord` | 6028 | 已切真实 | query: pageNum/pageSize/configNumber/uid/beginDate/endDate/isExport(0查询 1导出)；rows: id/account/configNumber/trialFeeName/activityName/trialMode(1普通2加强)/endTime/quantity/invalidQuantity/remark/operator/operationTime |
| A2 | 待失效汇总（仅手输链路） | GET | `/operate-api/trialFee/manualInvalidSummary` | 6031 | 已切真实 | query: uid/configNumber(逗号分隔)/remark/uploadFlag(前端恒传 0，批量已改走 A6)；data: affectedUserCount/affectedTotalAmount/availableTrialFee/frozenAmount/positionOccupiedAmount（`notActivateAmount` 文档未登记，dev 实测有返回，前端按可缺失处理、缺失显 `--`） |
| A6 | 文件上传解析 + 汇总 | POST | `/operate-api/trialFee/manualInvalidSummary` | 6034 | 已切真实（2026-08-31 契约更新） | form: file；data 同层返回 7 个必填字段：fileData[]{uid, configNumber, remark} + affectedUserCount/affectedTotalAmount/notActivateAmount/availableTrialFee/frozenAmount/positionOccupiedAmount |
| A3 | 执行失效 | POST | `/operate-api/trialFee/manualInvalid` | 6037 | 已切真实 | body: uid/configNumber(逗号串)/remark/manualInvalidUploadRows[]{uid,configNumber,remark}；data:{} |
| menu | 菜单叶子注入（体验金手动失效管理） | — | MSW `menu.ts` handler | — | blocked（服务端菜单树未下发该节点，暂留 mock） | 注入 福利中心>卡券管理>体验金手动失效管理 |

### 与旧占位契约的差异（已对账修正）

- **路径**：`manualInvalidate/list|preview|execute|batchPreview|batchExecute` → `manualInvalidRecord`(GET) / `manualInvalidSummary`(GET手输·POST文件) / `manualInvalid`(POST执行)。
- **预校验方法**：POST → GET（A2 汇总改为 query 传参）。
- **批量两阶段重构**：旧「A6a 上传返回 batchId → A6b 携 batchId 执行」**不成立**；真实流程 = POST summary(file) 解析出 `fileData` 行 → GET summary(uploadFlag=1) 取汇总 → A3 携 `manualInvalidUploadRows` 执行。**已无 batchId。**
- **2026-08-31 A6 契约合并（现行口径）**：6034 改为一次返回 `fileData` 行 **+ 二次确认汇总 7 字段**，批量链路 = POST summary(file) → 直接开二次确认 → A3 携 `manualInvalidUploadRows` 执行，**不再单独 GET 汇总**（旧做法要把整批 uid/configNumber 拼进 GET query，万行文件有 URL 长度风险）。`uploadFlag=1` 随之废弃，前端 A2 恒传 0。触发点：dev 实测 POST 返回汇总形状但无 `fileData`，前端 zod 校验报「解析结果格式异常」，回查 YAPI 6034（后端 2026-08-31 20:22 更新）确认为契约变更，已按新契约落码。
- **requestId 幂等移除**：真实 A3 契约无 `requestId` 字段，已删；幂等改由后端保证 + 前端「确认失效」按钮 loading 期禁点兜双击。⚠ 待后端确认服务端幂等口径。
- **字段重命名**：`configCode→configNumber`、`type→trialMode`、`operateTime→operationTime`、`affectedUsers→affectedUserCount`、`totalAmount→affectedTotalAmount`、`availableAmount→availableTrialFee`、`positionAmount→positionOccupiedAmount`；预校验/执行入参 `couponCodes→configNumbers`。

### ⚠ 真实契约缺口（待后端补，见 evidence §8）

### 契约缺口销账（2026-08-15 后端逐条回复，见 evidence backend-handoff）

- ✅ **uid**：文档漏写已补充，保留为列表正常字段。
- ✅ **仓位占用列**：后端确认列表不再需要，已下线该列/schema/fixture/契约测试（A2 汇总的「仓位占用金额」positionOccupiedAmount 保留）。
- ✅ **批量汇总关联口径**：`uploadFlag=1` 后端按已上传文件自算，前端不再回传 uid/configNumber。
- ✅ **模板下载**：无独立接口，前端本地生成 CSV（表头 `uid,configNumber,remark` + 一行样板数据）。
- ✅ **F17-F19 资金流水枚举码（已销账）**：Rullin 提供 trialFee scene 枚举，**114=系统失效(TRIAL_SYSTEM_CLAWBACK)** 即本 PR 事件真码，已落 F17 体验金流水明细；C 端（`get_transaction_list`）直接使用返回的 `type`，F21/F22 key `'114'` 与之一致（已销账）；103「手动过期」系既存不同类型。**F18 admin 合约账户资金流水** 经 2026-08-22 确认 PRD 段整段划删，移出范围、前端零改动（原 scene/ext_scene 对接项作废）。**F19 财务审计 `businessType`** 数仓 2026-08-22 确认 = `34`，已落码销账（`constants/financeAuditBusinessType.ts` + `financeAudit.ts` + `useColumns.tsx`，8 契约测试锁字面）。见 evidence handoff §1b、followup §已回补/§已划删。
- ✂ **F20 合约后台 资产-流水查询（futures-admin）移出范围**：2026-08-18 PRD 7.1.8 整段划删，前端已回退，不再统计入缺口。
- ✂ **「即时失效金额（固定快照）」统计口径移除**：2026-08-18 PRD「核心计算规则」将该固定快照口径划删，仅保留「实时累计失效金额」（invalidQuantity 动态累计）。前端本就只展示最终累计额、未单独实现快照字段，**无代码改动**。
- ✅ **卡券「系统回收」识别字段**：kingstar 确认继续用 `description`、不新增 `recordType`；前端「说明」列直出 `record.description`，零改动达标。

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
| 1 | handler 覆盖 normal / empty / error / unauthorized / edge 场景 | A1 record 支持 `scenario` 切 normal/empty/unauthorized（`unauthorized`→10403 即 error 分支）+ `isExport=1` 返回 csv；A2 summary；A6 文件解析返回 fileData；edge（10MB 文件边界 / 笛卡尔积 10000 上限 / UID 超 100）由前端校验 + `manualInvalidateRules.test.ts` 锁死，A3 部分失败按后端「系统异常」error 口径 |
| 2 | 契约测试：MSW fixture 用真实 `schema.safeParse` 校验，防 mock 与 schema 漂移 | ~~`manualInvalidateContract.test.ts`~~ **2026-08-21 随 handler 删除（§8.4.2.5）**；后续以真实脱敏样本补 `*.apiContract.test.ts`（待 dev 冒烟拿到脱敏响应，TODO） |
| 3 | dev-only worker 注册：`src/mocks/browser.ts` + `useMockWorker`，仅 dev | 生产 build 短路，worker 懒加载不入包 |
| 4 | 真实接口 ready 后删/停 handler 即切真实路径，业务代码 0 改动 | **2026-08-21 已执行**：4 接口 handler + fixture 删除，service 请求真实路径不变，无 flag（对齐 PR-01947 先例，删 handler 即切真实） |

## 等待真实 API 对账清单（剩余）

- 上文「⚠ 真实契约缺口」四项：UID/仓位占用字段、批量 uploadFlag 关联口径、模板下载接口、F17-F23 流水枚举码。
- A3 执行的错误码/文案（无匹配跳过、部分失败）、A2 汇总在文件链路下的确切取数口径：以后端联调为准。
- phone/email 脱敏口径、失效数量动态累计（invalidQuantity）、trialMode 值域：以后端返回为准。
