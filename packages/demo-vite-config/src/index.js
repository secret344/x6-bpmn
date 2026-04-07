import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

const PACKAGE_ROOT = dirname(fileURLToPath(import.meta.url))
const WORKSPACE_ROOT = resolve(PACKAGE_ROOT, '../../..')

export function createDemoViteConfig(port) {
  return defineConfig({
    plugins: [vue()],
    optimizeDeps: {
      exclude: ['@x6-bpmn2/plugin'],
    },
    resolve: {
      conditions: ['source'],
    },
    server: {
      port,
      open: process.env.PLAYWRIGHT !== 'true',
    },
  })
}