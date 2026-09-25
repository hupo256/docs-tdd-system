#!/usr/bin/env node
/**
 * check-doc-budget.mjs 的纯解析/校验工具：码点计数、README frontmatter 解析、轻量 JSON Schema 校验。
 * 抽出到 lib 以便 `--self-test` 直测（此前内联在 gate 脚本里，只能靠整脚本实跑间接覆盖），
 * 同时给体量偏大的 check-doc-budget.mjs 瘦身。零 IO、零副作用。
 */

import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

/** 码点数，近似“字符数”直觉（Chinese/emoji 各计 1）。 */
export function charCount(text) {
  return Array.from(text).length
}

// 解析 README 顶部 YAML frontmatter，只处理简单标量。
export function parseFrontmatter(text) {
  const match = text.match(/^---\n([\s\S]*?)\n---\n?/)
  if (!match) return null
  const result = {}
  for (const line of match[1].split('\n')) {
    const colonIndex = line.indexOf(':')
    if (colonIndex === -1) continue
    const key = line.slice(0, colonIndex).trim()
    let value = line.slice(colonIndex + 1).trim()
    let quoted = false
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
      quoted = true
    }
    if (value === 'true') result[key] = true
    else if (value === 'false') result[key] = false
    else if (!quoted && /^\d+$/.test(value)) result[key] = Number(value)
    else result[key] = value
  }
  return result
}

function valueTypeMatches(value, type) {
  if (type === 'null') return value === null
  if (type === 'array') return Array.isArray(value)
  if (type === 'object') return value !== null && typeof value === 'object' && !Array.isArray(value)
  if (type === 'integer') return Number.isInteger(value)
  if (type === 'number') return typeof value === 'number' && Number.isFinite(value)
  return typeof value === type
}

function schemaPath(path) {
  return path || 'root'
}

function resolveReference(reference, rootSchema) {
  if (!reference.startsWith('#/')) throw new Error(`unsupported JSON Schema reference: ${reference}`)
  return reference.slice(2).split('/').reduce((current, segment) => {
    const key = segment.replaceAll('~1', '/').replaceAll('~0', '~')
    return current?.[key]
  }, rootSchema)
}

function validate(value, schema, path, rootSchema) {
  const errors = []
  if (!schema || typeof schema !== 'object') return errors
  if (Array.isArray(schema.type)) {
    const matchingType = schema.type.find((type) => valueTypeMatches(value, type))
    if (!matchingType) return [`${schemaPath(path)} 类型不匹配`]
    return validate(value, { ...schema, type: matchingType }, path, rootSchema)
  }
  if (schema.$ref) {
    const referenced = resolveReference(schema.$ref, rootSchema)
    if (!referenced) return [`${schemaPath(path)} 引用了不存在的 schema ${schema.$ref}`]
    return validate(value, referenced, path, rootSchema)
  }
  if (schema.const !== undefined && !Object.is(value, schema.const)) {
    errors.push(`${schemaPath(path)} 必须等于 ${JSON.stringify(schema.const)}`)
  }
  if (schema.enum && !schema.enum.some((candidate) => Object.is(candidate, value))) {
    errors.push(`${schemaPath(path)} 值 ${JSON.stringify(value)} 不在枚举 [${schema.enum.map((item) => JSON.stringify(item)).join(', ')}] 中`)
  }
  if (schema.anyOf) {
    const valid = schema.anyOf.some((candidate) => validate(value, candidate, path, rootSchema).length === 0)
    if (!valid) errors.push(`${schemaPath(path)} 不匹配任何 anyOf 分支`)
  }
  for (const candidate of schema.allOf || []) errors.push(...validate(value, candidate, path, rootSchema))
  if (schema.if) {
    const conditionMatches = validate(value, schema.if, path, rootSchema).length === 0
    if (conditionMatches && schema.then) errors.push(...validate(value, schema.then, path, rootSchema))
    if (!conditionMatches && schema.else) errors.push(...validate(value, schema.else, path, rootSchema))
  }
  const isObject = valueTypeMatches(value, 'object')
  const hasObjectKeywords = schema.required || schema.properties || schema.additionalProperties !== undefined
  if (schema.type === 'object' && !isObject) return [`${schemaPath(path)} 必须是 object`]
  if (isObject && (schema.type === 'object' || hasObjectKeywords)) {
    for (const key of schema.required || []) if (!(key in value)) errors.push(`${schemaPath(path)} 缺少必填字段 ${key}`)
    for (const [key, propSchema] of Object.entries(schema.properties || {})) {
      if (key in value) errors.push(...validate(value[key], propSchema, `${path}.${key}`, rootSchema))
    }
    for (const key of Object.keys(value)) {
      if (schema.properties && key in schema.properties) continue
      if (schema.additionalProperties === false) errors.push(`${schemaPath(path)} 包含未声明字段 ${key}`)
      else if (schema.additionalProperties && typeof schema.additionalProperties === 'object') {
        errors.push(...validate(value[key], schema.additionalProperties, `${path}.${key}`, rootSchema))
      }
    }
  }
  const isArray = Array.isArray(value)
  const hasArrayKeywords = schema.items || schema.minItems !== undefined || schema.maxItems !== undefined || schema.uniqueItems
  if (schema.type === 'array' && !isArray) return [`${schemaPath(path)} 必须是 array`]
  if (isArray && (schema.type === 'array' || hasArrayKeywords)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) errors.push(`${schemaPath(path)} 至少需要 ${schema.minItems} 项`)
    if (schema.maxItems !== undefined && value.length > schema.maxItems) errors.push(`${schemaPath(path)} 最多允许 ${schema.maxItems} 项`)
    if (schema.uniqueItems) {
      const fingerprints = value.map((item) => JSON.stringify(item))
      if (new Set(fingerprints).size !== fingerprints.length) errors.push(`${schemaPath(path)} 不允许重复项`)
    }
    if (schema.items) for (let i = 0; i < value.length; i += 1) errors.push(...validate(value[i], schema.items, `${path}[${i}]`, rootSchema))
  }
  if (schema.type === 'string') {
    if (typeof value !== 'string') return [`${schemaPath(path)} 必须是 string`]
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) errors.push(`${path} 值 "${value}" 不匹配模式 ${schema.pattern}`)
    if (schema.minLength !== undefined && value.length < schema.minLength) errors.push(`${path} 长度必须 ≥ ${schema.minLength}`)
    if (schema.maxLength !== undefined && value.length > schema.maxLength) errors.push(`${path} 长度必须 ≤ ${schema.maxLength}`)
    if (schema.format === 'date-time' && Number.isNaN(Date.parse(value))) errors.push(`${path} 必须是有效 date-time`)
  } else if (schema.type === 'integer') {
    if (!Number.isInteger(value)) return [`${schemaPath(path)} 必须是 integer`]
    if (schema.minimum !== undefined && value < schema.minimum) errors.push(`${path} 必须 ≥ ${schema.minimum}`)
    if (schema.maximum !== undefined && value > schema.maximum) errors.push(`${path} 必须 ≤ ${schema.maximum}`)
  } else if (schema.type === 'number') {
    if (!valueTypeMatches(value, 'number')) return [`${schemaPath(path)} 必须是 number`]
    if (schema.minimum !== undefined && value < schema.minimum) errors.push(`${path} 必须 ≥ ${schema.minimum}`)
    if (schema.maximum !== undefined && value > schema.maximum) errors.push(`${path} 必须 ≤ ${schema.maximum}`)
  } else if (schema.type === 'boolean' && typeof value !== 'boolean') errors.push(`${schemaPath(path)} 必须是 boolean`)
  return errors
}

// 轻量 JSON Schema 校验（draft-07 子集）。不引入外部依赖，覆盖 docs_tdd schemas 实际使用的关键字。
export function validateSchema(value, schema, path = '') {
  return validate(value, schema, path, schema)
}

export function selfTest() {
  // charCount：码点计数，中文/emoji 各计 1
  assert.equal(charCount('abc'), 3)
  assert.equal(charCount('中文'), 2)
  assert.equal(charCount('a😀b'), 3)

  // parseFrontmatter：标量类型归一 + 引号剥离 + 无 frontmatter 返回 null
  assert.equal(parseFrontmatter('no frontmatter'), null)
  assert.deepEqual(
    parseFrontmatter('---\nstage: G3\nactive: true\ndone: false\ncount: 12\nquoted: "42"\n---\nbody'),
    { stage: 'G3', active: true, done: false, count: 12, quoted: '42' },
  )

  // validateSchema：类型/必填/未声明字段/枚举/模式/数组/组合条件/$ref
  const schema = {
    type: 'object',
    required: ['id', 'stage'],
    additionalProperties: false,
    definitions: {
      tag: { type: 'string', minLength: 2, maxLength: 4 },
    },
    properties: {
      id: { type: 'string', pattern: '^(?:PR|TR)-\\d{5}$' },
      stage: { enum: ['G0', 'G3', 'G6'] },
      order: { type: 'integer', minimum: 0 },
      tags: { type: 'array', minItems: 1, maxItems: 2, uniqueItems: true, items: { $ref: '#/definitions/tag' } },
      recordedAt: { type: 'string', format: 'date-time' },
      kind: { const: 'feature' },
    },
    allOf: [{
      if: { properties: { stage: { const: 'G6' } }, required: ['stage'] },
      then: { required: ['recordedAt'] },
    }],
  }
  assert.deepEqual(validateSchema({ id: 'PR-01947', stage: 'G3', order: 1, tags: ['aa'], kind: 'feature' }, schema), [])
  assert.deepEqual(validateSchema({ id: 'TR-02386', stage: 'G6', order: 1, tags: ['aa'], recordedAt: '2026-09-25T00:00:00Z', kind: 'feature' }, schema), [])
  assert.deepEqual(validateSchema('nope', schema), ['root 必须是 object'])
  const bad = validateSchema({ id: 'X', stage: 'G6', order: -1, extra: 1, tags: ['x', 'x', 'toolong'], recordedAt: 'bad', kind: 'bugfix' }, schema)
  assert.ok(bad.some((e) => e.includes('缺少必填字段')) === false) // id/stage 都在
  assert.ok(bad.some((e) => e.includes('不匹配模式')))
  assert.ok(bad.some((e) => e.includes('必须 ≥ 0')))
  assert.ok(bad.some((e) => e.includes('包含未声明字段 extra')))
  assert.ok(bad.some((e) => e.includes('最多允许 2 项')))
  assert.ok(bad.some((e) => e.includes('不允许重复项')))
  assert.ok(bad.some((e) => e.includes('长度必须 ≥ 2')))
  assert.ok(bad.some((e) => e.includes('长度必须 ≤ 4')))
  assert.ok(bad.some((e) => e.includes('有效 date-time')))
  assert.ok(bad.some((e) => e.includes('必须等于 "feature"')))
  assert.ok(validateSchema({ id: 'PR-01947', stage: 'G6', order: 1, tags: ['aa'], kind: 'feature' }, schema).some((e) => e.includes('缺少必填字段 recordedAt')))
  console.log('doc-budget-schema self-test passed (charCount, parseFrontmatter, validateSchema).')
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url) && process.argv.includes('--self-test')) {
  selfTest()
}
