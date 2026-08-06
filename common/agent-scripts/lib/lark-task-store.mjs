/**
 * 任务存储：文件队列 + 内存索引。启动恢复未完成任务、领取时回收租约过期的孤儿 running 任务。
 * 逻辑集中在此，便于单测（`node --test`）覆盖租约回收与优先级排序。
 */

import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
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

  const isOrphan = (task, now) =>
    task.status === 'running' && task.claimedAt && now - new Date(task.claimedAt).getTime() > leaseMs

  return {
    has: (id) => tasks.has(id),
    get: (id) => tasks.get(id),
    list: () => [...tasks.values()],
    upsert(task) {
      tasks.set(task.id, task)
      persist(task)
      return task
    },
    // 领取一个 pending 任务并置为 running（盖 claimedAt 作租约）。
    // 领取前先回收租约过期的孤儿 running 任务（worker 崩溃/被杀后任务不会永卡 running）。
    claimNext() {
      const now = Date.now()
      for (const task of tasks.values()) {
        if (isOrphan(task, now)) {
          task.status = 'queued'
          task.claimedAt = null
          task.requeuedAt = new Date(now).toISOString()
          task.requeueCount = (task.requeueCount || 0) + 1
          persist(task)
          console.warn(`[lark-gateway] 租约过期，重新入队孤儿任务 ${task.id}（第 ${task.requeueCount} 次）`)
        }
      }
      const pending = [...tasks.values()]
        .filter((task) => task.status === 'queued' || task.status === 'received')
        .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))[0]
      if (!pending) return null
      pending.status = 'running'
      pending.claimedAt = new Date(now).toISOString()
      persist(pending)
      return pending
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
