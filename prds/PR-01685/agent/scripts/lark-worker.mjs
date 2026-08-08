#!/usr/bin/env node

import { runLarkWorker } from '../../../../common/engine/agent-scripts/lark-worker.mjs'

runLarkWorker({
  projectId: 'PR-01685',
  projectName: 'Campaign 活动落地页',
  projectDocs: [
    'apps/web/docs_tdd/prds/PR-01685/agent/lark-integration.md',
    'apps/web/docs_tdd/prds/PR-01685/engineering/development-rules.md',
  ],
  publicHealthUrl: 'https://ears-labs-pasta-concerns.trycloudflare.com/lark/health',
  webHealthUrl: 'http://localhost:4001/zh-CN/campaign/PR-01685',
}).catch((error) => {
  console.error(error)
  process.exit(1)
})
