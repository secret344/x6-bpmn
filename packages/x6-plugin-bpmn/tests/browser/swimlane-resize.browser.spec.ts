/**
 * 泳道 resize 浏览器视觉回归测试
 *
 * 聚焦 Lane 四周拖拽的真实业务语义：
 * 1. 左右边拖拽本质上修改 Participant 宽度；
 * 2. 顶底边在边界位置时本质上修改 Participant 高度；
 * 3. 每个方向同时验证向内与向外拖拽；
 * 4. 拖拽过程采用持续真实拖拽，总时长约 2 秒，并在中途截图，最后再记录终态截图。
 */

import { expect, test, type Page } from '@playwright/test'

import { createBrowserScreenshotTaker } from './screenshot-taker'
import {
  assertMultiLaneIntegrity,
  clickNode,
  createMultiLaneScenario,
  getNodeLocator,
  getSelectedCellIds,
  resizeNodeByEdgeOverTime,
  type MultiLaneScenarioIds,
  type ResizeEdge,
  type NodeSnapshot,
  waitForHarness,
} from './helpers'

type ResizeCase = {
  title: string
  edge: ResizeEdge
  targetId: (scenario: MultiLaneScenarioIds) => string
  delta: { x: number; y: number }
  selectOffset: { x: number; y: number }
  expectedFailureReason?: string
  expectGeometry: (before: IntegritySnapshot, after: IntegritySnapshot) => void
}

type IntegritySnapshot = {
  pool: NodeSnapshot
  lane1: NodeSnapshot
  lane2: NodeSnapshot
  task: NodeSnapshot
}

async function captureResizeProcess(
  page: Page,
  takeScreenshot: ReturnType<typeof createBrowserScreenshotTaker>,
  scenario: MultiLaneScenarioIds,
  resizeCase: ResizeCase,
): Promise<IntegritySnapshot> {
  const checkpointSteps = new Set([12, 20])

  await resizeNodeByEdgeOverTime(
    page,
    resizeCase.targetId(scenario),
    resizeCase.edge,
    resizeCase.delta,
    {
      selectOffset: resizeCase.selectOffset,
      durationMs: 2000,
      steps: 24,
      onStep: async ({ step }) => {
        if (!checkpointSteps.has(step)) {
          return
        }

        const checkpointIndex = step === 12 ? 1 : 2
        await takeScreenshot(page, `${resizeCase.title}-过程-${checkpointIndex}`)
      },
    },
  )

  await takeScreenshot(page, `${resizeCase.title}-终态`)

  return assertMultiLaneIntegrity(page, scenario)
}

const resizeCases: ResizeCase[] = [
  {
    title: '左边向外拖拽应扩大 Participant 宽度',
    edge: 'left',
    targetId: (scenario) => scenario.lane1Id,
    delta: { x: -60, y: 0 },
    selectOffset: { x: 140, y: 80 },
    expectGeometry: (before, after) => {
      expect(after.pool.x).toBeLessThan(before.pool.x)
      expect(after.pool.width).toBeGreaterThan(before.pool.width)
      expect(after.lane1.width).toBeGreaterThan(before.lane1.width)
      expect(after.lane2.width).toBeGreaterThan(before.lane2.width)
    },
  },
  {
    title: '左边向内拖拽应缩小 Participant 宽度',
    edge: 'left',
    targetId: (scenario) => scenario.lane1Id,
    delta: { x: 50, y: 0 },
    selectOffset: { x: 140, y: 80 },
    expectGeometry: (before, after) => {
      expect(after.pool.x).toBeGreaterThan(before.pool.x)
      expect(after.pool.width).toBeLessThan(before.pool.width)
      expect(after.lane1.width).toBeLessThan(before.lane1.width)
      expect(after.lane2.width).toBeLessThan(before.lane2.width)
    },
  },
  {
    title: '右边向外拖拽应扩大 Participant 宽度',
    edge: 'right',
    targetId: (scenario) => scenario.lane1Id,
    delta: { x: 60, y: 0 },
    selectOffset: { x: 470, y: 80 },
    expectGeometry: (before, after) => {
      expect(after.pool.x).toBeCloseTo(before.pool.x, 0)
      expect(after.pool.width).toBeGreaterThan(before.pool.width)
      expect(after.lane1.width).toBeGreaterThan(before.lane1.width)
      expect(after.lane2.width).toBeGreaterThan(before.lane2.width)
    },
  },
  {
    title: '右边向内拖拽应缩小 Participant 宽度',
    edge: 'right',
    targetId: (scenario) => scenario.lane1Id,
    delta: { x: -50, y: 0 },
    selectOffset: { x: 470, y: 80 },
    expectGeometry: (before, after) => {
      expect(after.pool.x).toBeCloseTo(before.pool.x, 0)
      expect(after.pool.width).toBeLessThan(before.pool.width)
      expect(after.lane1.width).toBeLessThan(before.lane1.width)
      expect(after.lane2.width).toBeLessThan(before.lane2.width)
    },
  },
  {
    title: '上边向外拖拽应扩大 Participant 高度',
    edge: 'top',
    targetId: (scenario) => scenario.lane1Id,
    delta: { x: 0, y: -50 },
    selectOffset: { x: 450, y: 12 },
    expectGeometry: (before, after) => {
      expect(after.pool.y).toBeLessThan(before.pool.y)
      expect(after.pool.height).toBeGreaterThan(before.pool.height)
      expect(after.lane1.y).toBeCloseTo(after.pool.y, 0)
      expect(after.lane1.height).toBeGreaterThan(before.lane1.height)
    },
  },
  {
    title: '上边向内拖拽应缩小 Participant 高度',
    edge: 'top',
    targetId: (scenario) => scenario.lane1Id,
    delta: { x: 0, y: 35 },
    selectOffset: { x: 450, y: 12 },
    expectGeometry: (before, after) => {
      expect(after.pool.y).toBeGreaterThan(before.pool.y)
      expect(after.pool.height).toBeLessThan(before.pool.height)
      expect(after.lane1.y).toBeCloseTo(after.pool.y, 0)
      expect(after.lane1.height).toBeLessThan(before.lane1.height)
    },
  },
  {
    title: '上方 Lane 下边向外拖拽应只重新分配相邻 Lane 高度',
    edge: 'bottom',
    targetId: (scenario) => scenario.lane1Id,
    delta: { x: 0, y: 40 },
    selectOffset: { x: 450, y: 150 },
    expectGeometry: (before, after) => {
      expect(after.pool.y).toBeCloseTo(before.pool.y, 0)
      expect(after.pool.height).toBeCloseTo(before.pool.height, 0)
      expect(after.lane1.height).toBeGreaterThan(before.lane1.height)
      expect(after.lane2.height).toBeLessThan(before.lane2.height)
      expect(after.lane2.y).toBeCloseTo(after.lane1.y + after.lane1.height, 0)
    },
  },
  {
    title: '上方 Lane 下边向内拖拽应只重新分配相邻 Lane 高度',
    edge: 'bottom',
    targetId: (scenario) => scenario.lane1Id,
    delta: { x: 0, y: -35 },
    selectOffset: { x: 450, y: 150 },
    expectGeometry: (before, after) => {
      expect(after.pool.y).toBeCloseTo(before.pool.y, 0)
      expect(after.pool.height).toBeCloseTo(before.pool.height, 0)
      expect(after.lane1.height).toBeLessThan(before.lane1.height)
      expect(after.lane2.height).toBeGreaterThan(before.lane2.height)
      expect(after.lane2.y).toBeCloseTo(after.lane1.y + after.lane1.height, 0)
    },
  },
  {
    title: '下边向外拖拽应扩大 Participant 高度',
    edge: 'bottom',
    targetId: (scenario) => scenario.lane2Id,
    delta: { x: 0, y: 60 },
    selectOffset: { x: 450, y: 190 },
    expectGeometry: (before, after) => {
      expect(after.pool.height).toBeGreaterThan(before.pool.height)
      expect(after.lane2.height).toBeGreaterThan(before.lane2.height)
      expect(after.lane2.y + after.lane2.height).toBeCloseTo(after.pool.y + after.pool.height, 0)
    },
  },
  {
    title: '下边向内拖拽应缩小 Participant 高度',
    edge: 'bottom',
    targetId: (scenario) => scenario.lane2Id,
    delta: { x: 0, y: -35 },
    selectOffset: { x: 450, y: 190 },
    expectGeometry: (before, after) => {
      expect(after.pool.height).toBeLessThan(before.pool.height)
      expect(after.lane2.height).toBeLessThan(before.lane2.height)
      expect(after.lane2.y + after.lane2.height).toBeCloseTo(after.pool.y + after.pool.height, 0)
    },
  },
  {
    title: 'Participant 左边向外拖拽应扩大宽度',
    edge: 'left',
    targetId: (scenario) => scenario.poolId,
    delta: { x: -60, y: 0 },
    selectOffset: { x: 12, y: 120 },
    expectGeometry: (before, after) => {
      expect(after.pool.x).toBeLessThan(before.pool.x)
      expect(after.pool.width).toBeGreaterThan(before.pool.width)
      expect(after.lane1.width).toBeGreaterThan(before.lane1.width)
      expect(after.lane2.width).toBeGreaterThan(before.lane2.width)
      expect(after.lane1.x).toBeCloseTo(after.pool.x + 30, 0)
      expect(after.lane2.x).toBeCloseTo(after.pool.x + 30, 0)
    },
  },
  {
    title: 'Participant 左边向内拖拽应缩小宽度',
    edge: 'left',
    targetId: (scenario) => scenario.poolId,
    delta: { x: 50, y: 0 },
    selectOffset: { x: 12, y: 120 },
    expectGeometry: (before, after) => {
      expect(after.pool.x).toBeGreaterThan(before.pool.x)
      expect(after.pool.width).toBeLessThan(before.pool.width)
      expect(after.lane1.width).toBeLessThan(before.lane1.width)
      expect(after.lane2.width).toBeLessThan(before.lane2.width)
      expect(after.lane1.x).toBeCloseTo(after.pool.x + 30, 0)
      expect(after.lane2.x).toBeCloseTo(after.pool.x + 30, 0)
    },
  },
  {
    title: 'Participant 右边向外拖拽应扩大宽度',
    edge: 'right',
    targetId: (scenario) => scenario.poolId,
    delta: { x: 60, y: 0 },
    selectOffset: { x: 888, y: 120 },
    expectGeometry: (before, after) => {
      expect(after.pool.x).toBeCloseTo(before.pool.x, 0)
      expect(after.pool.width).toBeGreaterThan(before.pool.width)
      expect(after.lane1.width).toBeGreaterThan(before.lane1.width)
      expect(after.lane2.width).toBeGreaterThan(before.lane2.width)
    },
  },
  {
    title: 'Participant 右边向内拖拽应缩小宽度',
    edge: 'right',
    targetId: (scenario) => scenario.poolId,
    delta: { x: -50, y: 0 },
    selectOffset: { x: 888, y: 120 },
    expectGeometry: (before, after) => {
      expect(after.pool.x).toBeCloseTo(before.pool.x, 0)
      expect(after.pool.width).toBeLessThan(before.pool.width)
      expect(after.lane1.width).toBeLessThan(before.lane1.width)
      expect(after.lane2.width).toBeLessThan(before.lane2.width)
    },
  },
  {
    title: 'Participant 上边向外拖拽应扩大高度',
    edge: 'top',
    targetId: (scenario) => scenario.poolId,
    delta: { x: 0, y: -50 },
    selectOffset: { x: 450, y: 12 },
    expectGeometry: (before, after) => {
      expect(after.pool.y).toBeLessThan(before.pool.y)
      expect(after.pool.height).toBeGreaterThan(before.pool.height)
      expect(after.lane1.y).toBeCloseTo(after.pool.y, 0)
      expect(after.lane2.y + after.lane2.height).toBeCloseTo(after.pool.y + after.pool.height, 0)
      expect(after.lane1.height).toBeGreaterThan(before.lane1.height)
    },
  },
  {
    title: 'Participant 上边向内大幅拖拽应钳制最小高度',
    edge: 'top',
    targetId: (scenario) => scenario.poolId,
    delta: { x: 0, y: 220 },
    selectOffset: { x: 450, y: 12 },
    expectGeometry: (before, after) => {
      const beforeBottom = before.pool.y + before.pool.height
      const afterBottom = after.pool.y + after.pool.height
      expect(after.pool.height).toBeLessThan(before.pool.height)
      expect(after.pool.height).toBeGreaterThanOrEqual(260)
      expect(after.pool.height).toBeLessThanOrEqual(before.pool.height)
      expect(afterBottom).toBeCloseTo(beforeBottom, 0)
      expect(after.lane1.height).toBeGreaterThanOrEqual(60)
      expect(after.lane2.height).toBeCloseTo(before.lane2.height, 0)
    },
  },
  {
    title: 'Participant 下边向外拖拽应扩大高度',
    edge: 'bottom',
    targetId: (scenario) => scenario.poolId,
    delta: { x: 0, y: 60 },
    selectOffset: { x: 450, y: 388 },
    expectGeometry: (before, after) => {
      expect(after.pool.height).toBeGreaterThan(before.pool.height)
      expect(after.lane2.y + after.lane2.height).toBeCloseTo(after.pool.y + after.pool.height, 0)
      expect(after.lane2.height).toBeGreaterThan(before.lane2.height)
    },
  },
  {
    title: 'Participant 下边向内拖拽应缩小高度',
    edge: 'bottom',
    targetId: (scenario) => scenario.poolId,
    delta: { x: 0, y: -35 },
    selectOffset: { x: 450, y: 388 },
    expectGeometry: (before, after) => {
      expect(after.pool.height).toBeLessThan(before.pool.height)
      expect(after.lane2.y + after.lane2.height).toBeCloseTo(after.pool.y + after.pool.height, 0)
      expect(after.lane2.height).toBeLessThan(before.lane2.height)
    },
  },
]

test.describe('泳道 resize 浏览器视觉回归', () => {
  test('拖拽 Pool 改变大小后点击 Lane 不应产生视觉错位', async ({ page }, testInfo) => {
    await waitForHarness(page)
    const takeScreenshot = createBrowserScreenshotTaker(testInfo)

    const scenario = await createMultiLaneScenario(page)
    await takeScreenshot(page, '拖拽 Pool 改变大小后点击 Lane 不应产生视觉错位-初始')

    await resizeNodeByEdgeOverTime(
      page,
      scenario.poolId,
      'top',
      { x: 0, y: -50 },
      {
        selectOffset: { x: 450, y: 12 },
        durationMs: 2000,
        steps: 24,
      },
    )

    const beforeClick = await assertMultiLaneIntegrity(page, scenario)
    const laneBeforeClickBox = await getNodeLocator(page, scenario.lane1Id).boundingBox()
    await takeScreenshot(page, '拖拽 Pool 改变大小后点击 Lane 不应产生视觉错位-点击前')

    await clickNode(page, scenario.lane1Id, { x: 140, y: 80 })

    const afterClick = await assertMultiLaneIntegrity(page, scenario)
    const laneAfterClickBox = await getNodeLocator(page, scenario.lane1Id).boundingBox()
    await takeScreenshot(page, '拖拽 Pool 改变大小后点击 Lane 不应产生视觉错位-点击后')

    expect(afterClick.pool).toEqual(beforeClick.pool)
    expect(afterClick.lane1).toEqual(beforeClick.lane1)
    expect(afterClick.lane2).toEqual(beforeClick.lane2)
    expect(afterClick.task).toEqual(beforeClick.task)
    expect(laneBeforeClickBox).not.toBeNull()
    expect(laneAfterClickBox).not.toBeNull()
    expect(laneAfterClickBox?.x).toBeCloseTo(laneBeforeClickBox?.x ?? 0, 0)
    expect(laneAfterClickBox?.y).toBeCloseTo(laneBeforeClickBox?.y ?? 0, 0)
    expect(laneAfterClickBox?.width).toBeCloseTo(laneBeforeClickBox?.width ?? 0, 0)
    expect(laneAfterClickBox?.height).toBeCloseTo(laneBeforeClickBox?.height ?? 0, 0)
  })

  test('拖拽 Pool 改变大小后从 Pool 直接切换点击下方 Lane 不应产生视觉错位', async ({ page }, testInfo) => {
    await waitForHarness(page)
    const takeScreenshot = createBrowserScreenshotTaker(testInfo)

    const scenario = await createMultiLaneScenario(page)

    await resizeNodeByEdgeOverTime(
      page,
      scenario.poolId,
      'top',
      { x: 0, y: -50 },
      {
        selectOffset: { x: 450, y: 12 },
        durationMs: 2000,
        steps: 24,
      },
    )

    const selectedAfterResize = await getSelectedCellIds(page)
    expect(selectedAfterResize).toContain(scenario.poolId)

    const laneBeforeClick = await assertMultiLaneIntegrity(page, scenario)
    const lane2BeforeClickBox = await getNodeLocator(page, scenario.lane2Id).boundingBox()
    await takeScreenshot(page, '拖拽 Pool 改变大小后从 Pool 直接切换点击下方 Lane 不应产生视觉错位-点击前')

    const lane2Locator = getNodeLocator(page, scenario.lane2Id)
    await lane2Locator.click({ position: { x: 140, y: 80 }, force: true })

    await expect.poll(() => getSelectedCellIds(page)).toContain(scenario.lane2Id)

    const laneAfterClick = await assertMultiLaneIntegrity(page, scenario)
    const lane2AfterClickBox = await getNodeLocator(page, scenario.lane2Id).boundingBox()
    await takeScreenshot(page, '拖拽 Pool 改变大小后从 Pool 直接切换点击下方 Lane 不应产生视觉错位-点击后')

    expect(laneAfterClick.pool).toEqual(laneBeforeClick.pool)
    expect(laneAfterClick.lane1).toEqual(laneBeforeClick.lane1)
    expect(laneAfterClick.lane2).toEqual(laneBeforeClick.lane2)
    expect(laneAfterClick.task).toEqual(laneBeforeClick.task)
    expect(lane2BeforeClickBox).not.toBeNull()
    expect(lane2AfterClickBox).not.toBeNull()
    expect(lane2AfterClickBox?.x).toBeCloseTo(lane2BeforeClickBox?.x ?? 0, 0)
    expect(lane2AfterClickBox?.y).toBeCloseTo(lane2BeforeClickBox?.y ?? 0, 0)
    expect(lane2AfterClickBox?.width).toBeCloseTo(lane2BeforeClickBox?.width ?? 0, 0)
    expect(lane2AfterClickBox?.height).toBeCloseTo(lane2BeforeClickBox?.height ?? 0, 0)
  })

  for (const resizeCase of resizeCases) {
    test(resizeCase.title, async ({ page }, testInfo) => {
      test.fail(Boolean(resizeCase.expectedFailureReason), resizeCase.expectedFailureReason)

      await waitForHarness(page)
      const takeScreenshot = createBrowserScreenshotTaker(testInfo)

      const scenario = await createMultiLaneScenario(page)
      const before = await assertMultiLaneIntegrity(page, scenario)
      await takeScreenshot(page, `${resizeCase.title}-初始`)

      const after = await captureResizeProcess(page, takeScreenshot, scenario, resizeCase)

      resizeCase.expectGeometry(before, after)
    })
  }
})
