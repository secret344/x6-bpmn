import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

const PACKAGE_ROOT = dirname(fileURLToPath(import.meta.url))
const WORKSPACE_ROOT = resolve(PACKAGE_ROOT, '../../..')

const X6_ALIAS_ENTRIES = {
  '@antv/x6': 'node_modules/@antv/x6/es/index.js',
  '@antv/x6-plugin-selection': 'node_modules/@antv/x6/es/plugin/selection/index.js',
  '@antv/x6-plugin-transform': 'node_modules/@antv/x6/es/plugin/transform/index.js',
  '@antv/x6-plugin-snapline': 'node_modules/@antv/x6/es/plugin/snapline/index.js',
  '@antv/x6-plugin-history': 'node_modules/@antv/x6/es/plugin/history/index.js',
  '@antv/x6-plugin-keyboard': 'node_modules/@antv/x6/es/plugin/keyboard/index.js',
  '@antv/x6-plugin-clipboard': 'node_modules/@antv/x6/es/plugin/clipboard/index.js',
  '@antv/x6-plugin-minimap': 'node_modules/@antv/x6/es/plugin/minimap/index.js',
  '@antv/x6-vue-shape': 'node_modules/@antv/x6-vue-shape/es/index.js',
  '@x6-bpmn2/plugin': 'packages/x6-plugin-bpmn/src/index.ts',
} as const

function createX6Aliases() {
  return Object.fromEntries(
    Object.entries(X6_ALIAS_ENTRIES).map(([name, relativePath]) => [
      name,
      resolve(WORKSPACE_ROOT, relativePath),
    ]),
  )
}

export function createDemoViteConfig(port: number) {
  return defineConfig({
    plugins: [vue()],
    optimizeDeps: {
      exclude: ['@x6-bpmn2/plugin'],
    },
    resolve: {
      alias: createX6Aliases(),
    },
    server: {
      port,
      open: process.env.PLAYWRIGHT !== 'true',
    },
  })
}
