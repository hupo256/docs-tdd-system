#!/usr/bin/env node

import { runLarkBugtablePoller } from '../../../common/agent-scripts/lark-bugtable-poller.mjs'

runLarkBugtablePoller({
  configPath: 'apps/web/docs_tdd/PR-01947/agent/scripts/pr-01947.json',
}).catch((error) => {
  console.error(error)
  process.exit(1)
})
