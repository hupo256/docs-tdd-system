#!/usr/bin/env node

import { runLarkWorker } from '../../../../common/engine/agent-scripts/lark-worker.mjs'

runLarkWorker({
  projectId: 'PR-01973',
  projectName: 'TradFi 落地页',
  projectDocs: [
    'apps/web/docs_tdd/prds/PR-01973/agent/lark-integration.md',
  ],
}).catch((error) => {
  console.error(error)
  process.exit(1)
})
