import { describe, expect, it, vi } from 'vitest'

import * as swimlaneDelete from '../../../src/behaviors/swimlane-delete'
import { addLaneToPool } from '../../../src/behaviors/lane-management'
import { setupPoolContainment } from '../../../src/behaviors/pool-containment'
import {
  createBehaviorTestGraph,
  destroyBehaviorTestGraph,
  registerBehaviorTestShapes,
} from '../../helpers/behavior-test-graph'
import { BPMN_LANE, BPMN_POOL, BPMN_USER_TASK } from '../../../src/utils/constants'

registerBehaviorTestShapes([BPMN_POOL, BPMN_LANE, BPMN_USER_TASK])

function createLaneNode(
  id: string,
  x: number,
  y: number,
  width: number,
  height: number,
  options: {
    children?: any[]
    parent?: any
    data?: Record<string, unknown>
  } = {},
) {
  let position = { x, y }
  let size = { width, height }
  const children = [...(options.children ?? [])]
  let parent = options.parent ?? null

  const node: any = {
    id,
    shape: BPMN_LANE,
    getPosition: () => ({ ...position }),
    getSize: () => ({ ...size }),
    getChildren: () => children,
    getParent: () => parent,
    getData: () => options.data ?? { bpmn: { isHorizontal: true } },
    setPosition: vi.fn((nextX: number, nextY: number) => {
      const deltaX = nextX - position.x
      const deltaY = nextY - position.y
      position = { x: nextX, y: nextY }

      for (const child of children) {
        if (!child?.isNode?.() || child.shape === BPMN_LANE) {
          continue
        }

        if (child.getParent?.() !== node) {
          continue
        }

        const childPosition = child.getPosition?.()
        if (!childPosition || typeof child.setPosition !== 'function') {
          continue
        }

        child.setPosition(childPosition.x + deltaX, childPosition.y + deltaY)
      }
    }),
    setSize: vi.fn((nextWidth: number, nextHeight: number) => {
      size = { width: nextWidth, height: nextHeight }
    }),
    isNode: () => true,
    embed: vi.fn((child: any) => {
      if (!children.includes(child)) {
        children.push(child)
      }
      child.__setParent?.(node)
    }),
    __setParent: (nextParent: any) => {
      parent = nextParent
    },
  }

  return node
}

function createFlowNode(
  id: string,
  shape: string,
  options: {
    parent?: any
    x?: number
    y?: number
    width?: number
    height?: number
  } = {},
) {
  let parent = options.parent ?? null
  let position = { x: options.x ?? 0, y: options.y ?? 0 }
  let size = { width: options.width ?? 100, height: options.height ?? 60 }

  const node: any = {
    id,
    shape,
    getParent: () => parent,
    getPosition: () => ({ ...position }),
    getSize: () => ({ ...size }),
    setPosition: vi.fn((nextX: number, nextY: number) => {
      position = { x: nextX, y: nextY }
    }),
    setSize: vi.fn((nextWidth: number, nextHeight: number) => {
      size = { width: nextWidth, height: nextHeight }
    }),
    isNode: () => true,
    __setParent: (nextParent: any) => {
      parent = nextParent
    },
  }

  return node
}

describe('compensateLaneDelete', () => {
  it('水平删除中间 Lane 时应将空间按 1:1 分给上下相邻 Lane', () => {
    const graph = {
      startBatch: vi.fn(),
      stopBatch: vi.fn(),
    } as any
    const topLane = createLaneNode('lane-top', 70, 40, 370, 100)
    const bottomLane = createLaneNode('lane-bottom', 70, 260, 370, 140)

    swimlaneDelete.compensateLaneDelete(
      graph,
      { x: 70, y: 140, width: 370, height: 120 },
      [topLane, bottomLane],
      true,
    )

    expect(graph.startBatch).toHaveBeenCalledWith('delete-lane-compensate')
    expect(topLane.getSize()).toEqual({ width: 370, height: 160 })
    expect(bottomLane.getPosition()).toEqual({ x: 70, y: 200 })
    expect(bottomLane.getSize()).toEqual({ width: 370, height: 200 })
    expect(graph.stopBatch).toHaveBeenCalledWith('delete-lane-compensate')
  })

  it('只存在下侧 Lane 时应将全部空间补给贴边子 Lane', () => {
    const graph = {
      startBatch: vi.fn(),
      stopBatch: vi.fn(),
    } as any
    const nestedTop = createLaneNode('nested-top', 100, 140, 340, 80)
    const nestedBottom = createLaneNode('nested-bottom', 100, 220, 340, 120)
    const receiver = createLaneNode('receiver', 70, 140, 370, 200, {
      children: [nestedTop, nestedBottom],
    })

    swimlaneDelete.compensateLaneDelete(
      graph,
      { x: 70, y: 40, width: 370, height: 100 },
      [receiver],
      true,
    )

    expect(receiver.getPosition()).toEqual({ x: 70, y: 40 })
    expect(receiver.getSize()).toEqual({ width: 370, height: 300 })
    expect(nestedTop.getPosition()).toEqual({ x: 100, y: 40 })
    expect(nestedTop.getSize()).toEqual({ width: 340, height: 180 })
    expect(nestedBottom.getPosition()).toEqual({ x: 100, y: 220 })
    expect(nestedBottom.getSize()).toEqual({ width: 340, height: 120 })
  })

  it('单侧存在多条剩余 Lane 时只应让紧邻 Lane 接收删除高度', () => {
    const graph = {
      startBatch: vi.fn(),
      stopBatch: vi.fn(),
    } as any
    const adjacentLane = createLaneNode('lane-adjacent', 70, 140, 370, 100)
    const fartherLane = createLaneNode('lane-farther', 70, 240, 370, 160)

    swimlaneDelete.compensateLaneDelete(
      graph,
      { x: 70, y: 40, width: 370, height: 100 },
      [adjacentLane, fartherLane],
      true,
    )

    expect(adjacentLane.getPosition()).toEqual({ x: 70, y: 40 })
    expect(adjacentLane.getSize()).toEqual({ width: 370, height: 200 })
    expect(fartherLane.getPosition()).toEqual({ x: 70, y: 240 })
    expect(fartherLane.getSize()).toEqual({ width: 370, height: 160 })
  })

  it('垂直删除中间 Lane 时应将空间按左右相邻关系分配', () => {
    const graph = {
      startBatch: vi.fn(),
      stopBatch: vi.fn(),
    } as any
    const leftLane = createLaneNode('lane-left', 40, 70, 120, 300)
    const rightLane = createLaneNode('lane-right', 240, 70, 120, 300)

    swimlaneDelete.compensateLaneDelete(
      graph,
      { x: 160, y: 70, width: 80, height: 300 },
      [leftLane, rightLane],
      false,
    )

    expect(leftLane.getSize()).toEqual({ width: 160, height: 300 })
    expect(rightLane.getPosition()).toEqual({ x: 200, y: 70 })
    expect(rightLane.getSize()).toEqual({ width: 160, height: 300 })
  })

  it('没有剩余兄弟 Lane 时应直接返回', () => {
    const graph = {
      startBatch: vi.fn(),
      stopBatch: vi.fn(),
    } as any

    swimlaneDelete.compensateLaneDelete(graph, { x: 70, y: 40, width: 370, height: 100 }, [], true)

    expect(graph.startBatch).not.toHaveBeenCalled()
    expect(graph.stopBatch).not.toHaveBeenCalled()
  })
})

describe('setupSwimlaneDelete', () => {
  it('删除 Lane 时应补偿剩余兄弟 Lane 并收敛回父容器布局', () => {
    const pool = createLaneNode('pool', 40, 40, 400, 300)
    const deletedLane = createLaneNode('deleted', 70, 40, 370, 100, {
      parent: pool,
      data: { bpmn: { isHorizontal: true } },
    })
    const remainingLane = createLaneNode('remaining', 70, 140, 370, 200, {
      parent: pool,
    })
    const graph = {
      removeCell: vi.fn(),
      removeCells: vi.fn(),
      startBatch: vi.fn(),
      stopBatch: vi.fn(),
      getNodes: vi.fn(() => [remainingLane]),
      getCellById: vi.fn((id: string) => {
        if (id === deletedLane.id) return deletedLane
        if (id === remainingLane.id) return remainingLane
        if (id === pool.id) return pool
        return null
      }),
    } as any
    pool.getChildren = () => [deletedLane, remainingLane]

    const originalRemoveCells = graph.removeCells

    const dispose = swimlaneDelete.setupSwimlaneDelete(graph)

    graph.removeCells([{ id: 'task-1', shape: BPMN_USER_TASK, isNode: () => true }])
    graph.removeCells([createLaneNode('orphan', 0, 0, 10, 10, { parent: null })])
    graph.removeCells([deletedLane])

    expect(remainingLane.getPosition()).toEqual({ x: 70, y: 40 })
    expect(remainingLane.getSize()).toEqual({ width: 370, height: 300 })
    expect(originalRemoveCells).toHaveBeenCalledTimes(3)

    dispose()

    expect(typeof graph.removeCells).toBe('function')
  })

  it('关闭自动补偿时不应注册删除监听', () => {
    const graph = {
      removeCell: vi.fn(),
      removeCells: vi.fn(),
    } as any

    const originalRemoveCell = graph.removeCell
    const originalRemoveCells = graph.removeCells

    const dispose = swimlaneDelete.setupSwimlaneDelete(graph, { autoRedistribute: false })

    expect(graph.removeCell).toBe(originalRemoveCell)
    expect(graph.removeCells).toBe(originalRemoveCells)

    dispose()

    expect(graph.removeCell).toBe(originalRemoveCell)
    expect(graph.removeCells).toBe(originalRemoveCells)
  })

  it('应暴露贴边 Lane 查找与递归扩展逻辑', () => {
    const left = createLaneNode('left', 70, 40, 120, 200)
    const middle = createLaneNode('middle', 190, 40, 120, 200)
    const right = createLaneNode('right', 310, 40, 120, 200)

    expect(swimlaneDelete.__test__.findEdgeLane([left, middle, right], false, 'before')?.id).toBe('left')
    expect(swimlaneDelete.__test__.findEdgeLane([left, middle, right], false, 'after')?.id).toBe('right')

    swimlaneDelete.__test__.expandLaneEdge(left, false, 'before', 30)
    expect(left.getPosition()).toEqual({ x: 40, y: 40 })
    expect(left.getSize()).toEqual({ width: 150, height: 200 })

    const nestedLeft = createLaneNode('nested-left', 70, 40, 60, 200)
    const nestedRight = createLaneNode('nested-right', 130, 40, 60, 200)
    const parent = createLaneNode('parent', 70, 40, 120, 200, {
      children: [nestedLeft, nestedRight],
    })

    swimlaneDelete.__test__.expandLaneEdge(parent, false, 'after', 30)

    expect(parent.getSize()).toEqual({ width: 150, height: 200 })
    expect(nestedRight.getSize()).toEqual({ width: 90, height: 200 })
    expect(swimlaneDelete.__test__.findEdgeLane([], false, 'before')).toBeNull()
  })

  it('删除 Lane 时应按父节点属性与 Pool 包围盒回退解析删除父容器', () => {
    const pool = createLaneNode('pool', 40, 40, 400, 300)
    pool.shape = BPMN_POOL
    const laneFromProp = createLaneNode('lane-prop', 70, 40, 370, 100, {
      parent: null,
      data: { bpmn: { isHorizontal: true } },
    })
    ;(laneFromProp as any).getPropByPath = vi.fn(() => 'pool-1')

    const graphWithCellLookup = {
      getCellById: vi.fn(() => pool),
      getNodes: vi.fn(() => []),
    } as any

    expect(swimlaneDelete.__test__.resolveDeleteParent(graphWithCellLookup, laneFromProp, {
      x: 70,
      y: 40,
      width: 370,
      height: 100,
    })).toBe(pool)

    const laneFromLegacyProp = createLaneNode('lane-legacy-prop', 70, 40, 370, 100, {
      parent: null,
      data: { bpmn: { isHorizontal: true } },
    })
    ;(laneFromLegacyProp as any).getProp = vi.fn(() => 'pool-1')

    expect(swimlaneDelete.__test__.resolveDeleteParent(graphWithCellLookup, laneFromLegacyProp, {
      x: 70,
      y: 40,
      width: 370,
      height: 100,
    })).toBe(pool)

    const laneFromBounds = createLaneNode('lane-bounds', 70, 40, 370, 100, {
      parent: null,
      data: { bpmn: { isHorizontal: true } },
    })
    const graphWithPoolFallback = {
      getCellById: vi.fn(() => null),
      getNodes: vi.fn(() => [pool]),
    } as any

    expect(swimlaneDelete.__test__.containsDeletedLane(pool as any, {
      x: 70,
      y: 40,
      width: 370,
      height: 100,
    })).toBe(true)
    expect(swimlaneDelete.__test__.resolveDeleteParent(graphWithPoolFallback, laneFromBounds, {
      x: 70,
      y: 40,
      width: 370,
      height: 100,
    })).toBe(pool)

    const directParentLane = createLaneNode('lane-direct', 70, 40, 370, 100, {
      parent: pool,
      data: { bpmn: { isHorizontal: true } },
    })

    expect(swimlaneDelete.__test__.resolveDeleteParent(graphWithPoolFallback, directParentLane, {
      x: 70,
      y: 40,
      width: 370,
      height: 100,
    })).toBe(pool)
    expect(swimlaneDelete.__test__.containsDeletedLane(pool as any, {
      x: 10,
      y: 40,
      width: 370,
      height: 100,
    })).toBe(false)
  })

  it('删除 Lane 时应先将非 Lane 子节点重新挂到接收 Lane', () => {
    const pool = createLaneNode('pool', 40, 40, 400, 300)
    pool.shape = BPMN_POOL

    const deletedLane = createLaneNode('deleted', 70, 140, 370, 200, {
      parent: pool,
      data: { bpmn: { isHorizontal: true } },
    })
    const remainingLane = createLaneNode('remaining', 70, 40, 370, 100, {
      parent: pool,
      data: { bpmn: { isHorizontal: true } },
    })
    const gateway = createFlowNode('gateway', 'bpmn-exclusive-gateway', { parent: null })
    const task = createFlowNode('task', BPMN_USER_TASK, { parent: null })

    deletedLane.getChildren = () => [gateway, task]
    pool.getChildren = () => [remainingLane]
    remainingLane.embed = vi.fn((child: any) => {
      child.__setParent(remainingLane)
    })

    const graph = {
      removeCell: vi.fn(),
      removeCells: vi.fn(),
      startBatch: vi.fn(),
      stopBatch: vi.fn(),
      getNodes: vi.fn(() => [pool, remainingLane, gateway, task]),
      getCellById: vi.fn((id: string) => {
        if (id === remainingLane.id) return remainingLane
        if (id === pool.id) return pool
        return null
      }),
    } as any

    swimlaneDelete.setupSwimlaneDelete(graph)

    graph.removeCells([deletedLane])

    expect(remainingLane.embed).toHaveBeenCalledWith(gateway)
    expect(remainingLane.embed).toHaveBeenCalledWith(task)
    expect(gateway.getParent()).toBe(remainingLane)
    expect(task.getParent()).toBe(remainingLane)
  })

  it('删除最后一条 Lane 时应将非 Lane 子节点重新挂到 Pool', () => {
    const pool = createLaneNode('pool', 40, 40, 400, 300)
    pool.shape = BPMN_POOL

    const deletedLane = createLaneNode('deleted', 70, 40, 370, 260, {
      parent: pool,
      data: { bpmn: { isHorizontal: true } },
    })
    const task = createFlowNode('task', BPMN_USER_TASK, {
      parent: deletedLane,
      x: 150,
      y: 90,
      width: 100,
      height: 60,
    })

    deletedLane.getChildren = () => [task]
    pool.getChildren = () => [deletedLane]
    pool.embed = vi.fn((child: any) => {
      child.__setParent(pool)
    })

    const graph = {
      removeCell: vi.fn(),
      removeCells: vi.fn(),
      startBatch: vi.fn(),
      stopBatch: vi.fn(),
      getNodes: vi.fn(() => [pool, deletedLane, task]),
      getCellById: vi.fn((id: string) => {
        if (id === pool.id) return pool
        return null
      }),
    } as any

    swimlaneDelete.setupSwimlaneDelete(graph)

    graph.removeCells([deletedLane])

    expect(pool.embed).toHaveBeenCalledWith(task)
    expect(task.getParent()).toBe(pool)
    expect(task.getPosition()).toEqual({ x: 150, y: 90 })
  })

  it('删除首个 Lane 时不应让迁入节点跟随接收 Lane 的首边位移再次漂移', () => {
    const pool = createLaneNode('pool', 40, 40, 400, 300)
    pool.shape = BPMN_POOL

    const deletedLane = createLaneNode('deleted-top', 70, 40, 370, 100, {
      parent: pool,
      data: { bpmn: { isHorizontal: true } },
    })
    const remainingLane = createLaneNode('remaining-bottom', 70, 140, 370, 200, {
      parent: pool,
      data: { bpmn: { isHorizontal: true } },
    })
    const migratedTask = createFlowNode('migrated-task', BPMN_USER_TASK, {
      parent: deletedLane,
      x: 210,
      y: 105,
      width: 100,
      height: 60,
    })
    const nativeTask = createFlowNode('native-task', BPMN_USER_TASK, {
      parent: null,
      x: 470,
      y: 290,
      width: 100,
      height: 60,
    })

    deletedLane.getChildren = () => [migratedTask]
    pool.getChildren = () => [deletedLane, remainingLane]
    remainingLane.embed(nativeTask)

    const graph = {
      removeCell: vi.fn(),
      removeCells: vi.fn(),
      startBatch: vi.fn(),
      stopBatch: vi.fn(),
      getNodes: vi.fn(() => [pool, remainingLane, migratedTask, nativeTask]),
      getCellById: vi.fn((id: string) => {
        if (id === remainingLane.id) return remainingLane
        if (id === pool.id) return pool
        return null
      }),
    } as any

    swimlaneDelete.setupSwimlaneDelete(graph)

    graph.removeCells([deletedLane])

    expect(remainingLane.getPosition()).toEqual({ x: 70, y: 40 })
    expect(nativeTask.getPosition()).toEqual({ x: 470, y: 190 })
    expect(migratedTask.getParent()).toBe(remainingLane)
    expect(migratedTask.getPosition()).toEqual({ x: 210, y: 105 })
  })

  it('删除首个 Lane 且同侧仍有多条 Lane 时只应调整紧邻 Lane', () => {
    const pool = createLaneNode('pool', 40, 40, 400, 525)
    pool.shape = BPMN_POOL

    const deletedLane = createLaneNode('deleted', 70, 40, 370, 200, {
      parent: pool,
      data: { bpmn: { isHorizontal: true } },
    })
    const adjacentLane = createLaneNode('adjacent', 70, 240, 370, 200, {
      parent: pool,
      data: { bpmn: { isHorizontal: true } },
    })
    const fartherLane = createLaneNode('farther', 70, 440, 370, 125, {
      parent: pool,
      data: { bpmn: { isHorizontal: true } },
    })

    pool.getChildren = () => [deletedLane, adjacentLane, fartherLane]

    const graph = {
      startBatch: vi.fn(),
      stopBatch: vi.fn(),
      getCellById: vi.fn(() => null),
      getNodes: vi.fn(() => [pool, deletedLane, adjacentLane, fartherLane]),
    } as any

    swimlaneDelete.__test__.prepareLaneDelete(graph, deletedLane)

    expect(adjacentLane.getPosition()).toEqual({ x: 70, y: 40 })
    expect(adjacentLane.getSize()).toEqual({ width: 370, height: 400 })
    expect(fartherLane.getPosition()).toEqual({ x: 70, y: 440 })
    expect(fartherLane.getSize()).toEqual({ width: 370, height: 125 })
  })

  it('应拦截 graph.removeCell 以支持单节点删除入口', () => {
    const pool = createLaneNode('pool', 40, 40, 400, 300)
    pool.shape = BPMN_POOL
    const deletedLane = createLaneNode('deleted', 70, 140, 370, 200, {
      parent: pool,
      data: { bpmn: { isHorizontal: true } },
    })
    const remainingLane = createLaneNode('remaining', 70, 40, 370, 100, {
      parent: pool,
      data: { bpmn: { isHorizontal: true } },
    })
    const gateway = createFlowNode('gateway', 'bpmn-exclusive-gateway', { parent: deletedLane })

    deletedLane.getChildren = () => [gateway]
    pool.getChildren = () => [remainingLane]
    remainingLane.embed = vi.fn((child: any) => {
      child.__setParent(remainingLane)
    })

    const graph = {
      removeCell: vi.fn(),
      removeCells: vi.fn(),
      startBatch: vi.fn(),
      stopBatch: vi.fn(),
      getNodes: vi.fn(() => [pool, remainingLane, gateway]),
      getCellById: vi.fn((id: string) => {
        if (id === remainingLane.id) return remainingLane
        if (id === pool.id) return pool
        return null
      }),
    } as any

    swimlaneDelete.setupSwimlaneDelete(graph)

    graph.removeCell(deletedLane)

    expect(remainingLane.embed).toHaveBeenCalledWith(gateway)
    expect(gateway.getParent()).toBe(remainingLane)
  })

  it('应支持通过字符串 id 删除单个 Lane', () => {
    const pool = createLaneNode('pool', 40, 40, 400, 300)
    pool.shape = BPMN_POOL
    const deletedLane = createLaneNode('deleted', 70, 140, 370, 200, {
      parent: pool,
      data: { bpmn: { isHorizontal: true } },
    })
    const remainingLane = createLaneNode('remaining', 70, 40, 370, 100, {
      parent: pool,
      data: { bpmn: { isHorizontal: true } },
    })
    const task = createFlowNode('task', BPMN_USER_TASK, { parent: deletedLane })

    deletedLane.getChildren = () => [task]
    pool.getChildren = () => [remainingLane]
    remainingLane.embed = vi.fn((child: any) => {
      child.__setParent(remainingLane)
    })

    const originalRemoveCell = vi.fn()
    const graph = {
      removeCell: originalRemoveCell,
      removeCells: vi.fn(),
      startBatch: vi.fn(),
      stopBatch: vi.fn(),
      getNodes: vi.fn(() => [pool, remainingLane, task]),
      getCellById: vi.fn((id: string) => {
        if (id === deletedLane.id) return deletedLane
        if (id === remainingLane.id) return remainingLane
        if (id === pool.id) return pool
        return null
      }),
    } as any

    swimlaneDelete.setupSwimlaneDelete(graph)

    graph.removeCell(deletedLane.id)

    expect(remainingLane.embed).toHaveBeenCalledWith(task)
    expect(task.getParent()).toBe(remainingLane)
    expect(originalRemoveCell).toHaveBeenCalledWith(deletedLane.id, {})
  })

  it('应支持在批量删除时通过字符串 id 预处理 Lane', () => {
    const pool = createLaneNode('pool', 40, 40, 400, 300)
    pool.shape = BPMN_POOL
    const deletedLane = createLaneNode('deleted', 70, 140, 370, 200, {
      parent: pool,
      data: { bpmn: { isHorizontal: true } },
    })
    const remainingLane = createLaneNode('remaining', 70, 40, 370, 100, {
      parent: pool,
      data: { bpmn: { isHorizontal: true } },
    })
    const task = createFlowNode('task', BPMN_USER_TASK, { parent: deletedLane })

    deletedLane.getChildren = () => [task]
    pool.getChildren = () => [remainingLane]
    remainingLane.embed = vi.fn((child: any) => {
      child.__setParent(remainingLane)
    })

    const originalRemoveCells = vi.fn()
    const graph = {
      removeCell: vi.fn(),
      removeCells: originalRemoveCells,
      startBatch: vi.fn(),
      stopBatch: vi.fn(),
      getNodes: vi.fn(() => [pool, remainingLane, task]),
      getCellById: vi.fn((id: string) => {
        if (id === deletedLane.id) return deletedLane
        if (id === remainingLane.id) return remainingLane
        if (id === pool.id) return pool
        return null
      }),
    } as any

    swimlaneDelete.setupSwimlaneDelete(graph)

    graph.removeCells([deletedLane.id])

    expect(remainingLane.embed).toHaveBeenCalledWith(task)
    expect(task.getParent()).toBe(remainingLane)
    expect(originalRemoveCells).toHaveBeenCalledWith([deletedLane.id], {})
  })

  it('删除 Pool 时应强制深删其 Lane 与内部任务', () => {
    const graph = createBehaviorTestGraph()
    const disposeDelete = swimlaneDelete.setupSwimlaneDelete(graph)

    const pool = graph.addNode({
      id: 'pool-force-deep',
      shape: BPMN_POOL,
      x: 40,
      y: 40,
      width: 400,
      height: 240,
      attrs: { headerLabel: { text: '主泳池' } },
      data: { bpmn: { isHorizontal: true } },
    })
    const lane = graph.addNode({
      id: 'lane-force-deep',
      shape: BPMN_LANE,
      x: 70,
      y: 40,
      width: 370,
      height: 240,
      parent: pool.id,
      attrs: { headerLabel: { text: '泳道 A' } },
      data: { bpmn: { isHorizontal: true } },
    })
    const task = graph.addNode({
      id: 'task-force-deep',
      shape: BPMN_USER_TASK,
      x: 150,
      y: 110,
      width: 100,
      height: 60,
      parent: lane.id,
    })

    pool.embed(lane)
    lane.embed(task)

    graph.removeCell(pool, { deep: false })

    expect(graph.getCellById(pool.id)).toBeNull()
    expect(graph.getCellById(lane.id)).toBeNull()
    expect(graph.getCellById(task.id)).toBeNull()

    disposeDelete()
    destroyBehaviorTestGraph(graph)
  })

  it('默认删除 Pool 时也应显式展开其 Lane 与内部任务', () => {
    const graph = createBehaviorTestGraph()
    const disposeDelete = swimlaneDelete.setupSwimlaneDelete(graph)

    const pool = graph.addNode({
      id: 'pool-force-default',
      shape: BPMN_POOL,
      x: 40,
      y: 40,
      width: 400,
      height: 240,
      attrs: { headerLabel: { text: '主泳池' } },
      data: { bpmn: { isHorizontal: true } },
    })
    const lane = graph.addNode({
      id: 'lane-force-default',
      shape: BPMN_LANE,
      x: 70,
      y: 40,
      width: 370,
      height: 240,
      parent: pool.id,
      attrs: { headerLabel: { text: '泳道 A' } },
      data: { bpmn: { isHorizontal: true } },
    })
    const task = graph.addNode({
      id: 'task-force-default',
      shape: BPMN_USER_TASK,
      x: 150,
      y: 110,
      width: 100,
      height: 60,
      parent: lane.id,
    })

    pool.embed(lane)
    lane.embed(task)

    graph.removeCell(pool)

    expect(graph.getCellById(pool.id)).toBeNull()
    expect(graph.getCellById(lane.id)).toBeNull()
    expect(graph.getCellById(task.id)).toBeNull()

    disposeDelete()
    destroyBehaviorTestGraph(graph)
  })

  it('批量删除 Pool 时应强制深删其 Lane 与内部任务', () => {
    const graph = createBehaviorTestGraph()
    const disposeDelete = swimlaneDelete.setupSwimlaneDelete(graph)

    const pool = graph.addNode({
      id: 'pool-force-deep-batch',
      shape: BPMN_POOL,
      x: 40,
      y: 40,
      width: 400,
      height: 240,
      attrs: { headerLabel: { text: '主泳池' } },
      data: { bpmn: { isHorizontal: true } },
    })
    const lane = graph.addNode({
      id: 'lane-force-deep-batch',
      shape: BPMN_LANE,
      x: 70,
      y: 40,
      width: 370,
      height: 240,
      parent: pool.id,
      attrs: { headerLabel: { text: '泳道 A' } },
      data: { bpmn: { isHorizontal: true } },
    })
    const task = graph.addNode({
      id: 'task-force-deep-batch',
      shape: BPMN_USER_TASK,
      x: 150,
      y: 110,
      width: 100,
      height: 60,
      parent: lane.id,
    })

    pool.embed(lane)
    lane.embed(task)

    graph.removeCells([pool], { deep: false })

    expect(graph.getCellById(pool.id)).toBeNull()
    expect(graph.getCellById(lane.id)).toBeNull()
    expect(graph.getCellById(task.id)).toBeNull()

    disposeDelete()
    destroyBehaviorTestGraph(graph)
  })

  it('默认批量删除 Pool 时也应显式展开其 Lane 与内部任务', () => {
    const graph = createBehaviorTestGraph()
    const disposeDelete = swimlaneDelete.setupSwimlaneDelete(graph)

    const pool = graph.addNode({
      id: 'pool-force-default-batch',
      shape: BPMN_POOL,
      x: 40,
      y: 40,
      width: 400,
      height: 240,
      attrs: { headerLabel: { text: '主泳池' } },
      data: { bpmn: { isHorizontal: true } },
    })
    const lane = graph.addNode({
      id: 'lane-force-default-batch',
      shape: BPMN_LANE,
      x: 70,
      y: 40,
      width: 370,
      height: 240,
      parent: pool.id,
      attrs: { headerLabel: { text: '泳道 A' } },
      data: { bpmn: { isHorizontal: true } },
    })
    const task = graph.addNode({
      id: 'task-force-default-batch',
      shape: BPMN_USER_TASK,
      x: 150,
      y: 110,
      width: 100,
      height: 60,
      parent: lane.id,
    })

    pool.embed(lane)
    lane.embed(task)

    graph.removeCells([pool])

    expect(graph.getCellById(pool.id)).toBeNull()
    expect(graph.getCellById(lane.id)).toBeNull()
    expect(graph.getCellById(task.id)).toBeNull()

    disposeDelete()
    destroyBehaviorTestGraph(graph)
  })

  it('应按前后接收方与兜底容器解析迁移目标', () => {
    const beforeLane = createLaneNode('before', 70, 40, 370, 100)
    const afterLane = createLaneNode('after', 70, 260, 370, 100)
    const fallbackPool = createLaneNode('pool', 40, 40, 400, 320)
    fallbackPool.shape = BPMN_POOL
    const upperTask = createFlowNode('upper-task', BPMN_USER_TASK, { x: 120, y: 120, height: 40 })
    const lowerTask = createFlowNode('lower-task', BPMN_USER_TASK, { x: 120, y: 220, height: 40 })
    const graph = {
      getCellById: vi.fn((id: string) => {
        if (id === beforeLane.id) return beforeLane
        if (id === afterLane.id) return afterLane
        if (id === fallbackPool.id) return fallbackPool
        return null
      }),
    } as any

    expect(swimlaneDelete.__test__.resolveMigrationRecipient(graph, upperTask as any, {
      deletedLaneId: 'deleted',
      deletedBounds: { x: 70, y: 100, width: 370, height: 120 },
      isHorizontal: true,
      beforeRecipientId: beforeLane.id,
      afterRecipientId: null,
      fallbackRecipientId: fallbackPool.id,
    })).toBe(beforeLane)

    expect(swimlaneDelete.__test__.resolveMigrationRecipient(graph, lowerTask as any, {
      deletedLaneId: 'deleted',
      deletedBounds: { x: 70, y: 100, width: 370, height: 120 },
      isHorizontal: true,
      beforeRecipientId: null,
      afterRecipientId: afterLane.id,
      fallbackRecipientId: fallbackPool.id,
    })).toBe(afterLane)

    expect(swimlaneDelete.__test__.resolveMigrationRecipient(graph, upperTask as any, {
      deletedLaneId: 'deleted',
      deletedBounds: { x: 70, y: 100, width: 370, height: 120 },
      isHorizontal: true,
      beforeRecipientId: null,
      afterRecipientId: null,
      fallbackRecipientId: fallbackPool.id,
    })).toBe(fallbackPool)

    expect(swimlaneDelete.__test__.resolveMigrationRecipient(graph, upperTask as any, {
      deletedLaneId: 'deleted',
      deletedBounds: { x: 70, y: 100, width: 370, height: 120 },
      isHorizontal: true,
      beforeRecipientId: beforeLane.id,
      afterRecipientId: afterLane.id,
      fallbackRecipientId: fallbackPool.id,
    })).toBe(beforeLane)

    expect(swimlaneDelete.__test__.resolveMigrationRecipient(graph, lowerTask as any, {
      deletedLaneId: 'deleted',
      deletedBounds: { x: 70, y: 100, width: 370, height: 120 },
      isHorizontal: true,
      beforeRecipientId: beforeLane.id,
      afterRecipientId: afterLane.id,
      fallbackRecipientId: fallbackPool.id,
    })).toBe(afterLane)

    expect(swimlaneDelete.__test__.resolveMigrationRecipient(graph, lowerTask as any, {
      deletedLaneId: 'deleted',
      deletedBounds: { x: 70, y: 100, width: 370, height: 120 },
      isHorizontal: true,
      beforeRecipientId: 'missing-before',
      afterRecipientId: 'missing-after',
      fallbackRecipientId: fallbackPool.id,
    })).toBe(fallbackPool)
  })

  it('回挂子节点时应支持 addChild 回退并吞掉宿主瞬时异常', () => {
    const task = createFlowNode('task', BPMN_USER_TASK)
    const parentWithAddChild = {
      addChild: vi.fn((child: any) => {
        child.__setParent(parentWithAddChild)
      }),
    } as any

    swimlaneDelete.__test__.reparentNodeToContainer(task as any, parentWithAddChild)

    expect(parentWithAddChild.addChild).toHaveBeenCalledWith(task)
    expect(task.getParent()).toBe(parentWithAddChild)

    const parentWithEmbedError = {
      embed: vi.fn(() => {
        throw new Error('transient host cleanup error')
      }),
    } as any

    expect(() => swimlaneDelete.__test__.reparentNodeToContainer(task as any, parentWithEmbedError)).not.toThrow()
  })

  it('真实图模型下新增第三条 Lane 后删除首个 Lane 时只应调整紧邻 Lane', () => {
    const graph = createBehaviorTestGraph()
    const disposeDelete = swimlaneDelete.setupSwimlaneDelete(graph)
    const disposeContainment = setupPoolContainment(graph)

    const pool = graph.addNode({
      id: 'pool-1',
      shape: BPMN_POOL,
      x: 40,
      y: 40,
      width: 400,
      height: 400,
      attrs: { headerLabel: { text: '审批流程' } },
      data: { bpmn: { isHorizontal: true } },
    })
    const lane1 = graph.addNode({
      id: 'lane-1',
      shape: BPMN_LANE,
      x: 70,
      y: 40,
      width: 370,
      height: 200,
      parent: pool.id,
      attrs: { headerLabel: { text: '申请人' } },
      data: { bpmn: { isHorizontal: true } },
    })
    const lane2 = graph.addNode({
      id: 'lane-2',
      shape: BPMN_LANE,
      x: 70,
      y: 240,
      width: 370,
      height: 200,
      parent: pool.id,
      attrs: { headerLabel: { text: '审批人' } },
      data: { bpmn: { isHorizontal: true } },
    })

    pool.embed(lane1)
    pool.embed(lane2)

    const lane3 = addLaneToPool(graph, pool, { label: '新泳道' })

    expect(lane3).not.toBeNull()

    const deletedLaneBeforeDelete = {
      y: lane1.getPosition().y,
      height: lane1.getSize().height,
    }
    const adjacentLaneBeforeDelete = {
      y: lane2.getPosition().y,
      height: lane2.getSize().height,
    }
    const fartherLaneBeforeDelete = {
      y: lane3!.getPosition().y,
      height: lane3!.getSize().height,
    }

    graph.removeCells([lane1])

    expect(lane2.getParent()?.id).toBe(pool.id)
    expect(lane3!.getParent()?.id).toBe(pool.id)
    expect(lane2.getPosition().y).toBe(deletedLaneBeforeDelete.y)
    expect(lane2.getSize().height).toBe(
      adjacentLaneBeforeDelete.height + deletedLaneBeforeDelete.height,
    )
    expect(lane3!.getPosition().y).toBe(fartherLaneBeforeDelete.y)
    expect(lane3!.getSize().height).toBe(fartherLaneBeforeDelete.height)

    disposeContainment()
    disposeDelete()
    destroyBehaviorTestGraph(graph)
  })
})