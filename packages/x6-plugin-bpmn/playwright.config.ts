import { defineConfig } from '@playwright/test'
import { resolve } from 'node:path'

const viteBin = resolve(__dirname, '../../node_modules/.bin/vite')

export default defineConfig({
  testDir: './tests/browser',
  timeout: 60_000,
  fullyParallel: false,
  outputDir: './tests/browser/artifacts/test-results',
  globalSetup: './tests/browser/global-setup.ts',
  use: {
    baseURL: 'http://127.0.0.1:3101',
    headless: true,
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `PLAYWRIGHT=true ${viteBin} --config vite.browser.config.ts --host 127.0.0.1 --port 3101 --strictPort`,
    url: 'http://127.0.0.1:3101',
    reuseExistingServer: true,
    timeout: 120_000,
  },
})