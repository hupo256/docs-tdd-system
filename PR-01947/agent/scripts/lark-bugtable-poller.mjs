#!/usr/bin/env node

import { runLarkBugtablePoller } from '../../../common/agent-scripts/lark-bugtable-poller.mjs'

runLarkBugtablePoller({
  configPath: 'apps/web/docs_tdd/PR-01947/agent/scripts/lark-bot.local.json',
}).catch((error) => {
  console.error(error)
  process.exit(1)
})
