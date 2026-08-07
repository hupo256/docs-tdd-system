/**
 * 任务存储：文件队列 + 内存索引。启动恢复未完成任务、领取时回收租约过期的孤儿 running 任务。
 * 逻辑集中在此，便于单测（`node --test`）覆盖租约回收与优先级排序。
 */

import { mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export const createTaskStore = ({ tasksDir, leaseMs }) => {
  mkdirSync(tasksDir, { recursive: true })
  const tasks = new Map()

  // 启动时恢复未完成任务
  for (const file of readdirSync(tasksDir)) {
    if (!file.endsWith('.json')) continue
    try {
      const task = JSON.parse(readFileSync(join(tasksDir, file), 'utf8'))
      tasks.set(task.id, task)
    } catch {
      // 损坏的任务文件跳过，不阻塞启动
    }
  }

  const persist = (task) => {
    writeFileSync(join(tasksDir, `${task.id}.json`), JSON.stringify(task, null, 2))
  }

  const removeFile = (id) => {
    try {
      unlinkSync(join(tasksDir, `${id}.json`))
    } catch {
      // 文件可能已被清理，忽略
    }
  }

  const isOrphan = (task, now) =>
    task.status === 'running' && task.claimedAt && now - new Date(task.claimedAt).getTime() > leaseMs

  // 回收租约过期的孤儿 running 任务（worker 崩溃/被杀后任务不会永卡 running），重新入队待领取。
  const reclaimOrphans = () => {
    const now = Date.now()
    for (const task of tasks.values()) {
      if (!isOrphan(task, now)) continue
      task.status = 'queued'
      task.claimedAt = null
      task.requeuedAt = new Date(now).toISOString()
      task.requeueCount = (task.requeueCount || 0) + 1
      persist(task)
      console.warn(`[lark-gateway] 租约过期，重新入队孤儿任务 ${task.id}（第 ${task.requeueCount} 次）`)
    }
  }

  return {
    has: (id) => tasks.has(id),
    get: (id) => tasks.get(id),
    list: () => [...tasks.values()],
    upsert(task) {
      task.updatedAt = new Date().toISOString()
      tasks.set(task.id, task)
      persist(task)
      return task
    },
    // 人工重触发：把失败/阻塞的任务重置为待领取，worker 下一轮重新执行。
    // 群 @ 任务本可直接重新 @（新 messageId 天然是新任务）；bug 表任务 id=record_id 固定，
    // POST 幂等会命中旧 failed，只能靠这里显式重置，否则永远重跑不了。
    retry(id) {
      const task = tasks.get(id)
      if (!task || (task.status !== 'failed' && task.status !== 'blocked')) return null
      task.status = 'queued'
      task.claimedAt = null
      task.requeuedAt = new Date().toISOString()
      task.retryCount = (task.retryCount || 0) + 1
      task.updatedAt = task.requeuedAt
      persist(task)
      return task
    },
    // 陈旧终态清理：删除 updatedAt 早于 olderThanMs 的指定终态任务（默认只清 done），
    // 让 /lark/health 计数不再单调增长。返回被删除的 id 列表。
    // 注意：清 failed 会让 bug 表对应记录（若仍待处理）在 poller 下一轮被当新任务重投，
    // 等于变相自动重试，故 failed 默认保留、交由人工 retry/clear 处置。
    pruneTerminal({ olderThanMs = 0, statuses = ['done'] } = {}) {
      const cutoff = Date.now() - olderThanMs
      const removed = []
      for (const task of [...tasks.values()]) {
        if (!statuses.includes(task.status)) continue
        const ts = new Date(task.updatedAt || task.createdAt).getTime()
        if (Number.isFinite(ts) && ts > cutoff) continue
        tasks.delete(task.id)
        removeFile(task.id)
        removed.push(task.id)
      }
      return removed
    },
    // 领取一个 pending 任务并置为 running（盖 claimedAt 作租约）。
    // 领取前先回收租约过期的孤儿 running 任务（worker 崩溃/被杀后任务不会永卡 running）。
    claimNext() {
      reclaimOrphans()
      const pending = [...tasks.values()]
        .filter((task) => task.status === 'queued' || task.status === 'received')
        .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))[0]
      if (!pending) return null
      pending.status = 'running'
      pending.claimedAt = new Date(Date.now()).toISOString()
      persist(pending)
      return pending
    },
    // 按 id 原子领取（并行调度器用）：先回收孤儿，再仅当该任务处于可领取态时置 running。
    // 已被并发领走 / 状态已变 → 返回 null，调用方跳过。
    claimById(id) {
      reclaimOrphans()
      const task = tasks.get(id)
      if (!task || (task.status !== 'queued' && task.status !== 'received')) return null
      task.status = 'running'
      task.claimedAt = new Date(Date.now()).toISOString()
      persist(task)
      return task
    },
    // 健康检查用：各状态计数 + 租约已过期仍 running 的卡住任务 id
    stats() {
      const now = Date.now()
      const byStatus = {}
      const stuck = []
      for (const task of tasks.values()) {
        byStatus[task.status] = (byStatus[task.status] || 0) + 1
        if (isOrphan(task, now)) stuck.push(task.id)
      }
      return { counts: byStatus, stuck }
    },
  }
}
