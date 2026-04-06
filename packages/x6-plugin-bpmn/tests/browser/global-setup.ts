import { mkdirSync, rmSync } from 'node:fs'
import path from 'node:path'

import { BROWSER_SCREENSHOT_ARTIFACT_ROOT } from './screenshot-taker'

async function globalSetup(): Promise<void> {
  const artifactsDir = path.resolve(__dirname, 'artifacts')
  rmSync(artifactsDir, { recursive: true, force: true })
  mkdirSync(BROWSER_SCREENSHOT_ARTIFACT_ROOT, { recursive: true })
}

export default globalSetup