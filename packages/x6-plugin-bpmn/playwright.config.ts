import { defineConfig } from '@playwright/test'
import { resolve } from 'node:path'

const viteBin = resolve(__dirname, '../../node_modules/.bin/vite')
const playwrightOutputDir = resolve(__dirname, '../../node_modules/.cache/x6-plugin-bpmn-playwright')

export default defineConfig({
  testDir: './tests/browser',
  timeout: 60_000,
  fullyParallel: false,
  globalSetup: './tests/browser/global-setup.ts',
  use: {
    baseURL: 'http://127.0.0.1:3101',
    headless: true,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: '',
      outputDir: playwrightOutputDir,
    },
  ],
  webServer: {
    command: `PLAYWRIGHT=true ${viteBin} --config vite.browser.config.ts --host 127.0.0.1 --port 3101 --strictPort`,
    url: 'http://127.0.0.1:3101',
    reuseExistingServer: true,
    timeout: 120_000,
  },
})