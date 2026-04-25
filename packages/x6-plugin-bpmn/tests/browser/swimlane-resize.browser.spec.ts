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
  addLaneToPoolInBrowser,
  assertMultiLaneIntegrity,
  clickNode,
  clickNodeWithoutClearingSelection,
  createMultiLaneScenario,
  createPoolLaneTaskBoundaryScenario,
  dragNodeBy,
  expectInsideRect,
  getNodeLocator,
  getResizePreviewLocator,
  getNodeSnapshot,
  getPoolLaneSnapshots,
  getSelectedCellIds,
  removeNodeInBrowser,
  resizeNodeByEdgeOverTime,
  resizeNodeByHandleOverTime,
  setViewportTransform,
  type AddedLaneScenarioIds,
  type MultiLaneScenarioIds,
  type ResizeEdge,
  type ResizeHandlePosition,
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

type LaneMatrixSnapshot = {
  pool: NodeSnapshot
  lanes: NodeSnapshot[]
  laneMap: Record<string, NodeSnapshot>
  nodes: Record<string, NodeSnapshot>
}

type AddedLaneMatrixScenario = MultiLaneScenarioIds & AddedLaneScenarioIds

type DeletedLaneMatrixScenario = MultiLaneScenarioIds & {
  remainingLaneId: string
}

type HandleResizeCase<TScenario> = {
  title: string
  position: ResizeHandlePosition
  delta: { x: number; y: number }
  targetId: (scenario: TScenario) => string
  selectOffset: { x: number; y: number }
}

const HANDLE_CASES: Array<{ position: ResizeHandlePosition; delta: { x: number; y: number } }> = [
  { position: 'left', delta: { x: -60, y: 0 } },
  { position: 'right', delta: { x: 60, y: 0 } },
  { position: 'top', delta: { x: 0, y: -40 } },
  { position: 'bottom', delta: { x: 0, y: 40 } },
  { position: 'top-left', delta: { x: -60, y: -40 } },
  { position: 'top-right', delta: { x: 60, y: -40 } },
  { position: 'bottom-left', delta: { x: -60, y: 40 } },
  { position: 'bottom-right', delta: { x: 60, y: 40 } },
]

async function getLaneMatrixSnapshot(
  page: Page,
  poolId: string,
  trackedNodeIds: string[] = [],
): Promise<LaneMatrixSnapshot> {
  const pool = await getNodeSnapshot(page, poolId)
  const lanes = (await getPoolLaneSnapshots(page, poolId))
    .slice()
    .sort((left, right) => left.y - right.y)

  const laneMap = Object.fromEntries(lanes.map((lane) => [lane.id, lane]))
  const nodes = Object.fromEntries(
    await Promise.all(trackedNodeIds.map(async (id) => [id, await getNodeSnapshot(page, id)] as const)),
  )

  return { pool, lanes, laneMap, nodes }
}

function expectLaneStackFillsPool(snapshot: LaneMatrixSnapshot): void {
  const { pool, lanes, laneMap, nodes } = snapshot

  expect(lanes.length).toBeGreaterThan(0)

  for (let index = 0; index < lanes.length; index += 1) {
    const lane = lanes[index]
    expect(lane.parentId).toBe(pool.id)
    expect(lane.x).toBeCloseTo(pool.x + 30, 0)
    expect(lane.width).toBeCloseTo(pool.width - 30, 0)

    if (index === 0) {
      expect(lane.y).toBeCloseTo(pool.y, 0)
    } else {
      const previousLane = lanes[index - 1]
      expect(lane.y).toBeCloseTo(previousLane.y + previousLane.height, 0)
    }
  }

  const lastLane = lanes[lanes.length - 1]
  expect(lastLane.y + lastLane.height).toBeCloseTo(pool.y + pool.height, 0)

  for (const node of Object.values(nodes)) {
    const parentLane = laneMap[node.parentId ?? '']
    if (parentLane) {
      expectInsideRect(node, {
        x: pool.x + 30,
        y: pool.y,
        width: pool.width - 30,
        height: pool.height,
      }, 12)
    }
  }
}

function expectPoolHandleGeometry(
  before: LaneMatrixSnapshot,
  after: LaneMatrixSnapshot,
  position: ResizeHandlePosition,
  delta: { x: number; y: number },
): void {
  if (position.includes('left')) {
    if (delta.x < 0) {
      expect(after.pool.x).toBeLessThan(before.pool.x)
      expect(after.pool.width).toBeGreaterThan(before.pool.width)
    } else {
      expect(after.pool.x).toBeGreaterThan(before.pool.x)
      expect(after.pool.width).toBeLessThan(before.pool.width)
    }
  }

  if (position.includes('right')) {
    if (delta.x > 0) {
      expect(after.pool.width).toBeGreaterThan(before.pool.width)
    } else {
      expect(after.pool.width).toBeLessThan(before.pool.width)
    }
  }

  if (position.includes('top')) {
    if (delta.y < 0) {
      expect(after.pool.y).toBeLessThan(before.pool.y)
      expect(after.pool.height).toBeGreaterThan(before.pool.height)
    } else {
      expect(after.pool.y).toBeGreaterThan(before.pool.y)
      expect(after.pool.height).toBeLessThan(before.pool.height)
    }
  }

  if (position.includes('bottom')) {
    if (delta.y > 0) {
      expect(after.pool.height).toBeGreaterThan(before.pool.height)
    } else {
      expect(after.pool.height).toBeLessThan(before.pool.height)
    }
  }
}

function expectLaneHandleGeometry(
  before: LaneMatrixSnapshot,
  after: LaneMatrixSnapshot,
  targetLaneId: string,
  position: ResizeHandlePosition,
  delta: { x: number; y: number },
): void {
  const beforeTarget = before.laneMap[targetLaneId]
  const afterTarget = after.laneMap[targetLaneId]
  const targetIndex = before.lanes.findIndex((lane) => lane.id === targetLaneId)

  expect(targetIndex).toBeGreaterThanOrEqual(0)
  expect(afterTarget.parentId).toBe(after.pool.id)

  if (position.includes('left')) {
    expect(after.pool.x).toBeLessThan(before.pool.x)
    expect(after.pool.width).toBeGreaterThan(before.pool.width)
  }

  if (position.includes('right')) {
    expect(after.pool.width).toBeGreaterThan(before.pool.width)
  }

  if (position.includes('top')) {
    if (targetIndex === 0) {
      expect(after.pool.y).toBeLessThan(before.pool.y)
      expect(after.pool.height).toBeGreaterThan(before.pool.height)
      expect(afterTarget.y).toBeCloseTo(after.pool.y, 0)
    } else {
      expect(after.pool.y).toBeCloseTo(before.pool.y, 0)
      expect(after.pool.height).toBeCloseTo(before.pool.height, 0)
      expect(afterTarget.y).toBeLessThan(beforeTarget.y)
      expect(afterTarget.height).toBeGreaterThan(beforeTarget.height)
    }
  }

  if (position.includes('bottom')) {
    if (targetIndex === before.lanes.length - 1) {
      expect(after.pool.height).toBeGreaterThan(before.pool.height)
      expect(afterTarget.y + afterTarget.height).toBeCloseTo(after.pool.y + after.pool.height, 0)
    } else {
      expect(after.pool.y).toBeCloseTo(before.pool.y, 0)
      expect(after.pool.height).toBeCloseTo(before.pool.height, 0)
      expect(afterTarget.height).toBeGreaterThan(beforeTarget.height)
    }
  }

  expect(delta.x).not.toBeNaN()
  expect(delta.y).not.toBeNaN()
}

async function createAddedLaneMatrixScenario(page: Page): Promise<AddedLaneMatrixScenario> {
  const scenario = await createMultiLaneScenario(page)
  const added = await addLaneToPoolInBrowser(page, scenario.poolId)

  expect(added).not.toBeNull()
  await expect.poll(() => getPoolLaneSnapshots(page, scenario.poolId)).toHaveLength(3)

  return {
    ...scenario,
    laneId: added!.laneId,
    addedTaskId: added!.addedTaskId,
  }
}

async function createDeletedLaneMatrixScenario(page: Page): Promise<DeletedLaneMatrixScenario> {
  const scenario = await createMultiLaneScenario(page)

  expect(await removeNodeInBrowser(page, scenario.lane1Id)).toBe(true)
  await expect.poll(() => getPoolLaneSnapshots(page, scenario.poolId)).toHaveLength(1)

  return {
    ...scenario,
    remainingLaneId: scenario.lane2Id,
  }
}

async function resizeByHandleWithSnapshot(
  page: Page,
  takeScreenshot: ReturnType<typeof createBrowserScreenshotTaker>,
  title: string,
  nodeId: string,
  position: ResizeHandlePosition,
  delta: { x: number; y: number },
  selectOffset: { x: number; y: number },
): Promise<void> {
  await resizeNodeByHandleOverTime(page, nodeId, position, delta, {
    selectOffset,
    durationMs: 1200,
    steps: 18,
  })
  await takeScreenshot(page, title)
}

async function resizeByHandleWithPreviewSnapshot(
  page: Page,
  takeScreenshot: ReturnType<typeof createBrowserScreenshotTaker>,
  title: string,
  nodeId: string,
  position: ResizeHandlePosition,
  delta: { x: number; y: number },
  selectOffset: { x: number; y: number },
): Promise<{
  beforeBox: { x: number; y: number; width: number; height: number }
  previewBox: { x: number; y: number; width: number; height: number }
}> {
  await clickNode(page, nodeId, selectOffset)

  const targetLocator = getNodeLocator(page, nodeId)
  const beforeBox = await targetLocator.boundingBox()

  expect(beforeBox).not.toBeNull()

  let previewBox: { x: number; y: number; width: number; height: number } | null = null

  await resizeNodeByHandleOverTime(page, nodeId, position, delta, {
    selectOffset,
    durationMs: 1200,
    steps: 18,
    onStep: async ({ step }) => {
      if (step !== 9) {
        return
      }

      const preview = getResizePreviewLocator(page, nodeId)
      await expect(preview).toBeVisible()
      previewBox = await preview.boundingBox()
      await takeScreenshot(page, `${title}-preview`)
    },
  })

  expect(previewBox).not.toBeNull()
  await takeScreenshot(page, `${title}-终态`)

  return {
    beforeBox: beforeBox!,
    previewBox: previewBox!,
  }
}

const poolCornerCases: Array<HandleResizeCase<MultiLaneScenarioIds>> = HANDLE_CASES
  .filter((handle) => handle.position.includes('-'))
  .map((handle) => ({
    title: `Pool-${handle.position}-拖拽应严格符合-pool-md`,
    position: handle.position,
    delta: handle.delta,
    targetId: (scenario) => scenario.poolId,
    selectOffset: { x: 220, y: 120 },
  }))

const laneCornerCases: Array<HandleResizeCase<MultiLaneScenarioIds>> = [
  { title: 'Lane-top-left-拖拽应同时收敛-Pool-左上边界', position: 'top-left', delta: { x: -60, y: -40 }, targetId: (scenario) => scenario.lane1Id, selectOffset: { x: 250, y: 80 } },
  { title: 'Lane-top-right-拖拽应同时收敛-Pool-上边与右边', position: 'top-right', delta: { x: 260, y: -160 }, targetId: (scenario) => scenario.lane1Id, selectOffset: { x: 250, y: 80 } },
  { title: 'Lane-bottom-left-拖拽应同时收敛-Pool-左边与底边', position: 'bottom-left', delta: { x: -60, y: 40 }, targetId: (scenario) => scenario.lane2Id, selectOffset: { x: 250, y: 80 } },
  { title: 'Lane-bottom-right-拖拽应同时收敛-Pool-右下边界', position: 'bottom-right', delta: { x: 60, y: 40 }, targetId: (scenario) => scenario.lane2Id, selectOffset: { x: 250, y: 80 } },
]

const addedLaneHandleCases: Array<HandleResizeCase<AddedLaneMatrixScenario>> = HANDLE_CASES.map((handle) => ({
  title: `新增-Lane-后-${handle.position}-拖拽应严格符合-pool-md`,
  position: handle.position,
  delta: handle.position.includes('top') ? { x: handle.delta.x, y: -30 } : handle.delta,
  targetId: (scenario) => scenario.laneId,
  selectOffset: { x: 140, y: 60 },
}))

const deletedLaneHandleCases: Array<HandleResizeCase<DeletedLaneMatrixScenario>> = HANDLE_CASES.map((handle) => ({
  title: `删除-Lane-后-${handle.position}-拖拽应严格符合-pool-md`,
  position: handle.position,
  delta: handle.delta,
  targetId: (scenario) => scenario.remainingLaneId,
  selectOffset: { x: 140, y: 80 },
}))

function expectMiddleLaneTopResizeGeometry(
  before: LaneMatrixSnapshot,
  after: LaneMatrixSnapshot,
  laneIds: { top: string; middle: string; bottom: string },
): void {
  const beforeTop = before.laneMap[laneIds.top]
  const beforeMiddle = before.laneMap[laneIds.middle]
  const beforeBottom = before.laneMap[laneIds.bottom]
  const afterTop = after.laneMap[laneIds.top]
  const afterMiddle = after.laneMap[laneIds.middle]
  const afterBottom = after.laneMap[laneIds.bottom]

  expect(afterTop.height).toBeLessThan(beforeTop.height)
  expect(afterMiddle.y).toBeLessThan(beforeMiddle.y)
  expect(afterMiddle.height).toBeGreaterThan(beforeMiddle.height)
  expect(afterBottom.y).toBeCloseTo(beforeBottom.y, 0)
  expect(afterBottom.height).toBeCloseTo(beforeBottom.height, 0)
}

function expectMiddleLaneBottomResizeGeometry(
  before: LaneMatrixSnapshot,
  after: LaneMatrixSnapshot,
  laneIds: { top: string; middle: string; bottom: string },
): void {
  const beforeTop = before.laneMap[laneIds.top]
  const beforeMiddle = before.laneMap[laneIds.middle]
  const beforeBottom = before.laneMap[laneIds.bottom]
  const afterTop = after.laneMap[laneIds.top]
  const afterMiddle = after.laneMap[laneIds.middle]
  const afterBottom = after.laneMap[laneIds.bottom]

  expect(afterTop.y).toBeCloseTo(beforeTop.y, 0)
  expect(afterTop.height).toBeCloseTo(beforeTop.height, 0)
  expect(afterMiddle.height).toBeGreaterThan(beforeMiddle.height)
  expect(afterBottom.y).toBeGreaterThan(beforeBottom.y)
  expect(afterBottom.height).toBeLessThan(beforeBottom.height)
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
      expect(Math.abs(afterBottom - beforeBottom)).toBeLessThanOrEqual(10)
      expect(after.lane1.height).toBeGreaterThanOrEqual(60)
      expect(after.lane2.height).toBeCloseTo(before.lane2.height + (afterBottom - beforeBottom), 0)
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

    await clickNodeWithoutClearingSelection(page, scenario.lane2Id, { x: 140, y: 80 })

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

  test('删除第一个 Lane 后，剩余 Lane 顶到 Pool 顶部且 top-resize 仍受当前内容约束', async ({ page }, testInfo) => {
    await waitForHarness(page)
    const takeScreenshot = createBrowserScreenshotTaker(testInfo)

    const scenario = await createMultiLaneScenario(page)
    const poolBeforeDelete = await getNodeSnapshot(page, scenario.poolId)
    await takeScreenshot(page, '删除第一条-Lane-前的双-Lane-布局')

    expect(await removeNodeInBrowser(page, scenario.lane1Id)).toBe(true)

    const lanesAfterDelete = await expect.poll(async () => getPoolLaneSnapshots(page, scenario.poolId))
      .toHaveLength(1)
    void lanesAfterDelete

    const remainingLaneAfterDelete = (await getPoolLaneSnapshots(page, scenario.poolId))[0]
    const poolAfterDelete = await getNodeSnapshot(page, scenario.poolId)
    const startAfterDelete = await getNodeSnapshot(page, scenario.startId)
    const taskAfterDelete = await getNodeSnapshot(page, scenario.taskId)
    const serviceTaskAfterDelete = await getNodeSnapshot(page, scenario.serviceTaskId)
    const endAfterDelete = await getNodeSnapshot(page, scenario.endId)
    const task2AfterDelete = await getNodeSnapshot(page, scenario.task2Id)
    const gatewayAfterDelete = await getNodeSnapshot(page, scenario.gatewayId)
    const sendTaskAfterDelete = await getNodeSnapshot(page, scenario.sendTaskId)
    await takeScreenshot(page, '删除第一条-Lane-后剩余-Lane-自动顶到顶部')

    expect(remainingLaneAfterDelete.id).toBe(scenario.lane2Id)
    expect(remainingLaneAfterDelete.parentId).toBe(poolAfterDelete.id)
    expect(remainingLaneAfterDelete.x).toBeCloseTo(poolAfterDelete.x + 30, 0)
    expect(remainingLaneAfterDelete.y).toBeCloseTo(poolAfterDelete.y, 0)
    expect(remainingLaneAfterDelete.width).toBeCloseTo(poolAfterDelete.width - 30, 0)
    expect(remainingLaneAfterDelete.height).toBeCloseTo(poolAfterDelete.height, 0)
    expect(startAfterDelete.parentId).toBe(remainingLaneAfterDelete.id)
    expect(taskAfterDelete.parentId).toBe(remainingLaneAfterDelete.id)
    expect(serviceTaskAfterDelete.parentId).toBe(remainingLaneAfterDelete.id)
    expect(endAfterDelete.parentId).toBe(remainingLaneAfterDelete.id)
    expect(task2AfterDelete.parentId).toBe(remainingLaneAfterDelete.id)
    expect(gatewayAfterDelete.parentId).toBe(remainingLaneAfterDelete.id)
    expect(sendTaskAfterDelete.parentId).toBe(remainingLaneAfterDelete.id)
    expect(startAfterDelete.y).toBeGreaterThanOrEqual(remainingLaneAfterDelete.y)
    expect(taskAfterDelete.y).toBeGreaterThanOrEqual(remainingLaneAfterDelete.y)
    expect(serviceTaskAfterDelete.y).toBeGreaterThanOrEqual(remainingLaneAfterDelete.y)
    expect(endAfterDelete.y).toBeGreaterThanOrEqual(remainingLaneAfterDelete.y)
    expect(task2AfterDelete.y).toBeGreaterThanOrEqual(remainingLaneAfterDelete.y)
    expect(gatewayAfterDelete.y).toBeGreaterThanOrEqual(remainingLaneAfterDelete.y)
    expect(sendTaskAfterDelete.y).toBeGreaterThanOrEqual(remainingLaneAfterDelete.y)

    const topmostRemainingContentTop = Math.min(
      startAfterDelete.y,
      taskAfterDelete.y,
      serviceTaskAfterDelete.y,
      endAfterDelete.y,
      task2AfterDelete.y,
      gatewayAfterDelete.y,
      sendTaskAfterDelete.y,
    )
    const expectedClampedTop = topmostRemainingContentTop

    await resizeNodeByEdgeOverTime(
      page,
      scenario.lane2Id,
      'top',
      { x: 0, y: 220 },
      {
        selectOffset: { x: 450, y: 12 },
        durationMs: 2000,
        steps: 24,
      },
    )

    const poolAfterResize = await getNodeSnapshot(page, scenario.poolId)
    const remainingLaneAfterResize = await getNodeSnapshot(page, scenario.lane2Id)
    const task2AfterResize = await getNodeSnapshot(page, scenario.task2Id)
    const gatewayAfterResize = await getNodeSnapshot(page, scenario.gatewayId)
    const sendTaskAfterResize = await getNodeSnapshot(page, scenario.sendTaskId)
    await takeScreenshot(page, '删除第一条-Lane-后剩余-Lane-top-resize-仍受当前内容约束')

    expect(remainingLaneAfterResize.parentId).toBe(poolAfterResize.id)
    expect(remainingLaneAfterResize.x).toBeCloseTo(poolAfterResize.x + 30, 0)
    expect(remainingLaneAfterResize.y).toBeCloseTo(poolAfterResize.y, 0)
    expect(remainingLaneAfterResize.width).toBeCloseTo(poolAfterResize.width - 30, 0)
    expect(remainingLaneAfterResize.height).toBeCloseTo(poolAfterResize.height, 0)
    expect(poolAfterResize.y).toBeCloseTo(expectedClampedTop, 0)
    expect(poolAfterResize.y).toBeGreaterThan(poolBeforeDelete.y)
    expect(task2AfterResize.y).toBeGreaterThanOrEqual(poolAfterResize.y)
    expect(gatewayAfterResize.y).toBeGreaterThanOrEqual(poolAfterResize.y)
    expect(sendTaskAfterResize.y).toBeGreaterThanOrEqual(poolAfterResize.y)
  })

  test('三条 Lane 时中间 Lane 顶边拖拽应只与相邻上方 Lane 重分配高度', async ({ page }, testInfo) => {
    await waitForHarness(page)
    const takeScreenshot = createBrowserScreenshotTaker(testInfo)

    const scenario = await createAddedLaneMatrixScenario(page)
    const before = await getLaneMatrixSnapshot(page, scenario.poolId, [
      scenario.taskId,
      scenario.gatewayId,
      scenario.task2Id,
      scenario.sendTaskId,
      scenario.serviceTaskId,
      scenario.addedTaskId,
    ])

    const { beforeBox, previewBox } = await resizeByHandleWithPreviewSnapshot(
      page,
      takeScreenshot,
      '三条-Lane-中间-top-拖拽应只影响相邻上方-Lane',
      scenario.lane2Id,
      'top',
      { x: 0, y: -80 },
      { x: 140, y: 80 },
    )

    expect(Math.abs(previewBox.x - beforeBox.x)).toBeLessThanOrEqual(1)
    expect(Math.abs(previewBox.width - beforeBox.width)).toBeLessThanOrEqual(2)
    expect(previewBox.y).toBeLessThan(beforeBox.y)
    expect(previewBox.height).toBeGreaterThan(beforeBox.height)

    const after = await getLaneMatrixSnapshot(page, scenario.poolId, [
      scenario.taskId,
      scenario.gatewayId,
      scenario.task2Id,
      scenario.sendTaskId,
      scenario.serviceTaskId,
      scenario.addedTaskId,
    ])

    expect(after.lanes).toHaveLength(3)
    expectLaneStackFillsPool(after)
    expectMiddleLaneTopResizeGeometry(before, after, {
      top: scenario.lane1Id,
      middle: scenario.lane2Id,
      bottom: scenario.laneId,
    })
  })

  test('三条 Lane 时中间 Lane 底边拖拽应只与相邻下方 Lane 重分配高度', async ({ page }, testInfo) => {
    await waitForHarness(page)
    const takeScreenshot = createBrowserScreenshotTaker(testInfo)

    const scenario = await createAddedLaneMatrixScenario(page)
    const before = await getLaneMatrixSnapshot(page, scenario.poolId, [
      scenario.taskId,
      scenario.gatewayId,
      scenario.task2Id,
      scenario.sendTaskId,
      scenario.serviceTaskId,
      scenario.addedTaskId,
    ])

    const { beforeBox, previewBox } = await resizeByHandleWithPreviewSnapshot(
      page,
      takeScreenshot,
      '三条-Lane-中间-bottom-拖拽应只影响相邻下方-Lane',
      scenario.lane2Id,
      'bottom',
      { x: 0, y: 80 },
      { x: 140, y: 80 },
    )

    expect(Math.abs(previewBox.x - beforeBox.x)).toBeLessThanOrEqual(1)
    expect(Math.abs(previewBox.y - beforeBox.y)).toBeLessThanOrEqual(1)
    expect(Math.abs(previewBox.width - beforeBox.width)).toBeLessThanOrEqual(2)
    expect(previewBox.height).toBeGreaterThan(beforeBox.height)

    const after = await getLaneMatrixSnapshot(page, scenario.poolId, [
      scenario.taskId,
      scenario.gatewayId,
      scenario.task2Id,
      scenario.sendTaskId,
      scenario.serviceTaskId,
      scenario.addedTaskId,
    ])

    expect(after.lanes).toHaveLength(3)
    expectLaneStackFillsPool(after)
    expectMiddleLaneBottomResizeGeometry(before, after, {
      top: scenario.lane1Id,
      middle: scenario.lane2Id,
      bottom: scenario.laneId,
    })
  })

  test('三条 Lane 时中间 Lane 顶边向内拖拽应只与相邻上方 Lane 重分配高度', async ({ page }, testInfo) => {
    await waitForHarness(page)
    const takeScreenshot = createBrowserScreenshotTaker(testInfo)

    const scenario = await createAddedLaneMatrixScenario(page)
    const before = await getLaneMatrixSnapshot(page, scenario.poolId, [
      scenario.taskId,
      scenario.gatewayId,
      scenario.task2Id,
      scenario.sendTaskId,
      scenario.serviceTaskId,
      scenario.addedTaskId,
    ])

    const { beforeBox, previewBox } = await resizeByHandleWithPreviewSnapshot(
      page,
      takeScreenshot,
      '三条-Lane-中间-top-向内拖拽应只影响相邻上方-Lane',
      scenario.lane2Id,
      'top',
      { x: 0, y: 60 },
      { x: 140, y: 80 },
    )

    expect(Math.abs(previewBox.x - beforeBox.x)).toBeLessThanOrEqual(1)
    expect(Math.abs(previewBox.width - beforeBox.width)).toBeLessThanOrEqual(2)
    expect(previewBox.y).toBeGreaterThan(beforeBox.y)
    expect(previewBox.height).toBeLessThan(beforeBox.height)

    const after = await getLaneMatrixSnapshot(page, scenario.poolId, [
      scenario.taskId,
      scenario.gatewayId,
      scenario.task2Id,
      scenario.sendTaskId,
      scenario.serviceTaskId,
      scenario.addedTaskId,
    ])

    expect(after.lanes).toHaveLength(3)
    expectLaneStackFillsPool(after)
    expect(after.pool.y).toBeCloseTo(before.pool.y, 0)
    expect(after.pool.height).toBeCloseTo(before.pool.height, 0)
    expect(after.laneMap[scenario.lane1Id].height).toBeGreaterThan(before.laneMap[scenario.lane1Id].height)
    expect(after.laneMap[scenario.lane2Id].y).toBeGreaterThan(before.laneMap[scenario.lane2Id].y)
    expect(after.laneMap[scenario.lane2Id].height).toBeLessThan(before.laneMap[scenario.lane2Id].height)
    expect(after.laneMap[scenario.laneId].y).toBeCloseTo(before.laneMap[scenario.laneId].y, 0)
    expect(after.laneMap[scenario.laneId].height).toBeCloseTo(before.laneMap[scenario.laneId].height, 0)
  })

  test('三条 Lane 时中间 Lane 底边向内拖拽应只与相邻下方 Lane 重分配高度', async ({ page }, testInfo) => {
    await waitForHarness(page)
    const takeScreenshot = createBrowserScreenshotTaker(testInfo)

    const scenario = await createAddedLaneMatrixScenario(page)
    const before = await getLaneMatrixSnapshot(page, scenario.poolId, [
      scenario.taskId,
      scenario.gatewayId,
      scenario.task2Id,
      scenario.sendTaskId,
      scenario.serviceTaskId,
      scenario.addedTaskId,
    ])

    const { beforeBox, previewBox } = await resizeByHandleWithPreviewSnapshot(
      page,
      takeScreenshot,
      '三条-Lane-中间-bottom-向内拖拽应只影响相邻下方-Lane',
      scenario.lane2Id,
      'bottom',
      { x: 0, y: -60 },
      { x: 140, y: 80 },
    )

    expect(Math.abs(previewBox.x - beforeBox.x)).toBeLessThanOrEqual(1)
    expect(Math.abs(previewBox.y - beforeBox.y)).toBeLessThanOrEqual(1)
    expect(Math.abs(previewBox.width - beforeBox.width)).toBeLessThanOrEqual(2)
    expect(previewBox.height).toBeLessThan(beforeBox.height)

    const after = await getLaneMatrixSnapshot(page, scenario.poolId, [
      scenario.taskId,
      scenario.gatewayId,
      scenario.task2Id,
      scenario.sendTaskId,
      scenario.serviceTaskId,
      scenario.addedTaskId,
    ])

    expect(after.lanes).toHaveLength(3)
    expectLaneStackFillsPool(after)
    expect(after.pool.y).toBeCloseTo(before.pool.y, 0)
    expect(after.pool.height).toBeCloseTo(before.pool.height, 0)
    expect(after.laneMap[scenario.lane1Id].y).toBeCloseTo(before.laneMap[scenario.lane1Id].y, 0)
    expect(after.laneMap[scenario.lane1Id].height).toBeCloseTo(before.laneMap[scenario.lane1Id].height, 0)
    expect(after.laneMap[scenario.lane2Id].height).toBeLessThan(before.laneMap[scenario.lane2Id].height)
    expect(after.laneMap[scenario.laneId].y).toBeLessThan(before.laneMap[scenario.laneId].y)
    expect(after.laneMap[scenario.laneId].height).toBeGreaterThan(before.laneMap[scenario.laneId].height)
  })

  test('三条 Lane 时下方 Lane 顶边向上大幅拖拽应钳制在相邻上方 Lane 最小高度', async ({ page }, testInfo) => {
    await waitForHarness(page)
    const takeScreenshot = createBrowserScreenshotTaker(testInfo)

    const scenario = await createAddedLaneMatrixScenario(page)
    const before = await getLaneMatrixSnapshot(page, scenario.poolId, [
      scenario.taskId,
      scenario.gatewayId,
      scenario.task2Id,
      scenario.sendTaskId,
      scenario.serviceTaskId,
      scenario.addedTaskId,
    ])

    const { beforeBox, previewBox } = await resizeByHandleWithPreviewSnapshot(
      page,
      takeScreenshot,
      '三条-Lane-下方-top-向上大幅拖拽应钳制相邻上方-Lane-最小高度',
      scenario.laneId,
      'top',
      { x: 0, y: -260 },
      { x: 140, y: 60 },
    )

    const expectedClampedTop = before.laneMap[scenario.lane2Id].y + 60
    const expectedPreviewTop = beforeBox.y - (before.laneMap[scenario.laneId].y - expectedClampedTop)

    expect(Math.abs(previewBox.x - beforeBox.x)).toBeLessThanOrEqual(1)
    expect(Math.abs(previewBox.width - beforeBox.width)).toBeLessThanOrEqual(2)
    expect(Math.abs(previewBox.y - expectedPreviewTop)).toBeLessThanOrEqual(6)
    expect(previewBox.y).toBeGreaterThanOrEqual(expectedPreviewTop - 1)

    const after = await getLaneMatrixSnapshot(page, scenario.poolId, [
      scenario.taskId,
      scenario.gatewayId,
      scenario.task2Id,
      scenario.sendTaskId,
      scenario.serviceTaskId,
      scenario.addedTaskId,
    ])

    expect(after.lanes).toHaveLength(3)
    expectLaneStackFillsPool(after)
    expect(after.pool.y).toBeCloseTo(before.pool.y, 0)
    expect(after.pool.height).toBeCloseTo(before.pool.height, 0)
    expect(after.laneMap[scenario.lane1Id].y).toBeCloseTo(before.laneMap[scenario.lane1Id].y, 0)
    expect(after.laneMap[scenario.lane1Id].height).toBeCloseTo(before.laneMap[scenario.lane1Id].height, 0)
    expect(after.laneMap[scenario.lane2Id].y).toBeCloseTo(before.laneMap[scenario.lane2Id].y, 0)
    expect(after.laneMap[scenario.lane2Id].height).toBeCloseTo(60, 0)
    expect(after.laneMap[scenario.laneId].y).toBeCloseTo(expectedClampedTop, 0)
    expect(after.laneMap[scenario.laneId].height).toBeCloseTo(
      before.laneMap[scenario.laneId].height + (before.laneMap[scenario.laneId].y - expectedClampedTop),
      0,
    )
  })

  test('Lane resize 后 Pool 内部任务节点不应跟随泳道边界一起移动', async ({ page }, testInfo) => {
    await waitForHarness(page)
    const takeScreenshot = createBrowserScreenshotTaker(testInfo)

    const scenario = await createAddedLaneMatrixScenario(page)
    const before = await getLaneMatrixSnapshot(page, scenario.poolId, [
      scenario.taskId,
      scenario.gatewayId,
      scenario.task2Id,
      scenario.sendTaskId,
      scenario.serviceTaskId,
      scenario.addedTaskId,
    ])
    await takeScreenshot(page, 'Lane-resize-前-Pool-内部任务节点位置')

    await resizeByHandleWithSnapshot(
      page,
      takeScreenshot,
      'Lane-resize-后-Pool-内部任务节点不应跟随移动',
      scenario.lane2Id,
      'top',
      { x: 0, y: -80 },
      { x: 140, y: 80 },
    )

    const after = await getLaneMatrixSnapshot(page, scenario.poolId, [
      scenario.taskId,
      scenario.gatewayId,
      scenario.task2Id,
      scenario.sendTaskId,
      scenario.serviceTaskId,
      scenario.addedTaskId,
    ])

    expect(after.lanes).toHaveLength(3)
    expectLaneStackFillsPool(after)
    expect(after.laneMap[scenario.lane1Id].height).toBeLessThan(before.laneMap[scenario.lane1Id].height)
    expect(after.laneMap[scenario.lane2Id].y).toBeLessThan(before.laneMap[scenario.lane2Id].y)
    expect(after.laneMap[scenario.lane2Id].height).toBeGreaterThan(before.laneMap[scenario.lane2Id].height)

    for (const nodeId of [
      scenario.taskId,
      scenario.gatewayId,
      scenario.task2Id,
      scenario.sendTaskId,
      scenario.serviceTaskId,
      scenario.addedTaskId,
    ]) {
      const beforeNode = before.nodes[nodeId]
      const afterNode = after.nodes[nodeId]

      expect(afterNode.x).toBeCloseTo(beforeNode.x, 0)
      expect(afterNode.y).toBeCloseTo(beforeNode.y, 0)
      expect(afterNode.width).toBeCloseTo(beforeNode.width, 0)
      expect(afterNode.height).toBeCloseTo(beforeNode.height, 0)
    }
  })

  test('Lane 右边收缩时应受直属任务下挂边界事件范围约束', async ({ page }, testInfo) => {
    await waitForHarness(page)
    const takeScreenshot = createBrowserScreenshotTaker(testInfo)

    const scenario = await createPoolLaneTaskBoundaryScenario(page)
    expect(scenario.boundaryId).toBeTruthy()

    await dragNodeBy(page, scenario.taskId, { x: 180, y: 0 })

    const beforePool = await getNodeSnapshot(page, scenario.poolId)
    const beforeLane = await getNodeSnapshot(page, scenario.laneId)
    const beforeTask = await getNodeSnapshot(page, scenario.taskId)
    const beforeBoundary = await getNodeSnapshot(page, scenario.boundaryId!)
    const expectedClampedRight = beforeBoundary.x + beforeBoundary.width

    expect(beforeTask.x + beforeTask.width).toBeLessThan(expectedClampedRight)
    expect(expectedClampedRight).toBeGreaterThan(beforeLane.x + 300)

    await resizeNodeByEdgeOverTime(
      page,
      scenario.laneId,
      'right',
      { x: -220, y: 0 },
      {
        selectOffset: { x: 250, y: 80 },
        durationMs: 1600,
        steps: 20,
      },
    )

    const afterPool = await getNodeSnapshot(page, scenario.poolId)
    const afterLane = await getNodeSnapshot(page, scenario.laneId)
    const afterTask = await getNodeSnapshot(page, scenario.taskId)
    const afterBoundary = await getNodeSnapshot(page, scenario.boundaryId!)
    await takeScreenshot(page, 'Lane-右边收缩应受边界事件后代范围约束')

    expect(afterPool.x).toBeCloseTo(beforePool.x, 0)
    expect(afterLane.x).toBeCloseTo(beforeLane.x, 0)
    expect(afterPool.width).toBeLessThan(beforePool.width)
    expect(afterLane.width).toBeLessThan(beforeLane.width)
    expect(afterPool.x + afterPool.width).toBeCloseTo(expectedClampedRight, 0)
    expect(afterLane.x + afterLane.width).toBeCloseTo(expectedClampedRight, 0)
    expectInsideRect(afterTask, afterLane, 2)
    expectInsideRect(afterBoundary, afterLane, 2)
  })

  test('视图平移缩放后 resize ghost 应继续贴合节点屏幕位置', async ({ page }, testInfo) => {
    await waitForHarness(page)
    const takeScreenshot = createBrowserScreenshotTaker(testInfo)

    const scenario = await createMultiLaneScenario(page)
    await clickNode(page, scenario.lane1Id, { x: 140, y: 80 })
    await setViewportTransform(page, { tx: 160, ty: 90, scale: 1.2 })

    const laneLocator = getNodeLocator(page, scenario.lane1Id)
    const beforeBox = await laneLocator.boundingBox()
    expect(beforeBox).not.toBeNull()

    let previewBox: { x: number; y: number; width: number; height: number } | null = null

    await resizeNodeByHandleOverTime(page, scenario.lane1Id, 'bottom', { x: 0, y: 40 }, {
      selectOffset: { x: 140, y: 80 },
      durationMs: 1000,
      steps: 12,
      onStep: async ({ step }) => {
        if (step !== 6) {
          return
        }

        const preview = getResizePreviewLocator(page, scenario.lane1Id)
        await expect(preview).toBeVisible()
        await takeScreenshot(page, '视图变换后-resize-ghost-应贴合节点')
        previewBox = await preview.boundingBox()
      },
    })

    expect(previewBox).not.toBeNull()
    expect(Math.abs(previewBox!.x - beforeBox!.x)).toBeLessThanOrEqual(1)
    expect(Math.abs(previewBox!.y - beforeBox!.y)).toBeLessThanOrEqual(1)
    expect(Math.abs(previewBox!.width - beforeBox!.width)).toBeLessThanOrEqual(2)
    expect(previewBox!.height).toBeGreaterThan(beforeBox!.height)
  })

  test('Pool 左上角轻微拖拽时 preview 应先变化且真实节点不应先跟随漂移', async ({ page }, testInfo) => {
    await waitForHarness(page)
    const takeScreenshot = createBrowserScreenshotTaker(testInfo)

    const scenario = await createMultiLaneScenario(page)
    const beforePool = await getNodeSnapshot(page, scenario.poolId)
    const beforeLane = await getNodeSnapshot(page, scenario.lane1Id)
    const beforeTask = await getNodeSnapshot(page, scenario.taskId)
    const poolLocator = getNodeLocator(page, scenario.poolId)
    const beforeBox = await poolLocator.boundingBox()

    expect(beforeBox).not.toBeNull()
    await takeScreenshot(page, 'Pool-top-left-轻微拖拽-初始')

    const previewSamples: Array<{
      step: number
      previewBox: { x: number; y: number; width: number; height: number }
      pool: NodeSnapshot
      lane: NodeSnapshot
      task: NodeSnapshot
    }> = []

    await resizeNodeByHandleOverTime(page, scenario.poolId, 'top-left', { x: 24, y: 18 }, {
      selectOffset: { x: 220, y: 120 },
      durationMs: 900,
      steps: 12,
      onStep: async ({ step }) => {
        if (step !== 6 && step !== 9) {
          return
        }

        await page.evaluate(() => new Promise<void>((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
        }))

        const preview = getResizePreviewLocator(page, scenario.poolId)
        await expect(preview).toBeVisible()
        const previewBox = await preview.boundingBox()
        expect(previewBox).not.toBeNull()

        previewSamples.push({
          step,
          previewBox: previewBox!,
          pool: await getNodeSnapshot(page, scenario.poolId),
          lane: await getNodeSnapshot(page, scenario.lane1Id),
          task: await getNodeSnapshot(page, scenario.taskId),
        })

        if (step === 9) {
          await takeScreenshot(page, 'Pool-top-left-轻微拖拽-preview')
        }
      },
    })

    expect(previewSamples).toHaveLength(2)
    expect(previewSamples[0].step).toBe(6)
    expect(previewSamples[1].step).toBe(9)

    for (const sample of previewSamples) {
      expect(sample.previewBox.width).toBeLessThan(beforeBox!.width)
      expect(sample.previewBox.height).toBeLessThan(beforeBox!.height)
      expect(sample.pool.x).toBeCloseTo(beforePool.x, 0)
      expect(sample.pool.y).toBeCloseTo(beforePool.y, 0)
      expect(sample.pool.width).toBeCloseTo(beforePool.width, 0)
      expect(sample.pool.height).toBeCloseTo(beforePool.height, 0)
      expect(sample.lane.x).toBeCloseTo(beforeLane.x, 0)
      expect(sample.lane.y).toBeCloseTo(beforeLane.y, 0)
      expect(sample.lane.width).toBeCloseTo(beforeLane.width, 0)
      expect(sample.lane.height).toBeCloseTo(beforeLane.height, 0)
      expect(sample.task.x).toBeCloseTo(beforeTask.x, 0)
      expect(sample.task.y).toBeCloseTo(beforeTask.y, 0)
      expect(sample.task.width).toBeCloseTo(beforeTask.width, 0)
      expect(sample.task.height).toBeCloseTo(beforeTask.height, 0)
    }

    expect(previewSamples[1].previewBox.width).toBeLessThanOrEqual(previewSamples[0].previewBox.width)
    expect(previewSamples[1].previewBox.height).toBeLessThanOrEqual(previewSamples[0].previewBox.height)

    const after = await getLaneMatrixSnapshot(page, scenario.poolId, [
      scenario.taskId,
      scenario.gatewayId,
      scenario.task2Id,
      scenario.sendTaskId,
      scenario.serviceTaskId,
    ])
    await takeScreenshot(page, 'Pool-top-left-轻微拖拽-终态')

    expectLaneStackFillsPool(after)
    expect(after.pool.x).toBeGreaterThan(beforePool.x)
    expect(after.pool.y).toBeGreaterThan(beforePool.y)
    expect(after.pool.width).toBeLessThan(beforePool.width)
    expect(after.pool.height).toBeLessThan(beforePool.height)
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

  for (const cornerCase of poolCornerCases) {
    test(cornerCase.title, async ({ page }, testInfo) => {
      await waitForHarness(page)
      const takeScreenshot = createBrowserScreenshotTaker(testInfo)

      const scenario = await createMultiLaneScenario(page)
      const before = await getLaneMatrixSnapshot(page, scenario.poolId, [
        scenario.taskId,
        scenario.gatewayId,
        scenario.task2Id,
        scenario.sendTaskId,
        scenario.serviceTaskId,
      ])

      await resizeByHandleWithSnapshot(
        page,
        takeScreenshot,
        cornerCase.title,
        cornerCase.targetId(scenario),
        cornerCase.position,
        cornerCase.delta,
        cornerCase.selectOffset,
      )

      const after = await getLaneMatrixSnapshot(page, scenario.poolId, [
        scenario.taskId,
        scenario.gatewayId,
        scenario.task2Id,
        scenario.sendTaskId,
        scenario.serviceTaskId,
      ])

      expectLaneStackFillsPool(after)
      expectPoolHandleGeometry(before, after, cornerCase.position, cornerCase.delta)
    })
  }

  for (const cornerCase of laneCornerCases) {
    test(cornerCase.title, async ({ page }, testInfo) => {
      await waitForHarness(page)
      const takeScreenshot = createBrowserScreenshotTaker(testInfo)

      const scenario = await createMultiLaneScenario(page)
      const before = await getLaneMatrixSnapshot(page, scenario.poolId, [
        scenario.taskId,
        scenario.gatewayId,
        scenario.task2Id,
        scenario.sendTaskId,
        scenario.serviceTaskId,
      ])

      await resizeByHandleWithSnapshot(
        page,
        takeScreenshot,
        cornerCase.title,
        cornerCase.targetId(scenario),
        cornerCase.position,
        cornerCase.delta,
        cornerCase.selectOffset,
      )

      const after = await getLaneMatrixSnapshot(page, scenario.poolId, [
        scenario.taskId,
        scenario.gatewayId,
        scenario.task2Id,
        scenario.sendTaskId,
        scenario.serviceTaskId,
      ])

      expectLaneStackFillsPool(after)
      expectLaneHandleGeometry(before, after, cornerCase.targetId(scenario), cornerCase.position, cornerCase.delta)
    })
  }

  for (const handleCase of addedLaneHandleCases) {
    test(handleCase.title, async ({ page }, testInfo) => {
      await waitForHarness(page)
      const takeScreenshot = createBrowserScreenshotTaker(testInfo)

      const scenario = await createAddedLaneMatrixScenario(page)
      const before = await getLaneMatrixSnapshot(page, scenario.poolId, [
        scenario.taskId,
        scenario.gatewayId,
        scenario.task2Id,
        scenario.sendTaskId,
        scenario.serviceTaskId,
        scenario.addedTaskId,
      ])

      await resizeByHandleWithSnapshot(
        page,
        takeScreenshot,
        handleCase.title,
        handleCase.targetId(scenario),
        handleCase.position,
        handleCase.delta,
        handleCase.selectOffset,
      )

      const after = await getLaneMatrixSnapshot(page, scenario.poolId, [
        scenario.taskId,
        scenario.gatewayId,
        scenario.task2Id,
        scenario.sendTaskId,
        scenario.serviceTaskId,
        scenario.addedTaskId,
      ])

      expect(after.lanes).toHaveLength(3)
      expectLaneStackFillsPool(after)
      expectLaneHandleGeometry(before, after, handleCase.targetId(scenario), handleCase.position, handleCase.delta)
    })
  }

  for (const handleCase of deletedLaneHandleCases) {
    test(handleCase.title, async ({ page }, testInfo) => {
      await waitForHarness(page)
      const takeScreenshot = createBrowserScreenshotTaker(testInfo)

      const scenario = await createDeletedLaneMatrixScenario(page)
      const before = await getLaneMatrixSnapshot(page, scenario.poolId, [
        scenario.gatewayId,
        scenario.task2Id,
        scenario.sendTaskId,
      ])

      await resizeByHandleWithSnapshot(
        page,
        takeScreenshot,
        handleCase.title,
        handleCase.targetId(scenario),
        handleCase.position,
        handleCase.delta,
        handleCase.selectOffset,
      )

      const after = await getLaneMatrixSnapshot(page, scenario.poolId, [
        scenario.gatewayId,
        scenario.task2Id,
        scenario.sendTaskId,
      ])

      expect(after.lanes).toHaveLength(1)
      expectLaneStackFillsPool(after)
      expectLaneHandleGeometry(before, after, handleCase.targetId(scenario), handleCase.position, handleCase.delta)
    })
  }
})
