#!/usr/bin/env node

import { runSyncLarkDocs } from '../../../common/agent-scripts/sync-lark-docs.mjs'

runSyncLarkDocs({
  defaultConfigPath: 'apps/web/docs_tdd/PR-02006/agent/lark-sources.json',
}).catch((error) => {
  console.error(error.message)
  process.exit(1)
})
