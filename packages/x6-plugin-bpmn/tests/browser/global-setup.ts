import { mkdirSync } from 'node:fs'

import { BROWSER_SCREENSHOT_ARTIFACT_ROOT } from './screenshot-taker'

async function globalSetup(): Promise<void> {
  mkdirSync(BROWSER_SCREENSHOT_ARTIFACT_ROOT, { recursive: true })
}

export default globalSetup