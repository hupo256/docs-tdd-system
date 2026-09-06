# PR-02233 vNext work-item slices

原始 41 requirements / 117 surfaces 的 V2 工作项超过 8K 上下文预算，按独立可验证批次拆分；原件保存在同目录 `work-item-full.json`。

| 顺序 | 文件 | 范围 | 当前状态 |
|------|------|------|----------|
| 1 | `01-login-register.json` | Web 登录注册、切换入口、方式优先级、独立倒计时与主链路回归（2026-09-05 起 App surface 全部 deferred 到批次 06，见 change-scope-boundary.md §1.2；R-030 移交 06；审查 response 见 `b01-review-response-2026-09-05.json`） | 当前激活（镜像到 `common/vnext/pilots/PR-02233/work-item.json`）；Web 定向测试/MSW/biome 已过，仅剩浏览器运行时证据采集，步骤见 `common/vnext/HANDOFF-phase7-pr02233.md` |
| 2 | `02-security-dialog-migration.json` | 敏感操作规则、页面/弹窗边界、绑定/换绑两阶段验证 | 后续批次 |
| 3 | `03-help-dialog.json` | 唯一帮助入口与帮助弹窗 | 后续批次 |
| 4 | `04-request-state.json` | 发送四态、限频/失败/刷新恢复 | 后续批次 |
| 5 | `05-analytics-regression.json` | 7 类埋点与总回归 | 后续批次 |
| 6 | `06-app-delegated.json` | App 专属/跨端条目 | 非本仓实施，交 App owner |

切换批次时：复制目标文件为 `common/vnext/pilots/PR-02233/work-item.json`，用稳定化后的完整当前来源重新生成该切片的独立 review response、verification input 和 evidence，不沿用其他切片的实现证据。独立审查必须把批次外需求记录为带 owner/batch 的 `deferred` finding，不能以空 findings 隐式忽略。
