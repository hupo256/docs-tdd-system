# PRD Intake Evidence — PR-02172

## 来源

| 项 | 值 |
|----|-----|
| Lark PRD | `Zj7Dd8cdIorON3xmYSdlI94qg1c` |
| 标题 | PR-02172 【登录注册】增加第三方（tg、facebook） |
| revision | `1341` |
| 同步日期 | 2026-08-03 |
| 原始同步件 | `inbox/lark-sync/prd-latest.md` |
| 纯正文快照 | `inbox/prd-content.md` |

## 富媒体读取结果

| sourceId | 类型 | 读取方式 | 结论 | Feature / 去向 | 状态 |
|----------|------|----------|------|----------------|------|
| `PRD-IMG-001`～`PRD-IMG-035` | 竞品图片 | 下载原图 + PNG 校验 + 4 组联系表视觉查看 | Binance、Bitget、Facebook 等第三方授权/注册/关联竞品流程，仅作参考 | 评审问题 Q05；不直接定义 FameEX UI | 已读 |
| `PRD-IMG-036`～`PRD-IMG-037` | 需求图片 | 原图视觉查看 | 个人中心账户绑定新增 Telegram / Facebook | F09 | 已读 |
| `PRD-IMG-038`～`PRD-IMG-039` | 需求图片 | 原图视觉查看 | 管理后台用户列表/详情新增第三方字段、筛选与导出 | F10 | 已读 |
| `PRD-IMG-040` | 需求图片 | 原图视觉查看 | 第三方绑定关联历史表格示意 | F13 | 已读 |
| `PRD-TABLE-001` | 表格 | 结构化正文读取 | Telegram/Facebook 可获取字段及 email 分支 | F02 | 已读 |
| `PRD-TABLE-002` | 表格 | 结构化正文读取 | Web/iOS/Android 各包入口展示 | F08 | 已读 |
| `PRD-TABLE-003` | 表格 | 结构化正文读取 | 并发、重复账号、超时、验证码、外部撤销、注销异常 | F12 | 已读 |
| `PRD-TABLE-004` | 表格 | 结构化正文读取 | 绑定/解绑历史的时间、操作、平台、账号字段 | F13 | 已读 |
| `PRD-TABLE-005` | 表格 | 结构化正文读取 | `click_tg_login` / `click_fb_login` 埋点 | F14 | 已读 |
| `PRD-TABLE-006` | 表格 | 结构化正文读取 | 入口、直登、注册、关联、并发、解绑、后台、日志、埋点和兼容验收 | F01-F15 | 已读 |
| `PRD-EMBED-001`～`004` | 用户引用 | 结构化正文读取 | 版本/评审参与人元数据，不构成功能需求 | 文档元数据 | 已读 |
| `PRD-EMBED-005` | 白板 | `whiteboard +query`、`docs +media-download` | 两种方式均因缺 `board:whiteboard:node:read` 失败 | 核心登录注册流程；评审前需授权或导出 | 阻塞 |
| `PRD-EMBED-006` | 引用文档 | `docs +fetch` 读取 PR-01268 现货后台章节 | 后台涉及手机/邮箱展示和导出脱敏；具体格式仍需审计/后端契约化 | F13、Q45 | 已读 |

## 本地素材证据

- 40 张图片保存于 `inbox/prd-assets/PRD-IMG-001.png`～`PRD-IMG-040.png`。
- 文件类型校验全部为 PNG，共约 11.2 MB。
- 联系表位于 `inbox/prd-assets/contact-sheets/`，每 10 张一组。
- 下载 URL、字节数和 SHA-256 位于 `inbox/prd-assets/download-manifest.json`。

## 阻塞与歧义

| 项 | 影响 | 处理 |
|----|------|------|
| 白板不可读 | 核心流程可能存在正文未覆盖分支，阻断 G2 | 补 `board:whiteboard:node:read` 或由产品导出图片/文字流程 |
| Figma 未读取 | UI/交互不可定稿 | 技术评审前后按 `write_figma` 场景读取 node `9137:2` |
| PRD 未技术评审 | 52 个 scope/API/安全/跨端问题未决 | 会议逐条确认 `product/06-collaboration.md` Q01-Q52 |

## 执行记录

| 命令 / 工具 | 目标文件 / 场景 | 结果 | 备注 |
|-------------|-----------------|------|------|
| `lark-cli docs +fetch` | PRD 全文与 outline | PASS | revision `1341` |
| HTTP 下载 + `file` | 40 张图片 | PASS | 全部有效 PNG |
| `view_image` | 4 组联系表 | PASS | 已区分竞品参考与直接需求素材 |
| `lark-cli whiteboard +query` | 登录注册白板 | FAIL | 权限阻塞，未冒充已读 |
| `lark-cli docs +fetch` | PR-01268 引用章节 | PASS | 已获得后台脱敏场景参考 |
