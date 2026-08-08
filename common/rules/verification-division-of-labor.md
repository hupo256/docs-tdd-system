# 验证分工规范：Agent 跑逻辑，人工跑视觉

> AI 主用,正式规则。关联:[quality-checklist.md](./quality-checklist.md) §3、[browser-e2e-mcp.md](./browser-e2e-mcp.md)、[component-reuse-and-visual-fidelity.md](./component-reuse-and-visual-fidelity.md)。本文与旧文曾冲突（旧文的「Agent 自己完成 L2 并排」），现已统一为「L2 默认人工」，三文一致。本文所有 `≥95%` 判定以 [component-reuse §3.0](./component-reuse-and-visual-fidelity.md) 走查清单逐项 pass 为准（`≥95%` 只是简写）。

## 0. 为什么要这条规则

Browser/Playwright MCP 逐步 UI 走查对 Agent 是**串行**的:每步「操作 → 等快照 → 读 DOM/截图 → 找 ref → 选择器试错 → 验证副作用」都是一轮往返,还持续吃 token 拖慢后续。人工肉眼是**并行**的,同样一步快几倍。

**结论**:按「验证类型」分工,不按「任务」分工。**能写成断言/取值比对的 → Agent;需肉眼判断像素与手感的 → 人工。** Agent 把可回归部分一次固化,人工只花几分钟过视觉。

## 1. 分工总表（硬性）

| 验证类型 | 负责 | 工具 | 判定方式 |
|---------|------|------|---------|
| 业务逻辑/状态机/状态不可逆/互斥判定 | **Agent** | Vitest | 断言,可回归 |
| 边界/异常/降级/空态错态 loading retry | **Agent** | Vitest | 断言 |
| 数据/mapper/排序/精度/上报 payload | **Agent** | Vitest | 断言 |
| DOM 契约:锚点存在、class 挂对、图标名合法、`getComputedStyle` == 设计 token | **Agent** | 一次性批量脚本（Playwright MCP `browser_evaluate` 或 Node） | **取值比对**,不截图 |
| 集成崩溃（只有真跑起来才暴露:图标名错、SSR、hydration、接口 404） | **Agent** | Browser/Playwright MCP,**加载一次**看 console/首屏 | 看报错,不逐步走 |
| 视觉还原/L2 Figma 并排 ≥95%/圆角字号间距 | **人工** | 肉眼 + Figma Dev Mode | 目测 |
| 交互手感/动画/翻页顺滑/箭头朝向 | **人工** | 肉眼 | 目测 |
| 响应式 390px H5 不溢出、按钮可点/dark·light 切换 | **人工** | 肉眼 | 目测 |

## 2. Agent 铁律

1. **默认不用 Browser/Playwright MCP 做验证。** 例外只有一种:**只有真跑起来才会暴露的集成 bug**（图标名不存在、SSR/hydration mismatch、接口 404、白屏）。这类**加载一次页面看 console 与首屏**即可,不做逐步交互走查。
2. **能写成断言的,绝不靠截图。** 状态、互斥、上报、降级 → 一律进 Vitest。
3. **需浏览器取值时,一个 `browser_evaluate` 批量取全**（一次拿回所有 `getComputedStyle`/`querySelector` 结果做比对）,**不要一步一截图**。
4. **纯视觉/手感/响应式,不自己逐帧比对**——产出**带勾选框的人工走查清单**（含触发方式、URL、预期）,交人工过。
5. 触发条件（登录态、mock 场景、后台数据）不具备时,标「未验证/阻塞」并写清需谁补什么,**不空等、不假装通过**。

## 3. Agent 产出物

需求收口时 Agent 至少交:

- **Vitest 用例**:覆盖 §1 前三类（逻辑/边界/数据）,全绿;命令 + 结果贴报告。
- **DOM 契约校验结果**:一段 `browser_evaluate` 或脚本的输出（锚点/class/图标/computed style 对照表）。
- **集成加载结论**:目标页加载一次的 console 报错清单（0 error 或列出并说明）。
- **人工走查清单**（见 §4 模板）:把所有视觉/手感/响应式项列成勾选框,交人工。

## 4. 人工走查清单模板

Agent 生成,人工执行。每项写清怎么触发、看什么、Figma 节点。

```markdown
## <PROJECT-ID> UI/UX 人工走查清单

前置：<登录态 / mock 场景 / 触发路径>，URL：<...>

### 视觉 L2（对照 Figma 节点）
- [ ] 模块A 与 node <id> 并排 ≥95%：圆角/字号/间距/图标/主色
- [ ] 模块B 与 node <id> 并排 ≥95%：...

### 交互手感
- [ ] <操作> 后 <预期副作用>，翻页/动画顺滑，箭头朝向正确

### 响应式 / 主题
- [ ] 390px H5：不溢出、按钮可点、可滚动
- [ ] dark / light 各一遍无异常
```

## 5. 与旧规则的关系（修订说明）

- [quality-checklist.md](./quality-checklist.md) §3.5 与 [component-reuse-and-visual-fidelity.md](./component-reuse-and-visual-fidelity.md) 曾要求「**Agent 自己完成** L2 并排」。**本文修订为**:L2 视觉并排默认**由人工**执行,Agent 负责生成走查清单并保证 DOM 契约（结构/class/computed style）正确。
- [browser-e2e-mcp.md](./browser-e2e-mcp.md) 的「双 MCP 硬性」适用于**确需交互验证**的场景;纯视觉验收不再强制 Agent 逐步跑 MCP。
- 逻辑/API/Mock 用 Vitest 覆盖这一条**不变、加强**。

## 6. 测试生命周期（`.test.ts` 要不要跟业务上线、要不要清理）

**默认：单测是长期回归资产,跟业务代码一起 commit、一起上线,不清理。** 与 mock 脚手架（临时、接口就绪后零残留拆除,见 [mock-legacy-route-a.md](./mock-legacy-route-a.md) §8.0.3）方向相反——别把两者混为一谈。§1 前三类（逻辑/边界/数据）的断言,价值就在「将来每次改动都能回归」,删掉 = 自毁护栏。300 行上限也[豁免 test/spec/fixture](./rule-ids-and-gates.md)（`CODE-FILE-001`）,即按正式共存代码对待。

只有下面三类有生命周期,且处置方式都**不是「定期扫低价值测试批量删」**（误删护栏的风险远大于省下的体积）:

| 类型 | 会怎样过期 | 处置（低成本,自暴露优先） |
| --- | --- | --- |
| 纯函数/逻辑/边界/mapper 单测 | **不过期** | 永久共存,随业务上线;**不清理** |
| 真实 fixture 对账测试（`*.realFixture.test.ts`） | 接口改了 → fixture 是旧快照 | **更新 fixture,不是删测试**;fixture 头写「抓取日期 + YApi id」,对账失败时一眼判断是 fixture 老了还是 schema 错了 |
| 孤儿测试（被测业务代码已删） | 源码没了测试还在 | 跟源码一起删;删函数时 grep 同名 `describe`/import。挂在 **G5 删 mock/字段对账**同一环节顺带扫,不新增 gate |
| e2e Playwright | — | [禁止进项目仓库](./quality-checklist.md)、走 MCP 现跑现走,**本就不上线,无需清理** |

**不建议**:写脚本按「覆盖率低/断言少」批量删测试。删测试的收益（几 KB）远小于误删回归护栏的风险,违背 warn-first / 不轻易加团队负担的口径。

## 7. 一句话

**Agent 固化能回归的（逻辑、边界、数据、DOM 契约）,人工过一眼能判的（像素、手感、响应式）。** 各用所长,别让 Agent 干肉眼 0.5 秒的活。**单测跟业务一起上线、不清理;只有 fixture 会过期,更新它别删它。**
