import { defineConfig } from '@playwright/test'
import { resolve } from 'node:path'

const viteBin = resolve(__dirname, '../../node_modules/.bin/vite')
const playwrightOutputDir = resolve(__dirname, '../../node_modules/.cache/smartengine-demo-playwright')
const appPort = 3204

export default defineConfig({
  testDir: './tests/browser',
  timeout: 60_000,
  fullyParallel: false,
  use: {
    baseURL: `http://127.0.0.1:${appPort}`,
    headless: true,
    trace: 'retain-on-failure',
    viewport: { width: 1680, height: 960 },
  },
  projects: [
    {
      name: '',
      outputDir: playwrightOutputDir,
    },
  ],
  webServer: {
    command: `cd ${__dirname} && ${viteBin} --host 127.0.0.1 --port ${appPort} --strictPort`,
    url: `http://127.0.0.1:${appPort}`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
})