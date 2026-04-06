import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/browser',
  timeout: 60_000,
  fullyParallel: false,
  use: {
    baseURL: 'http://127.0.0.1:3101',
    headless: true,
  },
  webServer: {
    command: 'PLAYWRIGHT=true ../../node_modules/.bin/vite --config vite.browser.config.ts --host 127.0.0.1 --port 3101 --strictPort',
    url: 'http://127.0.0.1:3101',
    reuseExistingServer: true,
    timeout: 120_000,
  },
})