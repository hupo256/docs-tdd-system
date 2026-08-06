#!/usr/bin/env node

import { runLarkGateway } from '../../../common/agent-scripts/lark-gateway.mjs'

runLarkGateway({
  configPath: 'apps/web/docs_tdd/PR-01947/agent/scripts/lark-bot.local.json',
}).catch((error) => {
  console.error(error)
  process.exit(1)
})
