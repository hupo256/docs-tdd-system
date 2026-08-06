/**
 * Lark 回执卡片构建（纯函数层，零副作用）。
 *
 * 回执卡片样式与 notify-lark.mjs 的 G0-G8 卡片同一套规则（header 彩色模板 + 图标 + note 时间行），
 * 让 bot 主动发的「已收到/完成/失败/告警」与项目进度卡片视觉统一。
 */

export const formatDisplayTime = (date = new Date()) => {
  const pad = (value) => String(value).padStart(2, '0')
  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

const RECEIPT_STYLES = {
  queued: { template: 'blue', icon: '🔄', statusText: '已收到，正在排队处理' },
  done: { template: 'green', icon: '✅', statusText: '已完成' },
  failed: { template: 'red', icon: '⛔', statusText: '处理失败' },
  alert: { template: 'red', icon: '⚠️', statusText: 'Lark 长连接异常' },
}

// 构建 interactive 卡片 content（供 sendChatMessage 的 --content 使用）。lines 为「**标签**：值」正文行。
// 标题跟随任务项目：传 project 用它（跨项目 @ / bug 表任务），不传则回落 config.project + config.title（gateway 级告警）。
export const buildCardContent = ({ config, kind, lines, project, projectTitle }) => {
  const style = RECEIPT_STYLES[kind]
  const headerProject = project || config.project
  const suffix = projectTitle !== undefined
    ? (projectTitle ? ` ${projectTitle}` : '')
    : (headerProject === config.project ? ` ${config.title || config.project}` : '')
  const content = [`**状态**：${style.statusText} ${style.icon}`, ...lines].join('\n')
  return JSON.stringify({
    config: { wide_screen_mode: true },
    header: {
      template: style.template,
      title: { tag: 'plain_text', content: `[${headerProject}]${suffix}` },
    },
    elements: [
      { tag: 'div', text: { tag: 'lark_md', content } },
      { tag: 'note', elements: [{ tag: 'plain_text', content: formatDisplayTime() }] },
    ],
  })
}

const taskLine = (task) => `**任务**：${(task.summary || task.text || '').slice(0, 200)}`

// 卡片标题用的项目段：有项目号用它（仅当 == config.project 才带 config.title 后缀），
// 无项目号（adhoc 主仓 hotfix）显示「主仓 hotfix」。
const cardProjectOf = (task, config) => ({
  project: task.project || '主仓 hotfix',
  projectTitle: task.project ? (task.project === config.project ? config.title : undefined) : '',
})

export const buildQueuedCard = ({ config, task, note }) =>
  buildCardContent({ config, kind: 'queued', lines: note ? [taskLine(task), note] : [taskLine(task)], ...cardProjectOf(task, config) })

export const buildResultCard = ({ config, task, status, result }) => {
  const resultText = (result || (status === 'done' ? '已完成。' : '处理失败。')).trim()
  return buildCardContent({
    config,
    kind: status === 'done' ? 'done' : 'failed',
    lines: [taskLine(task), `**结果**：\n${resultText}`],
    ...cardProjectOf(task, config),
  })
}
