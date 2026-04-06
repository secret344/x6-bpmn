import { expect, type Page, type TestInfo } from '@playwright/test'
import { existsSync, mkdirSync } from 'node:fs'
import path from 'node:path'

export const BROWSER_SCREENSHOT_ARTIFACT_ROOT = path.resolve(__dirname, 'artifacts', 'screenshots')
const SNAPSHOT_MAX_DIFF_PIXELS = 20

function slugify(value: string): string {
  const ascii = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  if (ascii) return ascii

  let hash = 0
  for (const char of value) {
    hash = (hash * 33 + char.charCodeAt(0)) >>> 0
  }

  return `s-${hash.toString(36)}`
}

function sanitizePathSegment(value: string): string {
  const normalized = value
    .normalize('NFKC')
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, ' ')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')

  return normalized || slugify(value)
}

function getArtifactCaseDirectory(testInfo: TestInfo): { absoluteDir: string; snapshotPathSegments: string[] } {
  const snapshotPathSegments = testInfo.titlePath.slice(1).map(sanitizePathSegment)
  const absoluteDir = path.join(BROWSER_SCREENSHOT_ARTIFACT_ROOT, ...snapshotPathSegments)
  const relativeDir = path.relative(BROWSER_SCREENSHOT_ARTIFACT_ROOT, absoluteDir)

  if (relativeDir.startsWith('..') || path.isAbsolute(relativeDir)) {
    throw new Error('浏览器截图产物目录超出允许范围')
  }

  if (!existsSync(absoluteDir)) {
    mkdirSync(absoluteDir, { recursive: true })
  }

  return {
    absoluteDir,
    snapshotPathSegments,
  }
}

export function createBrowserScreenshotTaker(testInfo: TestInfo) {
  let stepIndex = 1
  const { absoluteDir, snapshotPathSegments } = getArtifactCaseDirectory(testInfo)

  return async (page: Page, name: string): Promise<void> => {
    const fileName = `${String(stepIndex).padStart(2, '0')}-${sanitizePathSegment(name)}.png`
    const artifactFilePath = path.join(absoluteDir, fileName)
    stepIndex += 1

    const image = await page.screenshot({
      path: artifactFilePath,
      fullPage: true,
      animations: 'disabled',
      caret: 'hide',
    })

    expect(image).toMatchSnapshot([...snapshotPathSegments, fileName], {
      maxDiffPixels: SNAPSHOT_MAX_DIFF_PIXELS,
    })
  }
}