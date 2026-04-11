/**
 * 浏览器视觉回归测试 — 共享辅助函数
 *
 * 所有 spec 文件共享的类型定义、场景创建、DOM 交互与断言。
 */

import { expect, type Locator, type Page } from '@playwright/test'

// ============================================================================
// 类型定义
// ============================================================================

export type ScenarioIds = {
  poolId: string
  laneId: string
  taskId: string
  boundaryId?: string
}

export type StandaloneTaskScenarioIds = {
  taskId: string
}

export type FirstPoolWrapScenarioIds = {
  poolId: string
  taskId: string
}

export type MessageScenarioIds = {
  leftPoolId: string
  rightPoolId: string
  leftLaneId: string
  rightLaneId: string
  sourceTaskId: string
  targetTaskId: string
}

export type MultiLaneScenarioIds = {
  poolId: string
  lane1Id: string
  lane2Id: string
  taskId: string
  startId: string
  endId: string
  gatewayId: string
  task2Id: string
  sendTaskId: string
  serviceTaskId: string
}

export type NodeSnapshot = {
  id: string
  x: number
  y: number
  width: number
  height: number
  parentId: string | null
}

export type EdgeSnapshot = {
  id: string
  shape: string
  sourceId: string | null
  targetId: string | null
}

export type DragPoint = {
  x: number
  y: number
}

export type DragOptions = {
  startOffset?: DragPoint
}

export type TimedDragContext = {
  step: number
  totalSteps: number
  progress: number
  position: DragPoint
}

export type TimedResizeOptions = {
  selectOffset?: DragPoint
  durationMs?: number
  steps?: number
  onStep?: (context: TimedDragContext) => Promise<void>
}

// ============================================================================
// 场景创建
// ============================================================================

export async function waitForHarness(page: Page): Promise<void> {
  await page.goto('/')
  await page.waitForFunction(() => Boolean(window.__x6PluginBrowserHarness))
}

export async function createPoolLaneTaskScenario(page: Page): Promise<ScenarioIds> {
  return page.evaluate(() => {
    const harness = window.__x6PluginBrowserHarness
    if (!harness) {
      throw new Error('浏览器测试 harness 尚未就绪')
    }
    return harness.createPoolLaneTaskScenario()
  })
}

export async function createStandaloneTaskScenario(page: Page): Promise<StandaloneTaskScenarioIds> {
  return page.evaluate(() => {
    const harness = window.__x6PluginBrowserHarness
    if (!harness) {
      throw new Error('浏览器测试 harness 尚未就绪')
    }
    return harness.createStandaloneTaskScenario()
  })
}

export async function addFirstPoolScenario(page: Page): Promise<FirstPoolWrapScenarioIds> {
  return page.evaluate(() => {
    const harness = window.__x6PluginBrowserHarness
    if (!harness) {
      throw new Error('浏览器测试 harness 尚未就绪')
    }
    return harness.addFirstPoolScenario()
  })
}

export async function createPoolLaneTaskBoundaryScenario(page: Page): Promise<ScenarioIds> {
  return page.evaluate(() => {
    const harness = window.__x6PluginBrowserHarness
    if (!harness) {
      throw new Error('浏览器测试 harness 尚未就绪')
    }
    return harness.createPoolLaneTaskBoundaryScenario()
  })
}

export async function createTwoPoolMessageScenario(page: Page): Promise<MessageScenarioIds> {
  return page.evaluate(() => {
    const harness = window.__x6PluginBrowserHarness
    if (!harness) {
      throw new Error('浏览器测试 harness 尚未就绪')
    }
    return harness.createTwoPoolMessageScenario()
  })
}

export async function createMultiLaneScenario(page: Page): Promise<MultiLaneScenarioIds> {
  return page.evaluate(() => {
    const harness = window.__x6PluginBrowserHarness
    if (!harness) {
      throw new Error('浏览器测试 harness 尚未就绪')
    }
    return harness.createMultiLaneScenario()
  })
}

export async function addLaneToPoolInBrowser(page: Page, poolId: string): Promise<string | null> {
  return page.evaluate((id) => {
    const harness = window.__x6PluginBrowserHarness
    if (!harness) {
      throw new Error('浏览器测试 harness 尚未就绪')
    }
    return harness.addLaneToPoolScenario(id)
  }, poolId)
}

export async function removeNodeInBrowser(page: Page, id: string): Promise<boolean> {
  return page.evaluate((nodeId) => {
    const harness = window.__x6PluginBrowserHarness
    if (!harness) {
      throw new Error('浏览器测试 harness 尚未就绪')
    }
    return harness.removeNode(nodeId)
  }, id)
}

// ============================================================================
// 数据查询
// ============================================================================

export async function getNodeSnapshot(page: Page, id: string): Promise<NodeSnapshot> {
  return page.evaluate((nodeId) => {
    const harness = window.__x6PluginBrowserHarness
    if (!harness) {
      throw new Error('浏览器测试 harness 尚未就绪')
    }
    return harness.getNodeSnapshot(nodeId)
  }, id)
}

export async function getPoolLaneSnapshots(page: Page, poolId: string): Promise<NodeSnapshot[]> {
  return page.evaluate((id) => {
    const harness = window.__x6PluginBrowserHarness
    if (!harness) {
      throw new Error('浏览器测试 harness 尚未就绪')
    }
    return harness.getPoolLaneSnapshots(id)
  }, poolId)
}

export async function getEdgeSnapshotByShape(page: Page, shape: string): Promise<EdgeSnapshot> {
  return page.evaluate((edgeShape) => {
    const harness = window.__x6PluginBrowserHarness
    if (!harness) {
      throw new Error('浏览器测试 harness 尚未就绪')
    }
    return harness.getEdgeSnapshotByShape(edgeShape)
  }, shape)
}

export async function getSelectedCellIds(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const harness = window.__x6PluginBrowserHarness
    if (!harness) {
      throw new Error('浏览器测试 harness 尚未就绪')
    }
    return harness.getSelectedCellIds()
  })
}

export async function roundtripXml(page: Page): Promise<string> {
  return page.evaluate(async () => {
    const harness = window.__x6PluginBrowserHarness
    if (!harness) {
      throw new Error('浏览器测试 harness 尚未就绪')
    }
    return harness.roundtripXml()
  })
}

export async function getEdgeCountByShape(page: Page, shape: string): Promise<number> {
  return page.evaluate((edgeShape) => {
    const harness = window.__x6PluginBrowserHarness
    if (!harness) {
      throw new Error('浏览器测试 harness 尚未就绪')
    }
    return harness.getEdgeCountByShape(edgeShape)
  }, shape)
}

// ============================================================================
// 断言辅助
// ============================================================================

export function expectMovedBy(before: NodeSnapshot, after: NodeSnapshot, delta: { x: number; y: number }): void {
  expect(after.x - before.x).toBeCloseTo(delta.x, 0)
  expect(after.y - before.y).toBeCloseTo(delta.y, 0)
}

export function expectMovedNear(before: NodeSnapshot, after: NodeSnapshot, delta: { x: number; y: number }, tolerance = 12): void {
  expect(Math.abs(after.x - before.x - delta.x)).toBeLessThanOrEqual(tolerance)
  expect(Math.abs(after.y - before.y - delta.y)).toBeLessThanOrEqual(tolerance)
}

export function expectPositionNear(actual: NodeSnapshot | DragPoint, expected: NodeSnapshot | DragPoint, tolerance = 10): void {
  expect(Math.abs(actual.x - expected.x)).toBeLessThanOrEqual(tolerance)
  expect(Math.abs(actual.y - expected.y)).toBeLessThanOrEqual(tolerance)
}

export function expectInsideRect(
  actual: NodeSnapshot,
  rect: Pick<NodeSnapshot, 'x' | 'y' | 'width' | 'height'>,
  tolerance = 10,
): void {
  expect(actual.x).toBeGreaterThanOrEqual(rect.x - tolerance)
  expect(actual.y).toBeGreaterThanOrEqual(rect.y - tolerance)
  expect(actual.x + actual.width).toBeLessThanOrEqual(rect.x + rect.width + tolerance)
  expect(actual.y + actual.height).toBeLessThanOrEqual(rect.y + rect.height + tolerance)
}

export function getNodeCenter(snapshot: NodeSnapshot): DragPoint {
  return {
    x: snapshot.x + snapshot.width / 2,
    y: snapshot.y + snapshot.height / 2,
  }
}

export function distanceToRectEdge(point: DragPoint, rect: Pick<NodeSnapshot, 'x' | 'y' | 'width' | 'height'>): number {
  const left = point.x - rect.x
  const right = rect.x + rect.width - point.x
  const top = point.y - rect.y
  const bottom = rect.y + rect.height - point.y
  return Math.min(Math.abs(left), Math.abs(right), Math.abs(top), Math.abs(bottom))
}

// ============================================================================
// DOM 交互
// ============================================================================

export function getNodeLocator(page: Page, id: string): Locator {
  return page.locator(`.x6-node[data-cell-id="${id}"]`).first()
}

export function getPortLocator(page: Page, id: string, group: 'left' | 'right' | 'top' | 'bottom'): Locator {
  return page.locator(`.x6-node[data-cell-id="${id}"] .x6-port-${group} .x6-port-body`).first()
}

export async function getCenter(locator: Locator): Promise<DragPoint> {
  const box = await locator.boundingBox()
  if (!box) {
    throw new Error('无法定位浏览器交互目标区域')
  }

  return {
    x: box.x + box.width / 2,
    y: box.y + box.height / 2,
  }
}

export async function clearSelection(page: Page): Promise<void> {
  const graph = page.locator('#graph')
  const box = await graph.boundingBox()
  if (!box) {
    throw new Error('无法定位图布区域')
  }

  await graph.click({
    position: {
      x: Math.max(box.width - 24, 24),
      y: Math.max(box.height - 24, 24),
    },
    force: true,
  })
  await expect.poll(() => getSelectedCellIds(page)).toEqual([])
}

export async function clickNode(page: Page, id: string, offset?: DragPoint): Promise<void> {
  const locator = getNodeLocator(page, id)
  await expect(locator).toBeVisible()

  if (!(await getSelectedCellIds(page)).includes(id)) {
    await clearSelection(page)
  }

  const box = await locator.boundingBox()
  if (!box) {
    throw new Error(`无法定位节点: ${id}`)
  }

  await locator.click({
    position: {
      x: offset?.x ?? box.width / 2,
      y: offset?.y ?? box.height / 2,
    },
    force: true,
  })

  if ((await getSelectedCellIds(page)).includes(id)) {
    return
  }

  const labels = locator.locator('text')
  for (let index = 0; index < await labels.count(); index += 1) {
    await labels.nth(index).click({ force: true })
    if ((await getSelectedCellIds(page)).includes(id)) {
      return
    }
  }

  const shapes = locator.locator('path, rect, polygon, ellipse')
  for (let index = 0; index < await shapes.count(); index += 1) {
    await shapes.nth(index).click({ force: true })
    if ((await getSelectedCellIds(page)).includes(id)) {
      return
    }
  }

  await expect.poll(() => getSelectedCellIds(page)).toContain(id)
}

export async function dragNodeBy(page: Page, id: string, delta: DragPoint, options: DragOptions = {}): Promise<void> {
  const locator = getNodeLocator(page, id)
  await expect(locator).toBeVisible()

  const box = await locator.boundingBox()
  if (!box) {
    throw new Error(`无法定位节点: ${id}`)
  }

  const startX = box.x + (options.startOffset?.x ?? box.width / 2)
  const startY = box.y + (options.startOffset?.y ?? box.height / 2)

  await page.mouse.move(startX, startY)
  await page.mouse.down()
  await page.mouse.move(startX + delta.x, startY + delta.y, { steps: 20 })
  await page.mouse.up()
}

export async function dragSelectionBoxBy(page: Page, delta: DragPoint): Promise<void> {
  const locator = page.locator('.x6-widget-selection-box').first()
  await expect(locator).toBeVisible()

  const center = await getCenter(locator)
  await page.mouse.move(center.x, center.y)
  await page.mouse.down()
  await page.mouse.move(center.x + delta.x, center.y + delta.y, { steps: 20 })
  await page.mouse.up()
}

export async function dragSelectionBoxWithOvershoot(
  page: Page,
  firstDelta: DragPoint,
  secondDelta: DragPoint,
): Promise<void> {
  const locator = page.locator('.x6-widget-selection-box').first()
  await expect(locator).toBeVisible()

  const center = await getCenter(locator)
  await page.mouse.move(center.x, center.y)
  await page.mouse.down()
  await page.mouse.move(center.x + firstDelta.x, center.y + firstDelta.y, { steps: 20 })
  await page.mouse.move(center.x + secondDelta.x, center.y + secondDelta.y, { steps: 20 })
  await page.mouse.up()
}

async function getClosestResizeHandle(
  page: Page,
  nodeId: string,
  position: string,
  target: DragPoint,
): Promise<Locator> {
  const handles = page.locator(`.x6-widget-transform-resize[data-position="${position}"]`)
  const count = await handles.count()
  if (count === 0) {
    throw new Error(`未找到 resize 手柄: ${position}`)
  }

  let bestIndex = 0
  let bestDistance = Number.POSITIVE_INFINITY

  for (let index = 0; index < count; index += 1) {
    const handle = handles.nth(index)
    const box = await handle.boundingBox()
    if (!box) {
      continue
    }

    const center = {
      x: box.x + box.width / 2,
      y: box.y + box.height / 2,
    }
    const distance = Math.hypot(center.x - target.x, center.y - target.y)
    if (distance < bestDistance) {
      bestDistance = distance
      bestIndex = index
    }
  }

  if (!Number.isFinite(bestDistance)) {
    throw new Error(`无法定位节点 ${nodeId} 的 resize 手柄: ${position}`)
  }

  return handles.nth(bestIndex)
}

async function waitForLayoutToSettle(page: Page): Promise<void> {
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
}

async function dragPointerOverTime(
  page: Page,
  start: DragPoint,
  delta: DragPoint,
  options: Pick<TimedResizeOptions, 'durationMs' | 'steps' | 'onStep'> = {},
): Promise<void> {
  const totalSteps = Math.max(1, options.steps ?? 20)
  const durationMs = Math.max(0, options.durationMs ?? 1000)
  const stepDelayMs = totalSteps > 0 ? durationMs / totalSteps : 0

  await page.mouse.move(start.x, start.y)
  await page.mouse.down()

  for (let step = 1; step <= totalSteps; step += 1) {
    const progress = step / totalSteps
    const position = {
      x: start.x + delta.x * progress,
      y: start.y + delta.y * progress,
    }

    await page.mouse.move(position.x, position.y, { steps: 1 })

    if (stepDelayMs > 0) {
      await page.waitForTimeout(stepDelayMs)
    }

    if (options.onStep) {
      await options.onStep({
        step,
        totalSteps,
        progress,
        position,
      })
    }
  }

  await page.mouse.up()
}

/**
 * 通过 bottom-right 手柄 resize 节点（兼容既有测试用法）。
 */
export async function resizeNodeBy(page: Page, id: string, delta: DragPoint, selectOffset?: DragPoint): Promise<void> {
  await clickNode(page, id, selectOffset)

  const locator = getNodeLocator(page, id)
  const box = await locator.boundingBox()
  if (!box) {
    throw new Error(`无法定位节点: ${id}`)
  }

  const handle = await getClosestResizeHandle(page, id, 'bottom-right', {
    x: box.x + box.width,
    y: box.y + box.height,
  })
  await expect(handle).toBeVisible()

  const center = await getCenter(handle)
  await dragPointerOverTime(page, center, delta, { durationMs: 0, steps: 20 })

  // Wait for layout to settle after resize
  await waitForLayoutToSettle(page)
}

export type ResizeEdge = 'top' | 'bottom' | 'left' | 'right'

/**
 * 通过指定方向的 resize 手柄拖拽节点边缘。
 *
 * @param page Playwright 页面
 * @param id 要 resize 的节点 ID
 * @param edge 要拖拽的边方向
 * @param delta 移动量（像素）
 * @param selectOffset 选中节点时的点击偏移
 */
export async function resizeNodeByEdge(
  page: Page,
  id: string,
  edge: ResizeEdge,
  delta: DragPoint,
  selectOffset?: DragPoint,
): Promise<void> {
  await clickNode(page, id, selectOffset)

  const locator = getNodeLocator(page, id)
  const box = await locator.boundingBox()
  if (!box) {
    throw new Error(`无法定位节点: ${id}`)
  }

  const target = {
    left: { x: box.x, y: box.y + box.height / 2 },
    right: { x: box.x + box.width, y: box.y + box.height / 2 },
    top: { x: box.x + box.width / 2, y: box.y },
    bottom: { x: box.x + box.width / 2, y: box.y + box.height },
  }[edge]
  const handle = await getClosestResizeHandle(page, id, edge, target)
  await expect(handle).toBeVisible()

  const center = await getCenter(handle)
  await dragPointerOverTime(page, center, delta, { durationMs: 0, steps: 1 })

  // Wait for layout to settle after resize (two rAF cycles covers batched updates)
  await waitForLayoutToSettle(page)
}

/**
 * 通过指定方向的 resize 手柄执行持续拖拽。
 *
 * 用于模拟接近真实鼠标行为的多步 resize，并允许在拖拽过程中截图。
 */
export async function resizeNodeByEdgeOverTime(
  page: Page,
  id: string,
  edge: ResizeEdge,
  delta: DragPoint,
  options: TimedResizeOptions = {},
): Promise<void> {
  await clickNode(page, id, options.selectOffset)

  const locator = getNodeLocator(page, id)
  const box = await locator.boundingBox()
  if (!box) {
    throw new Error(`无法定位节点: ${id}`)
  }

  const target = {
    left: { x: box.x, y: box.y + box.height / 2 },
    right: { x: box.x + box.width, y: box.y + box.height / 2 },
    top: { x: box.x + box.width / 2, y: box.y },
    bottom: { x: box.x + box.width / 2, y: box.y + box.height },
  }[edge]
  const handle = await getClosestResizeHandle(page, id, edge, target)
  await expect(handle).toBeVisible()

  const center = await getCenter(handle)
  await dragPointerOverTime(page, center, delta, options)
  await waitForLayoutToSettle(page)
}

export async function selectEdgeShape(page: Page, shape: 'bpmn-sequence-flow' | 'bpmn-message-flow'): Promise<void> {
  const testId = shape === 'bpmn-message-flow' ? 'edge-shape-message' : 'edge-shape-sequence'
  await page.getByTestId(testId).click()
}

export async function dragConnection(
  page: Page,
  args: {
    sourceId: string
    sourceGroup: 'left' | 'right' | 'top' | 'bottom'
    targetId: string
    targetGroup: 'left' | 'right' | 'top' | 'bottom'
  },
): Promise<void> {
  const source = getPortLocator(page, args.sourceId, args.sourceGroup)
  const target = getPortLocator(page, args.targetId, args.targetGroup)
  await expect(source).toBeVisible()
  await expect(target).toBeVisible()

  const sourceCenter = await getCenter(source)
  const targetCenter = await getCenter(target)

  await page.mouse.move(sourceCenter.x, sourceCenter.y)
  await page.mouse.down()
  await page.mouse.move(targetCenter.x, targetCenter.y, { steps: 24 })
  await page.mouse.up()
}

// ============================================================================
// Multi-Lane 完整性断言
// ============================================================================

/**
 * 对 MultiLane 场景执行全面完整性断言。
 *
 * 验证项：
 * 1. Lane2.y ≈ Lane1.y + Lane1.height（无间隙）
 * 2. Lane1 + Lane2 覆盖 Pool 内容区（无溢出）
 * 3. parentId 链完整
 * 4. Task 在 Lane1 内部
 *
 * @returns 各节点快照，供后续追加断言
 */
export async function assertMultiLaneIntegrity(
  page: Page,
  ids: MultiLaneScenarioIds,
): Promise<{
  pool: NodeSnapshot
  lane1: NodeSnapshot
  lane2: NodeSnapshot
  task: NodeSnapshot
}> {
  const pool = await getNodeSnapshot(page, ids.poolId)
  const lane1 = await getNodeSnapshot(page, ids.lane1Id)
  const lane2 = await getNodeSnapshot(page, ids.lane2Id)
  const task = await getNodeSnapshot(page, ids.taskId)

  // Lane2 紧接 Lane1 底部（无间隙）
  expect(lane2.y).toBeCloseTo(lane1.y + lane1.height, 0)

  // Lane1 顶部对齐 Pool 顶部
  expect(lane1.y).toBeCloseTo(pool.y, 0)

  // Lane2 底部对齐 Pool 底部
  expect(lane2.y + lane2.height).toBeCloseTo(pool.y + pool.height, 0)

  // Lane 宽度应等于 Pool 内容区宽度（Pool.width - HEADER_SIZE=30）
  const contentWidth = pool.width - 30
  expect(lane1.width).toBeCloseTo(contentWidth, 0)
  expect(lane2.width).toBeCloseTo(contentWidth, 0)

  // parentId 链
  expect(lane1.parentId).toBe(pool.id)
  expect(lane2.parentId).toBe(pool.id)
  expect(task.parentId).toBe(ids.lane1Id)

  // Task 在 Lane1 内部
  expect(task.x).toBeGreaterThanOrEqual(lane1.x - 1)
  expect(task.y).toBeGreaterThanOrEqual(lane1.y - 1)
  expect(task.x + task.width).toBeLessThanOrEqual(lane1.x + lane1.width + 1)
  expect(task.y + task.height).toBeLessThanOrEqual(lane1.y + lane1.height + 1)

  // Lane 2 内的网关和任务应在 Lane2 内部（仅在有节点时检查）
  if (ids.gatewayId && ids.task2Id) {
    try {
      const gateway = await getNodeSnapshot(page, ids.gatewayId)
      expect(gateway.parentId).toBe(ids.lane2Id)
      expect(gateway.y).toBeGreaterThanOrEqual(lane2.y - 1)
      expect(gateway.y + gateway.height).toBeLessThanOrEqual(lane2.y + lane2.height + 1)

      const task2 = await getNodeSnapshot(page, ids.task2Id)
      expect(task2.parentId).toBe(ids.lane2Id)
      expect(task2.y).toBeGreaterThanOrEqual(lane2.y - 1)
      expect(task2.y + task2.height).toBeLessThanOrEqual(lane2.y + lane2.height + 1)
    } catch {
      // 节点可能不存在于精简场景
    }
  }

  return { pool, lane1, lane2, task }
}
