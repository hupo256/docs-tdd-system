#!/usr/bin/env node
/**
 * CLI 报告打印小工具：把「成堆的 console.log(`label: ${value}`)」收敛成 数据 + 单一打印器。
 * docs-tdd 的 capability 状态报告与 context 指标报告本是两坨逐字段 console.log，现共用同一形态：
 * 一张 [label, value] 行表 + 一组告警行。改一处对齐/前缀就全局生效，不用逐行改。
 *
 * 纯 IO 包装（只 console.log/warn），无可测纯逻辑，故登记 check-doc-budget 的 SELF_TEST_EXEMPT。
 */

// 打印 `label: value` 行。value 为 undefined/null 的行跳过（可选字段缺省时不打印空行）。
export const printReport = (rows) => {
  for (const [label, value] of rows) {
    if (value === undefined || value === null) continue
    console.log(`${label}: ${value}`)
  }
}

// 打印告警行（各走 console.warn）；falsy 项自动跳过，调用方可用 `cond && '...'` 内联条件收集。
export const printWarnings = (messages) => {
  for (const message of messages) {
    if (message) console.warn(message)
  }
}
