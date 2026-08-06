/**
 * Lark 无人值守修复的轻量规范闸：只扫「本次 diff 新增行」里两类高置信度违规，
 * 不碰团队 CI、不扫既有存量债（只看 + 行）。给 worker 在回写 done 前拦一道。
 *
 * 覆盖两条最常被自动修 bug 踩中的红线（对照 ~/.ai-rules/skills/coding-quality）：
 *  1. Tailwind arbitrary value（如 rounded-[8px]、text-[14px]、w-[336px]）——应改用 preset token。
 *  2. 无 shade 的裸 Tailwind 调色板色类（如 text-green / bg-red）——Tailwind 会静默丢弃，
 *     文字/背景根本不变色也不报错；项目语义色应用 text-sem-g / text-sem-r / text-1..8 等 token。
 *
 * 纯函数 scanDiffForViolations(diffText) 便于 node --test 覆盖。
 */

// 只检查前端源码文件的改动
const CODE_FILE_RE = /\.(tsx|ts|jsx|js|css)$/

// Tailwind arbitrary value：<前缀>-[<任意>]。前缀限定为常见工具类，避免误伤 TS 里的 `a - [1]` 等。
const ARBITRARY_RE =
  /\b(?:[a-z][\w.]*:)*(?:w|h|size|min-w|max-w|min-h|max-h|p[xytblr]?|m[xytblr]?|gap(?:-[xy])?|space-[xy]|top|bottom|left|right|inset(?:-[xy])?|text|bg|border(?:-[tblrxy])?|rounded(?:-[tblr]|-[tb][lr])?|leading|tracking|z|opacity|shadow|fill|stroke|grid-cols|grid-rows|col-span|row-span|basis|flex|order|duration|delay|translate-[xy]|scale|rotate)-\[[^\]]+\]/

// 无 shade 的裸调色板色（Tailwind v3 默认色必须带 -数字 shade，裸名一定失效）
const BARE_COLOR_RE =
  /\b(?:text|bg|border|fill|stroke|ring|from|to|via|decoration|divide|outline|shadow|caret|accent)-(?:red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|gray|grey|slate|zinc|neutral|stone)\b(?!-)/

// 从 unified diff 抽出违规：只看新增行（+ 开头，排除 +++ 头），按当前所属文件归类
export const scanDiffForViolations = (diffText) => {
  const violations = []
  let currentFile = null
  let isCodeFile = false

  for (const line of String(diffText || '').split('\n')) {
    if (line.startsWith('+++ ')) {
      // 形如 `+++ b/apps/web/src/x.tsx`（或 /dev/null）
      currentFile = line.replace(/^\+\+\+ (?:b\/)?/, '').trim()
      isCodeFile = currentFile !== '/dev/null' && CODE_FILE_RE.test(currentFile)
      continue
    }
    if (!isCodeFile) continue
    if (!line.startsWith('+') || line.startsWith('+++')) continue

    const added = line.slice(1)
    const arbitrary = added.match(ARBITRARY_RE)
    if (arbitrary) violations.push({ file: currentFile, kind: 'arbitrary-value', token: arbitrary[0], line: added.trim().slice(0, 160) })
    const bareColor = added.match(BARE_COLOR_RE)
    if (bareColor) violations.push({ file: currentFile, kind: 'invalid-color-class', token: bareColor[0], line: added.trim().slice(0, 160) })
  }
  return violations
}

// 违规清单 → 给 AI 的纠正说明（列出 file/token/建议），供 worker 二次修复 prompt 用
export const formatViolations = (violations) =>
  violations
    .map((v, i) => {
      const advice =
        v.kind === 'arbitrary-value'
          ? '改用 packages/config/tailwind-preset.js 里的 token（如 rounded-[8px]→rounded-m，间距/字号/圆角/颜色都有 token）'
          : '这是无 shade 的裸调色板色，Tailwind 会静默丢弃、根本不生效；换成项目语义 token（语义绿 text-sem-g、语义红 text-sem-r、正文 text-1/2/3）'
      return `${i + 1}. [${v.kind}] ${v.file}：\`${v.token}\` → ${advice}\n   所在行：${v.line}`
    })
    .join('\n')
