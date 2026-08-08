#!/usr/bin/env node

/**
 * schema-fixture-reconcile —— 自动化 architecture-and-state.md §8.1 字段对账里最易漏的一列：
 * 「真实接口有、但前端 schema 没声明 → 被 .parse() 静默剥离 → 字段全程消失」（PR-01685 rewardDescription 根因）。
 *
 * 原理：zod `.parse()` 默认剥离未声明 key。故对真实 fixture 做 `schema.parse(raw)`，
 * 再深比对 raw 与 parsed 的 key 路径：出现在 raw、缺席于 parsed 的 = schema 漏声明的字段。
 * 纯函数不依赖 zod，只吃两个普通对象（raw 与 parsed），可独立单测、也可在 *.realFixture.test.ts 里接线：
 *
 *   import { diffStrippedKeys } from '.../schema-fixture-reconcile.mjs'
 *   const raw = readFixture('codex-detail.json').data
 *   expect(diffStrippedKeys(raw, detailSchema.parse(raw))).toEqual([])
 *
 * 适用范围：纯 shape 校验 schema（无 .transform 改结构）。带 transform 的 schema 会有合法结构差异，不适用本对账。
 */

// 深比对：返回所有「在 a 中存在、在 b 中缺席」的 key 路径（点分/下标）。数组按「全元素 key 并集」比对，
// 避免样本里某条恰好缺某字段导致漏检；只关心 key 结构差异，不比对值。
export function diffStrippedKeys(a, b, prefix = '') {
  const stripped = []

  const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)

  if (Array.isArray(a)) {
    if (!Array.isArray(b)) {
      // a 是数组、b 不是 → 结构已变（可能 transform），登记整段。
      if (a.length > 0) stripped.push(`${prefix}[]`)
      return stripped
    }
    // 合并 a 全元素为一个「并集样本」再与 b 的并集比对，规避稀疏样本。
    const aUnion = mergeArrayElements(a)
    const bUnion = mergeArrayElements(b)
    if (aUnion === null) return stripped // 原始值数组，无 key 可比
    return diffStrippedKeys(aUnion, bUnion ?? {}, `${prefix}[]`)
  }

  if (isObj(a)) {
    if (!isObj(b)) {
      // a 是对象、b 不是 → 整段被剥离/改型。
      for (const key of Object.keys(a)) stripped.push(prefix ? `${prefix}.${key}` : key)
      return stripped
    }
    for (const key of Object.keys(a)) {
      const path = prefix ? `${prefix}.${key}` : key
      if (!(key in b)) {
        stripped.push(path)
        continue
      }
      stripped.push(...diffStrippedKeys(a[key], b[key], path))
    }
  }

  return stripped
}

// 把数组全部对象元素的 key 并起来，形成一个覆盖所有出现过字段的「并集样本」。
function mergeArrayElements(arr) {
  const objs = arr.filter((v) => v !== null && typeof v === 'object' && !Array.isArray(v))
  if (objs.length === 0) {
    // 可能是嵌套数组或原始值数组。
    const nested = arr.filter(Array.isArray)
    if (nested.length > 0) return nested.flat()
    return null
  }
  const merged = {}
  for (const obj of objs) {
    for (const key of Object.keys(obj)) {
      if (!(key in merged)) merged[key] = obj[key]
      else if (merged[key] !== null && typeof merged[key] === 'object') {
        // 同名 key 递归并集，保证深层字段也不漏。
        merged[key] = mergeDeep(merged[key], obj[key])
      }
    }
  }
  return merged
}

function mergeDeep(x, y) {
  if (Array.isArray(x) && Array.isArray(y)) return [...x, ...y]
  if (x !== null && typeof x === 'object' && y !== null && typeof y === 'object') {
    const out = { ...x }
    for (const key of Object.keys(y)) out[key] = key in out ? mergeDeep(out[key], y[key]) : y[key]
    return out
  }
  return x
}

function printHelp() {
  console.log(`usage: schema-fixture-reconcile.mjs [--self-test] [--help]

Diff raw fixture keys against parsed keys to detect schema fields stripped by zod .parse().
Export diffStrippedKeys() for use in *.realFixture.test.ts or standalone checks.

Options:
  --help       Show this help message and exit
  --self-test  Run inline self-test`)
}

if (process.argv.includes('--help')) {
  printHelp()
  process.exit(0)
}

// --self-test：合成数据证明检出「schema 漏字段」，不依赖 app 的 zod。
if (process.argv.includes('--self-test')) {
  const cases = []
  const eq = (name, got, want) => cases.push({ name, ok: JSON.stringify(got) === JSON.stringify(want), got, want })

  // 1) 顶层漏字段（rewardDescription 场景）
  eq('top-level stripped', diffStrippedKeys({ id: '1', rewardDescription: 'x' }, { id: '1' }), ['rewardDescription'])
  // 2) 无差异
  eq('no diff', diffStrippedKeys({ a: 1, b: 2 }, { a: 1, b: 2 }), [])
  // 3) 嵌套漏字段
  eq('nested stripped', diffStrippedKeys({ reward: { amount: 1, unit: 'USDT' } }, { reward: { amount: 1 } }), ['reward.unit'])
  // 4) 数组元素漏字段（稀疏样本：只有第二条带 desc，也要检出）
  eq('array element stripped', diffStrippedKeys([{ id: 1 }, { id: 2, desc: 'y' }], [{ id: 1 }, { id: 2 }]), ['[].desc'])
  // 5) 值不同不算差异（只比 key 结构）
  eq('value diff ignored', diffStrippedKeys({ a: 1 }, { a: 999 }), [])

  let allOk = true
  for (const c of cases) {
    console.log(`${c.ok ? 'PASS' : 'FAIL'} ${c.name}${c.ok ? '' : ` got=${JSON.stringify(c.got)} want=${JSON.stringify(c.want)}`}`)
    if (!c.ok) allOk = false
  }
  process.exit(allOk ? 0 : 1)
}
