#!/usr/bin/env node
/**
 * createTaskStore 单测：领取优先级 + 租约过期回收孤儿。拆分成独立 lib 后这段队列逻辑才可单测。
 *   node --test common/agent-scripts/__tests__/lark-task-store.test.mjs
 */

import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { createTaskStore } from '../lib/lark-task-store.mjs'

describe('createTaskStore', () => {
  let dir
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'lark-store-'))
  })
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('claimNext 按 createdAt 升序领取最早的 pending，并置 running + 盖 claimedAt', () => {
    const store = createTaskStore({ tasksDir: dir, leaseMs: 1000 })
    store.upsert({ id: 'b', status: 'queued', createdAt: '2026-01-02T00:00:00Z' })
    store.upsert({ id: 'a', status: 'queued', createdAt: '2026-01-01T00:00:00Z' })
    const claimed = store.claimNext()
    assert.equal(claimed.id, 'a')
    assert.equal(claimed.status, 'running')
    assert.ok(claimed.claimedAt)
    assert.equal(store.claimNext().id, 'b') // 下一个
    assert.equal(store.claimNext(), null) // 无 pending 剩余
  })

  it('租约过期的孤儿 running 任务在下次 claim 时重新入队（requeueCount 自增）', () => {
    const store = createTaskStore({ tasksDir: dir, leaseMs: 1000 })
    // claimedAt 远早于 now - leaseMs → 视为孤儿
    store.upsert({ id: 'orphan', status: 'running', claimedAt: '2000-01-01T00:00:00Z', createdAt: '2000-01-01T00:00:00Z' })
    const reclaimed = store.claimNext()
    assert.equal(reclaimed.id, 'orphan')
    assert.equal(reclaimed.status, 'running') // 回收后立即被本次 claim 领走
    assert.equal(reclaimed.requeueCount, 1)
  })

  it('未过租约的 running 任务不回收，claimNext 返回 null', () => {
    const store = createTaskStore({ tasksDir: dir, leaseMs: 60_000 })
    store.upsert({ id: 'busy', status: 'running', claimedAt: new Date().toISOString(), createdAt: '2026-01-01T00:00:00Z' })
    assert.equal(store.claimNext(), null)
    assert.equal(store.stats().stuck.length, 0)
  })

  it('重建 store 时从磁盘恢复已持久化的任务', () => {
    createTaskStore({ tasksDir: dir, leaseMs: 1000 }).upsert({ id: 'persisted', status: 'queued', createdAt: '2026-01-01T00:00:00Z' })
    const reopened = createTaskStore({ tasksDir: dir, leaseMs: 1000 })
    assert.equal(reopened.has('persisted'), true)
  })
})
