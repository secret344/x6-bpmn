/**
 * Pool / Participant 容器约束行为 — 单元测试
 */

import { describe, it, expect, vi } from 'vitest'
import {
  setupPoolContainment,
  validatePoolContainment,
  findContainingSwimlane,
  getSwimlaneAncestor,
  isContainedFlowNode,
} from '../../../src/behaviors/pool-containment'
import { attachBoundaryToHost } from '../../../src/behaviors/boundary-attach'
import { distanceToRectEdge } from '../../../src/behaviors/geometry'
import {
  createBehaviorTestGraph,
  destroyBehaviorTestGraph,
  dragNodeLinearly,
  emitGraphEvent,
  getNodeCenter,
  getNodeRect,
  registerBehaviorTestShapes,
} from '../../helpers/behavior-test-graph'
import {
  BPMN_BOUNDARY_EVENT_TIMER,
  BPMN_LANE,
  BPMN_POOL,
  BPMN_USER_TASK,
} from '../../../src/utils/constants'

function createMockNode(id: string, shape: string, x: number, y: number, width: number, height: number) {
  let position = { x, y }
  let size = { width, height }
  let parent: any = null
  let removed = false

  const self: any = {
    id,
    shape,
    getPosition: () => ({ ...position }),
    getSize: () => ({ ...size }),
    setPosition: vi.fn((nextX: number, nextY: number) => {
      position = { x: nextX, y: nextY }
    }),
    resize: vi.fn((nextWidth: number, nextHeight: number) => {
      size = { width: nextWidth, height: nextHeight }
    }),
    setSize: vi.fn((nextWidth: number, nextHeight: number) => {
      size = { width: nextWidth, height: nextHeight }
    }),
    getParent: () => parent,
    embed: vi.fn((child: any) => {
      child.__setParent(self)
    }),
    unembed: vi.fn((child: any) => {
      child.__setParent(null)
    }),
    remove: vi.fn(() => {
      removed = true
    }),
    isNode: () => true,
    __setParent: (nextParent: any) => {
      parent = nextParent
    },
    __isRemoved: () => removed,
  }

  return self
}

function createMockGraph(nodes: any[] = []) {
  const handlers: Record<string, Function[]> = {}
  const modelHandlers: Record<string, Function[]> = {}
  return {
    getNodes: () => nodes,
    on: (event: string, fn: Function) => {
      handlers[event] = handlers[event] || []
      handlers[event].push(fn)
    },
    off: (event: string, fn: Function) => {
      handlers[event] = (handlers[event] || []).filter((handler) => handler !== fn)
    },
    emit: (event: string, data: any) => {
      for (const fn of handlers[event] || []) fn(data)
    },
    model: {
      on: (event: string, fn: Function) => {
        modelHandlers[event] = modelHandlers[event] || []
        modelHandlers[event].push(fn)
      },
      off: (event: string, fn: Function) => {
        modelHandlers[event] = (modelHandlers[event] || []).filter((handler) => handler !== fn)
      },
      emit: (event: string, data: any) => {
        for (const fn of modelHandlers[event] || []) fn(data)
      },
    },
    _handlers: handlers,
    _modelHandlers: modelHandlers,
  } as any
}

function createMockDocument() {
  const handlers: Record<string, Function[]> = {}

  return {
    addEventListener: vi.fn((event: string, fn: Function) => {
      handlers[event] = handlers[event] || []
      handlers[event].push(fn)
    }),
    removeEventListener: vi.fn((event: string, fn: Function) => {
      handlers[event] = (handlers[event] || []).filter((handler) => handler !== fn)
    }),
    dispatchEvent: (event: { type: string }) => {
      for (const fn of handlers[event.type] || []) fn(event)
    },
  }
}

function createCascadeNode(id: string, shape: string, x: number, y: number, width: number, height: number) {
  let position = { x, y }
  let size = { width, height }
  let parent: any = null
  const children: any[] = []

  const self: any = {
    id,
    shape,
    getPosition: () => ({ ...position }),
    getSize: () => ({ ...size }),
    setPosition: vi.fn((nextX: number, nextY: number) => {
      position = { x: nextX, y: nextY }
    }),
    resize: vi.fn((nextWidth: number, nextHeight: number) => {
      size = { width: nextWidth, height: nextHeight }
    }),
    translate: vi.fn((deltaX: number, deltaY: number) => {
      position = { x: position.x + deltaX, y: position.y + deltaY }
      for (const child of children) {
        if (typeof child.translate === 'function') {
          child.translate(deltaX, deltaY)
        } else {
          const childPosition = child.getPosition()
          child.setPosition(childPosition.x + deltaX, childPosition.y + deltaY)
        }
      }
    }),
    getParent: () => parent,
    embed: vi.fn((child: any) => {
      if (!children.includes(child)) {
        children.push(child)
      }
      child.__setParent(self)
    }),
    unembed: vi.fn((child: any) => {
      const index = children.indexOf(child)
      if (index >= 0) {
        children.splice(index, 1)
      }
      child.__setParent(null)
    }),
    remove: vi.fn(),
    isNode: () => true,
    __setParent: (nextParent: any) => {
      parent = nextParent
    },
  }

  return self
}

function dragNodeByPositionLinearly(
  graph: Graph,
  node: Node,
  delta: { x: number; y: number },
  steps = 8,
): void {
  const stepCount = Math.max(1, steps)
  const stepX = delta.x / stepCount
  const stepY = delta.y / stepCount

  for (let index = 0; index < stepCount; index += 1) {
    const position = node.getPosition()
    node.setPosition(position.x + stepX, position.y + stepY, { ui: true })
    emitGraphEvent(graph, 'node:moving', { node, options: { ui: true } })
  }

  emitGraphEvent(graph, 'node:moved', { node, options: { ui: true } })
}

describe('isContainedFlowNode', () => {
  it('普通流程节点应受容器约束', () => {
    expect(isContainedFlowNode('bpmn-user-task')).toBe(true)
  })

  it('边界事件应交由附着行为处理，不应在初始化时被容器约束移除', () => {
    expect(isContainedFlowNode('bpmn-boundary-event-timer')).toBe(false)
  })

  it('泳道节点不受容器约束', () => {
    expect(isContainedFlowNode('bpmn-pool')).toBe(false)
    expect(isContainedFlowNode('bpmn-lane')).toBe(false)
  })
})

describe('findContainingSwimlane', () => {
  it('应优先返回面积更小的 Lane', () => {
    const pool = createMockNode('pool', 'bpmn-pool', 0, 0, 400, 240)
    const lane = createMockNode('lane', 'bpmn-lane', 40, 0, 360, 120)
    const graph = createMockGraph([pool, lane])

    const container = findContainingSwimlane(graph, { x: 100, y: 20, width: 80, height: 40 })
    expect(container?.id).toBe('lane')
  })

  it('未命中任何泳道容器时应返回 null', () => {
    const pool = createMockNode('pool', 'bpmn-pool', 0, 0, 400, 240)
    const graph = createMockGraph([pool])

    const container = findContainingSwimlane(graph, { x: 420, y: 260, width: 80, height: 40 })
    expect(container).toBeNull()
  })

  it('传入 Node 目标时也应正常解析包围盒', () => {
    const pool = createMockNode('pool', 'bpmn-pool', 0, 0, 400, 240)
    const lane = createMockNode('lane', 'bpmn-lane', 40, 0, 360, 120)
    const task = createMockNode('task', 'bpmn-user-task', 100, 20, 80, 40)
    const graph = createMockGraph([pool, lane, task])

    const container = findContainingSwimlane(graph, task)
    expect(container?.id).toBe('lane')
  })

  it('Pool 下存在归属该 Pool 的 Lane 时，命中 Pool 空白区仍应返回 Pool', () => {
    const pool = createMockNode('pool', 'bpmn-pool', 0, 0, 400, 240)
    const lane = createMockNode('lane', 'bpmn-lane', 40, 0, 360, 120)
    lane.__setParent(pool)
    const graph = createMockGraph([pool, lane])

    const container = findContainingSwimlane(graph, { x: 60, y: 140, width: 80, height: 40 })
    expect(container?.id).toBe('pool')
  })

  it('孤立 Lane 不应阻止返回 Pool 容器', () => {
    const pool = createMockNode('pool', 'bpmn-pool', 0, 0, 400, 240)
    const detachedLane = createMockNode('lane', 'bpmn-lane', 40, 0, 360, 120)
    const graph = createMockGraph([pool, detachedLane])

    const container = findContainingSwimlane(graph, { x: 60, y: 140, width: 80, height: 40 })
    expect(container?.id).toBe('pool')
  })

  it('嵌套但未归属 Pool 的 Lane 链，不应阻止返回 Pool 容器', () => {
    const pool = createMockNode('pool', 'bpmn-pool', 0, 0, 400, 240)
    const outerLane = createMockNode('outer-lane', 'bpmn-lane', 40, 0, 360, 180)
    const innerLane = createMockNode('inner-lane', 'bpmn-lane', 80, 0, 320, 120)
    innerLane.__setParent(outerLane)
    const graph = createMockGraph([pool, outerLane, innerLane])

    const container = findContainingSwimlane(graph, { x: 60, y: 190, width: 80, height: 40 })
    expect(container?.id).toBe('pool')
  })

  it('Pool 下的嵌套 Lane 链存在时，命中 Pool 空白区仍应回落到 Pool', () => {
    const pool = createMockNode('pool', 'bpmn-pool', 0, 0, 400, 240)
    const outerLane = createMockNode('outer-lane', 'bpmn-lane', 40, 0, 360, 180)
    const innerLane = createMockNode('inner-lane', 'bpmn-lane', 80, 0, 320, 120)
    outerLane.__setParent(pool)
    innerLane.__setParent(outerLane)
    const graph = createMockGraph([pool, outerLane, innerLane])

    const container = findContainingSwimlane(graph, { x: 60, y: 190, width: 80, height: 40 })
    expect(container?.id).toBe('pool')
  })

  it('排除当前 Lane 自身后，应回落到外层 Pool', () => {
    const pool = createMockNode('pool', 'bpmn-pool', 0, 0, 400, 240)
    const lane = createMockNode('lane', 'bpmn-lane', 40, 0, 360, 120)
    lane.__setParent(pool)
    const graph = createMockGraph([pool, lane])

    const container = findContainingSwimlane(graph, { x: 60, y: 20, width: 320, height: 120 }, lane.id)
    expect(container?.id).toBe('pool')
  })

  it('首次命中 Pool 后不应再做额外图遍历', () => {
    const pool = createMockNode('pool', 'bpmn-pool', 0, 0, 400, 240)
    const graph = {
      getNodes: vi
        .fn<() => any[]>()
        .mockReturnValueOnce([pool])
        .mockImplementationOnce(() => {
          throw new Error('mock lane lookup error')
        }),
    } as any

    const container = findContainingSwimlane(graph, { x: 60, y: 140, width: 80, height: 40 })
    expect(container?.id).toBe('pool')
    expect(graph.getNodes).toHaveBeenCalledTimes(1)
  })
})

describe('getSwimlaneAncestor', () => {
  it('应沿父链返回最近的泳道祖先', () => {
    const pool = createMockNode('pool', 'bpmn-pool', 0, 0, 400, 240)
    const lane = createMockNode('lane', 'bpmn-lane', 40, 0, 360, 120)
    const task = createMockNode('task', 'bpmn-user-task', 100, 20, 100, 60)
    lane.__setParent(pool)
    task.__setParent(lane)

    expect(getSwimlaneAncestor(task)?.id).toBe('lane')
  })

  it('无泳道祖先时应返回 null', () => {
    const task = createMockNode('task', 'bpmn-user-task', 100, 20, 100, 60)
    expect(getSwimlaneAncestor(task)).toBeNull()
  })

  it('中间父节点不是 Node 时应继续向上查找', () => {
    const pool = createMockNode('pool', 'bpmn-pool', 0, 0, 400, 240)
    const foreignParent = {
      shape: 'foreign-cell',
      isNode: () => false,
      getParent: () => pool,
    }
    const task = createMockNode('task', 'bpmn-user-task', 100, 20, 100, 60)
    task.__setParent(foreignParent)

    expect(getSwimlaneAncestor(task)?.id).toBe('pool')
  })
})

describe('validatePoolContainment', () => {
  it('无 Pool 时应直接通过', () => {
    const task = createMockNode('task', 'bpmn-user-task', 100, 20, 100, 60)
    const graph = createMockGraph([task])

    expect(validatePoolContainment(graph, task).valid).toBe(true)
  })

  it('已在所属 Lane 内时应通过', () => {
    const pool = createMockNode('pool', 'bpmn-pool', 0, 0, 400, 240)
    const lane = createMockNode('lane', 'bpmn-lane', 40, 0, 360, 120)
    const task = createMockNode('task', 'bpmn-user-task', 100, 20, 100, 60)
    lane.__setParent(pool)
    task.__setParent(lane)
    const graph = createMockGraph([pool, lane, task])

    const result = validatePoolContainment(graph, task)
    expect(result.valid).toBe(true)
    expect(result.container?.id).toBe('lane')
  })

  it('Pool 下存在 Lane 时，直接挂在 Pool 且位于 Pool 空白区的节点仍应通过', () => {
    const pool = createMockNode('pool', 'bpmn-pool', 0, 0, 400, 240)
    const lane = createMockNode('lane', 'bpmn-lane', 40, 0, 360, 120)
    const task = createMockNode('task', 'bpmn-user-task', 60, 140, 100, 60)
    lane.__setParent(pool)
    task.__setParent(pool)
    const graph = createMockGraph([pool, lane, task])

    const result = validatePoolContainment(graph, task)
    expect(result.valid).toBe(true)
    expect(result.container?.id).toBe('pool')
  })

  it('祖先泳道暂未出现在图节点列表时，应回退为沿用当前祖先容器', () => {
    const offscreenPool = createMockNode('pool', 'bpmn-pool', 600, 400, 200, 120)
    const lane = createMockNode('lane', 'bpmn-lane', 40, 0, 360, 120)
    const task = createMockNode('task', 'bpmn-user-task', 100, 20, 100, 60)
    lane.__setParent(offscreenPool)
    task.__setParent(lane)
    const graph = createMockGraph([offscreenPool, task])

    const result = validatePoolContainment(graph, task)
    expect(result.valid).toBe(true)
    expect(result.container?.id).toBe('lane')
  })

  it('未设置 parent 但位于泳道内部时应返回建议容器', () => {
    const pool = createMockNode('pool', 'bpmn-pool', 0, 0, 400, 240)
    const lane = createMockNode('lane', 'bpmn-lane', 40, 0, 360, 120)
    const task = createMockNode('task', 'bpmn-user-task', 100, 20, 100, 60)
    const graph = createMockGraph([pool, lane, task])

    const result = validatePoolContainment(graph, task)
    expect(result.valid).toBe(true)
    expect(result.container?.id).toBe('lane')
  })

  it('Lane 未附着但位于 Pool 内时，应返回 Pool 作为建议容器', () => {
    const pool = createMockNode('pool', 'bpmn-pool', 0, 0, 400, 240)
    const lane = createMockNode('lane', 'bpmn-lane', 40, 0, 360, 120)
    const graph = createMockGraph([pool, lane])

    const result = validatePoolContainment(graph, lane)
    expect(result.valid).toBe(true)
    expect(result.container?.id).toBe('pool')
  })

  it('已归属 Pool 的 Lane 被拖入另一 Pool 时应判定为非法', () => {
    // 规范依据：formal-11-01-03.pdf §9.2.2、§10.7。
    // Lane 是 Process 内的分区，并包含在 LaneSet / Process 中，不应通过普通拖拽跨 Pool 改变归属。
    const poolA = createMockNode('pool-a', 'bpmn-pool', 0, 0, 400, 240)
    const poolB = createMockNode('pool-b', 'bpmn-pool', 520, 0, 400, 240)
    const lane = createMockNode('lane', 'bpmn-lane', 560, 0, 320, 120)
    lane.__setParent(poolA)
    const graph = createMockGraph([poolA, poolB, lane])

    const result = validatePoolContainment(graph, lane)
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('泳道')
  })

  it('Pool 与其他 Pool 重叠时应判定为非法', () => {
    const poolA = createMockNode('pool-a', 'bpmn-pool', 0, 0, 400, 240)
    const poolB = createMockNode('pool-b', 'bpmn-pool', 280, 40, 400, 240)
    const graph = createMockGraph([poolA, poolB])

    const result = validatePoolContainment(graph, poolB)

    expect(result.valid).toBe(false)
    expect(result.reason).toContain('Pool')
  })

  it('Pool 碰撞检测读取图节点失败时，应退化为不阻断当前校验', () => {
    const poolA = createMockNode('pool-a', 'bpmn-pool', 0, 0, 400, 240)
    const poolB = createMockNode('pool-b', 'bpmn-pool', 280, 40, 400, 240)
    const nodes = [poolA, poolB]
    const graph = createMockGraph(nodes) as ReturnType<typeof createMockGraph> & {
      getNodes: () => typeof nodes
    }
    let getNodesCall = 0
    graph.getNodes = () => {
      getNodesCall += 1
      if (getNodesCall === 2) {
        throw new Error('boom')
      }
      return nodes
    }

    const result = validatePoolContainment(graph, poolB)

    expect(result).toEqual({ valid: true })
  })

  it('Lane 所属 Pool 暂未出现在图节点列表时，应回退为沿用所属 Pool', () => {
    const offscreenPool = createMockNode('pool', 'bpmn-pool', 0, 0, 400, 240)
    const visiblePool = createMockNode('visible-pool', 'bpmn-pool', 520, 0, 400, 240)
    const lane = createMockNode('lane', 'bpmn-lane', 40, 0, 360, 120)
    lane.__setParent(offscreenPool)
    const graph = createMockGraph([visiblePool, lane])

    const result = validatePoolContainment(graph, lane)
    expect(result.valid).toBe(true)
    expect(result.container?.id).toBe('pool')
  })

  it('Lane 同时命中异 Pool 容器时，仍应以所属 Pool 为准', () => {
    const owningPool = createMockNode('owning-pool', 'bpmn-pool', 0, 0, 500, 260)
    const foreignPool = createMockNode('foreign-pool', 'bpmn-pool', 20, 0, 380, 200)
    const lane = createMockNode('lane', 'bpmn-lane', 40, 0, 320, 120)
    lane.__setParent(owningPool)
    const graph = createMockGraph([owningPool, foreignPool, lane])

    const result = validatePoolContainment(graph, lane)
    expect(result.valid).toBe(true)
    expect(result.container?.id).toBe('owning-pool')
  })

  it('Lane 命中同 Pool 下的子泳道时，应允许返回该 Lane 容器', () => {
    const owningPool = createMockNode('owning-pool', 'bpmn-pool', 0, 0, 500, 260)
    const nestedLane = createMockNode('nested-lane', 'bpmn-lane', 20, 0, 380, 200)
    nestedLane.__setParent(owningPool)
    const lane = createMockNode('lane', 'bpmn-lane', 40, 0, 320, 120)
    lane.__setParent(owningPool)
    const graph = createMockGraph([owningPool, nestedLane, lane])

    const result = validatePoolContainment(graph, lane)
    expect(result.valid).toBe(true)
    expect(result.container?.id).toBe('nested-lane')
  })

  it('Lane 未附着且不在任何 Pool 内时应失败', () => {
    const pool = createMockNode('pool', 'bpmn-pool', 0, 0, 400, 240)
    const lane = createMockNode('lane', 'bpmn-lane', 460, 260, 320, 120)
    const graph = createMockGraph([pool, lane])

    const result = validatePoolContainment(graph, lane)
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('泳道')
  })

  it('自定义失败文案应优先于默认容器文案', () => {
    const pool = createMockNode('pool', 'bpmn-pool', 0, 0, 400, 240)
    const lane = createMockNode('lane', 'bpmn-lane', 460, 260, 320, 120)
    const graph = createMockGraph([pool, lane])

    const result = validatePoolContainment(graph, lane, { reason: '自定义泳道错误' })
    expect(result.valid).toBe(false)
    expect(result.reason).toBe('自定义泳道错误')
  })

  it('存在 Pool 且节点在外部时应失败', () => {
    const pool = createMockNode('pool', 'bpmn-pool', 0, 0, 400, 240)
    const task = createMockNode('task', 'bpmn-user-task', 420, 260, 100, 60)
    const graph = createMockGraph([pool, task])

    const result = validatePoolContainment(graph, task)
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('池/参与者')
  })

  it('graph.getNodes 抛异常时应按无 Pool 处理', () => {
    const task = createMockNode('task', 'bpmn-user-task', 420, 260, 100, 60)
    const graph = {
      getNodes: () => { throw new Error('mock graph error') },
    } as any

    expect(validatePoolContainment(graph, task).valid).toBe(true)
  })
})

describe('findContainingSwimlane — 防御性分支', () => {
  it('graph.getNodes 抛异常时应返回 null', () => {
    const graph = {
      getNodes: () => { throw new Error('mock graph error') },
    } as any

    expect(findContainingSwimlane(graph, { x: 0, y: 0, width: 10, height: 10 })).toBeNull()
  })
})

describe('setupPoolContainment', () => {
  it('应绑定拖拽与结构变化事件，并返回 dispose 函数', () => {
    const graph = createMockGraph()
    const dispose = setupPoolContainment(graph)
    expect(graph._handlers['node:added']?.length).toBe(1)
    expect(graph._handlers['node:moving']?.length).toBe(1)
    expect(graph._handlers['node:moved']?.length).toBe(1)
    expect(graph._handlers['node:change:position']?.length).toBe(1)
    expect(graph._handlers['node:change:size']?.length).toBe(1)
    expect(graph._handlers['node:change:parent']?.length).toBe(1)
    dispose()
    expect(graph._handlers['node:added']?.length).toBe(0)
    expect(graph._handlers['node:moving']?.length).toBe(0)
    expect(graph._handlers['node:moved']?.length).toBe(0)
    expect(graph._handlers['node:change:position']?.length).toBe(0)
    expect(graph._handlers['node:change:size']?.length).toBe(0)
    expect(graph._handlers['node:change:parent']?.length).toBe(0)
  })

  it('node:added 时应自动嵌入到命中的 Lane', () => {
    const pool = createMockNode('pool', 'bpmn-pool', 0, 0, 400, 240)
    const lane = createMockNode('lane', 'bpmn-lane', 40, 0, 360, 120)
    lane.__setParent(pool)
    const task = createMockNode('task', 'bpmn-user-task', 100, 20, 100, 60)
    const graph = createMockGraph([pool, lane, task])

    setupPoolContainment(graph)
    emitGraphEvent(graph, 'node:added', { node: task })

    expect(lane.embed).toHaveBeenCalledWith(task)
    expect(task.getParent()?.id).toBe('lane')
  })

  it('node:added 时位于 Pool 内的泳道应自动嵌入到 Pool', () => {
    const pool = createMockNode('pool', 'bpmn-pool', 0, 0, 400, 240)
    const lane = createMockNode('lane', 'bpmn-lane', 40, 0, 360, 120)
    const graph = createMockGraph([pool, lane])

    setupPoolContainment(graph)
    emitGraphEvent(graph, 'node:added', { node: lane })

    expect(lane.remove).not.toHaveBeenCalled()
    expect(pool.embed).toHaveBeenCalledWith(lane)
    expect(lane.getParent()?.id).toBe('pool')
  })

  it('新增首个 Pool 时应自动包裹并嵌入现有顶层节点', () => {
    const task = createMockNode('task', 'bpmn-user-task', 180, 120, 110, 60)
    const pool = createMockNode('pool', 'bpmn-pool', 420, 220, 180, 120)
    const graph = createMockGraph([task, pool])

    setupPoolContainment(graph)
    emitGraphEvent(graph, 'node:added', { node: pool })

    const poolRect = getNodeRect(pool)
    const taskRect = getNodeRect(task)

    expect(pool.embed).toHaveBeenCalledWith(task)
    expect(task.getParent()?.id).toBe('pool')
    expect(poolRect.x).toBeLessThan(taskRect.x)
    expect(poolRect.y).toBeLessThan(taskRect.y)
    expect(poolRect.x + poolRect.width).toBeGreaterThan(taskRect.x + taskRect.width)
    expect(poolRect.y + poolRect.height).toBeGreaterThan(taskRect.y + taskRect.height)
  })

  it('node:added 时非法新增的 Pool 应按 removeInvalidOnAdd 移除', () => {
    const poolA = createMockNode('pool-a', 'bpmn-pool', 0, 0, 400, 240)
    const poolB = createMockNode('pool-b', 'bpmn-pool', 280, 40, 400, 240)
    const graph = createMockGraph([poolA, poolB])

    setupPoolContainment(graph)
    emitGraphEvent(graph, 'node:added', { node: poolB })

    expect(poolB.remove).toHaveBeenCalledOnce()
  })

  it('node:added 时非法新增的 Pool 在 removeInvalidOnAdd=false 时应保留', () => {
    const poolA = createMockNode('pool-a', 'bpmn-pool', 0, 0, 400, 240)
    const poolB = createMockNode('pool-b', 'bpmn-pool', 280, 40, 400, 240)
    const graph = createMockGraph([poolA, poolB])

    setupPoolContainment(graph, { removeInvalidOnAdd: false })
    emitGraphEvent(graph, 'node:added', { node: poolB })

    expect(poolB.remove).not.toHaveBeenCalled()
  })

  it('node:added 时边界事件应直接跳过，避免打断后续附着流程', () => {
    const pool = createMockNode('pool', 'bpmn-pool', 0, 0, 400, 240)
    const boundary = createMockNode('boundary', 'bpmn-boundary-event-timer', 0, 0, 36, 36)
    const graph = createMockGraph([pool, boundary])

    setupPoolContainment(graph)
    emitGraphEvent(graph, 'node:added', { node: boundary })

    expect(boundary.remove).not.toHaveBeenCalled()
    expect(pool.embed).not.toHaveBeenCalled()
  })

  it('node:added 时若不在任何 Pool 内应通知并移除节点', () => {
    const onViolation = vi.fn()
    const pool = createMockNode('pool', 'bpmn-pool', 0, 0, 400, 240)
    const task = createMockNode('task', 'bpmn-user-task', 420, 260, 100, 60)
    const graph = createMockGraph([pool, task])

    setupPoolContainment(graph, { onViolation })
    emitGraphEvent(graph, 'node:added', { node: task })

    expect(onViolation).toHaveBeenCalledOnce()
    expect(task.remove).toHaveBeenCalledOnce()
  })

  it('removeInvalidOnAdd=false 时应保留非法新增节点', () => {
    const pool = createMockNode('pool', 'bpmn-pool', 0, 0, 400, 240)
    const task = createMockNode('task', 'bpmn-user-task', 420, 260, 100, 60)
    const graph = createMockGraph([pool, task])

    setupPoolContainment(graph, { removeInvalidOnAdd: false })
    graph.emit('node:added', { node: task })

    expect(task.remove).not.toHaveBeenCalled()
  })

  it('node:moving 越出容器时应回退到上一个合法位置并通知', () => {
    const onViolation = vi.fn()
    const pool = createMockNode('pool', 'bpmn-pool', 0, 0, 400, 240)
    const lane = createMockNode('lane', 'bpmn-lane', 40, 0, 360, 120)
    lane.__setParent(pool)
    const task = createMockNode('task', 'bpmn-user-task', 100, 20, 100, 60)
    task.__setParent(lane)
    const graph = createMockGraph([pool, lane, task])

    setupPoolContainment(graph, { onViolation })
    graph.emit('node:added', { node: task })
    task.setPosition(420, 260)
    graph.emit('node:moving', { node: task })

    expect(onViolation).toHaveBeenCalledOnce()
    expect(task.setPosition).toHaveBeenLastCalledWith(100, 20, { silent: false })
  })

  it('node:moved 越出容器时也应回退到上一个合法位置', () => {
    // 规范依据：BPMN 2.0 §9.2 Pool and Participant。
    // `A Pool acts as the container for the Sequence Flows between Activities`
    // `The Sequence Flows can cross the boundaries between Lanes of a Pool, but cannot cross the boundaries of a Pool`
    const onViolation = vi.fn()
    const pool = createMockNode('pool', 'bpmn-pool', 0, 0, 400, 240)
    const lane = createMockNode('lane', 'bpmn-lane', 40, 0, 360, 120)
    lane.__setParent(pool)
    const task = createMockNode('task', 'bpmn-user-task', 100, 20, 100, 60)
    task.__setParent(lane)
    const graph = createMockGraph([pool, lane, task])

    setupPoolContainment(graph, { onViolation })
    graph.emit('node:added', { node: task })
    task.setPosition(420, 260)
    graph.emit('node:moved', { node: task })

    expect(onViolation).toHaveBeenCalledOnce()
    expect(task.setPosition).toHaveBeenLastCalledWith(100, 20, { silent: false })
  })

  it('node:moved 越界前若已意外脱离父容器，回退后也应恢复嵌套关系', () => {
    const onViolation = vi.fn()
    const pool = createMockNode('pool', 'bpmn-pool', 0, 0, 400, 240)
    const lane = createMockNode('lane', 'bpmn-lane', 40, 0, 360, 120)
    lane.__setParent(pool)
    const task = createMockNode('task', 'bpmn-user-task', 100, 20, 100, 60)
    task.__setParent(lane)
    const graph = createMockGraph([pool, lane, task])

    setupPoolContainment(graph, { onViolation })
    graph.emit('node:added', { node: task })

    lane.unembed(task)
    task.setPosition(420, 260)
    graph.emit('node:moved', { node: task })

    expect(onViolation).toHaveBeenCalledOnce()
    expect(task.setPosition).toHaveBeenLastCalledWith(100, 20, { silent: false })
    expect(lane.embed).toHaveBeenLastCalledWith(task)
    expect(task.getParent()?.id).toBe('lane')
  })

  it('仅落在 Pool 内但未落在任何 Lane 内时，应改为挂在 Pool 且不回退', () => {
    const onViolation = vi.fn()
    const pool = createMockNode('pool', 'bpmn-pool', 0, 0, 400, 240)
    const lane = createMockNode('lane', 'bpmn-lane', 40, 0, 360, 120)
    lane.__setParent(pool)
    const task = createMockNode('task', 'bpmn-user-task', 100, 20, 100, 60)
    task.__setParent(lane)
    const graph = createMockGraph([pool, lane, task])

    setupPoolContainment(graph, { onViolation })
    graph.emit('node:added', { node: task })

    task.setPosition(260, 160)
    graph.emit('node:moved', { node: task })

    expect(onViolation).not.toHaveBeenCalled()
    expect(lane.unembed).toHaveBeenCalledWith(task)
    expect(pool.embed).toHaveBeenLastCalledWith(task)
    expect(task.getParent()?.id).toBe('pool')
    expect(task.getPosition()).toEqual({ x: 260, y: 160 })
  })

  it('上一次合法状态未记录容器时，也应根据当前位置重新命中并恢复嵌套', () => {
    const onViolation = vi.fn()
    const task = createMockNode('task', 'bpmn-user-task', 100, 20, 100, 60)
    const nodes = [task]
    const graph = createMockGraph(nodes)

    setupPoolContainment(graph, { onViolation })

    const pool = createMockNode('pool', 'bpmn-pool', 0, 0, 400, 240)
    const lane = createMockNode('lane', 'bpmn-lane', 40, 0, 360, 120)
    lane.__setParent(pool)
    nodes.push(pool, lane)

    task.setPosition(420, 260)
    graph.emit('node:moved', { node: task })

    expect(onViolation).toHaveBeenCalledOnce()
    expect(task.setPosition).toHaveBeenLastCalledWith(100, 20, { silent: false })
    expect(lane.embed).toHaveBeenLastCalledWith(task)
    expect(task.getParent()?.id).toBe('lane')
  })

  it('连续两次相同越界只应提示一次', () => {
    const onViolation = vi.fn()
    const pool = createMockNode('pool', 'bpmn-pool', 0, 0, 400, 240)
    const lane = createMockNode('lane', 'bpmn-lane', 40, 0, 360, 120)
    lane.__setParent(pool)
    const task = createMockNode('task', 'bpmn-user-task', 100, 20, 100, 60)
    task.__setParent(lane)
    const graph = createMockGraph([pool, lane, task])

    setupPoolContainment(graph, { onViolation })
    graph.emit('node:added', { node: task })
    task.setPosition(420, 260)
    graph.emit('node:moving', { node: task })
    task.setPosition(420, 260)
    graph.emit('node:moving', { node: task })

    expect(onViolation).toHaveBeenCalledOnce()
  })

  it('node:moving 在同一泳道内移动时不应重新嵌入', () => {
    const pool = createMockNode('pool', 'bpmn-pool', 0, 0, 400, 240)
    const lane = createMockNode('lane', 'bpmn-lane', 40, 0, 360, 120)
    lane.__setParent(pool)
    const task = createMockNode('task', 'bpmn-user-task', 100, 20, 100, 60)
    task.__setParent(lane)
    const graph = createMockGraph([pool, lane, task])

    setupPoolContainment(graph)
    graph.emit('node:added', { node: task })
    task.setPosition(120, 30)
    graph.emit('node:moving', { node: task })

    expect(lane.unembed).not.toHaveBeenCalled()
    expect(lane.embed).not.toHaveBeenCalled()
  })

  it('node:moving 时泳道 children 链缺失应补做嵌入并刷新图层', () => {
    const pool = createMockNode('pool', 'bpmn-pool', 0, 0, 400, 240)
    const lane = createMockNode('lane', 'bpmn-lane', 40, 0, 360, 120) as ReturnType<typeof createMockNode> & {
      getChildren: () => ReturnType<typeof createMockNode>[]
    }
    lane.__setParent(pool)
    lane.getChildren = () => []
    const task = createMockNode('task', 'bpmn-user-task', 100, 20, 100, 60)
    task.__setParent(lane)
    const graph = createMockGraph([pool, lane, task])

    setupPoolContainment(graph)
    emitGraphEvent(graph, 'node:moving', { node: lane })

    expect(lane.unembed).toHaveBeenCalledWith(task)
    expect(lane.embed).toHaveBeenCalledWith(task)
    expect(task.getParent()?.id).toBe('lane')
  })

  it('自定义将 Lane 视作受约束节点时，首次拖拽基线采集应记录其直接子节点列表', () => {
    const pool = createMockNode('pool', 'bpmn-pool', 0, 0, 400, 240)
    const lane = createMockNode('lane', 'bpmn-lane', 40, 0, 360, 120)
    lane.__setParent(pool)
    const task = createMockNode('task', 'bpmn-user-task', 100, 20, 100, 60)
    task.__setParent(lane)
    const nodes = [pool] as Array<ReturnType<typeof createMockNode>>
    const graph = createMockGraph(nodes) as ReturnType<typeof createMockGraph> & {
      getCellById?: (id: string) => ReturnType<typeof createMockNode> | null
    }

    setupPoolContainment(graph, {
      isContainedNode: (shape) => shape === 'bpmn-lane' || shape === 'bpmn-user-task',
    })

    nodes.push(lane, task)
    graph.getCellById = (id: string) => nodes.find((node) => node.id === id) ?? null

    emitGraphEvent(graph, 'node:moving', { node: lane })

    lane.setPosition(520, 0)
    task.setPosition(540, 20)
    emitGraphEvent(graph, 'node:moving', { node: lane })

    expect(lane.getPosition()).toEqual({ x: 40, y: 0 })
    expect(task.getPosition()).toEqual({ x: 100, y: 20 })
  })

  it('node:moving 且命中新泳道时应重新嵌入', () => {
    const pool = createMockNode('pool', 'bpmn-pool', 0, 0, 400, 260)
    const laneA = createMockNode('lane-a', 'bpmn-lane', 40, 0, 360, 120)
    const laneB = createMockNode('lane-b', 'bpmn-lane', 40, 120, 360, 120)
    laneA.__setParent(pool)
    laneB.__setParent(pool)
    const task = createMockNode('task', 'bpmn-user-task', 100, 20, 100, 60)
    task.__setParent(laneA)
    const graph = createMockGraph([pool, laneA, laneB, task])

    setupPoolContainment(graph)
    graph.emit('node:added', { node: task })
    task.setPosition(100, 150)
    graph.emit('node:moving', { node: task })

    expect(laneA.unembed).toHaveBeenCalledWith(task)
    expect(laneB.embed).toHaveBeenCalledWith(task)
    expect(task.getParent()?.id).toBe('lane-b')
  })

  it('node:moving 时 Lane 跨 Pool 拖拽应回退到原 Pool 内位置', () => {
    const onViolation = vi.fn()
    const poolA = createMockNode('pool-a', 'bpmn-pool', 0, 0, 400, 240)
    const poolB = createMockNode('pool-b', 'bpmn-pool', 520, 0, 400, 240)
    const lane = createMockNode('lane', 'bpmn-lane', 40, 0, 360, 120)
    lane.__setParent(poolA)
    const graph = createMockGraph([poolA, poolB, lane])

    setupPoolContainment(graph, { onViolation })
    graph.emit('node:added', { node: lane })

    lane.setPosition(560, 0)
    graph.emit('node:moving', { node: lane })

    expect(onViolation).toHaveBeenCalledOnce()
    expect(lane.setPosition).toHaveBeenLastCalledWith(40, 0, { silent: false })
    expect(lane.getParent()?.id).toBe('pool-a')
  })

  it('导入后的非法 Lane 首次拖拽若起点已越界，回到合法位置时也不应因缺少基线而中断', () => {
    const onViolation = vi.fn()
    const poolA = createMockNode('pool-a', 'bpmn-pool', 0, 0, 400, 240)
    const poolB = createMockNode('pool-b', 'bpmn-pool', 520, 0, 400, 240)
    const lane = createMockNode('lane', 'bpmn-lane', 560, 0, 360, 120)
    lane.__setParent(poolA)
    const graph = createMockGraph([poolA, poolB, lane])

    setupPoolContainment(graph, { onViolation, constrainToContainer: false })

    emitGraphEvent(graph, 'node:moving', { node: lane })
    lane.setPosition(20, 0)

    expect(() => emitGraphEvent(graph, 'node:moved', { node: lane })).not.toThrow()
    expect(onViolation).toHaveBeenCalledOnce()
    expect(lane.getPosition()).toEqual({ x: 20, y: 0 })
    expect(lane.getParent()?.id).toBe('pool-a')
  })

  it('安装阶段未能预热合法状态时，Lane 首次越界后回到合法位置也应按无基线兜底继续完成', () => {
    const onViolation = vi.fn()
    const poolA = createMockNode('pool-a', 'bpmn-pool', 0, 0, 400, 240)
    const poolB = createMockNode('pool-b', 'bpmn-pool', 520, 0, 400, 240)
    const lane = createMockNode('lane', 'bpmn-lane', 560, 0, 360, 120)
    lane.__setParent(poolA)
    const nodes = [poolA, poolB, lane]
    const graph = createMockGraph(nodes) as ReturnType<typeof createMockGraph> & {
      getNodes: () => typeof nodes
    }

    let getNodesCall = 0
    graph.getNodes = () => {
      getNodesCall += 1
      if (getNodesCall === 1) {
        throw new Error('bootstrap unavailable')
      }
      return nodes
    }

    setupPoolContainment(graph, { onViolation, constrainToContainer: false })

    emitGraphEvent(graph, 'node:moving', { node: lane })
    lane.setPosition(20, 0)

    expect(() => emitGraphEvent(graph, 'node:moved', { node: lane })).not.toThrow()
    expect(onViolation).toHaveBeenCalledOnce()
    expect(lane.getPosition()).toEqual({ x: 20, y: 0 })
    expect(lane.getParent()?.id).toBe('pool-a')
  })

  it('move-selection batch 结束后，Lane 应以最新合法位置作为下一次回退基线', () => {
    const onViolation = vi.fn()
    const poolA = createMockNode('pool-a', 'bpmn-pool', 0, 0, 400, 240)
    const poolB = createMockNode('pool-b', 'bpmn-pool', 520, 0, 400, 240)
    const lane = createMockNode('lane', 'bpmn-lane', 40, 0, 360, 120)
    lane.__setParent(poolA)
    const graph = createMockGraph([poolA, poolB, lane])

    setupPoolContainment(graph, { onViolation })
    emitGraphEvent(graph, 'node:added', { node: lane })

    lane.setPosition(20, 0)
    emitGraphEvent(graph, 'node:moving', { node: lane })
    graph.model.emit('batch:stop', { name: 'move-selection' })

    lane.setPosition(560, 0)
    emitGraphEvent(graph, 'node:moving', { node: lane })

    expect(onViolation).toHaveBeenCalledOnce()
    expect(lane.setPosition).toHaveBeenLastCalledWith(20, 0, { silent: false })
  })

  it('move-selection 同时跟踪多个节点时，batch 结束后每个节点都应独立清理拖拽引用', () => {
    const onViolation = vi.fn()
    const pool = createMockNode('pool', 'bpmn-pool', 0, 0, 400, 240)
    const lane = createMockNode('lane', 'bpmn-lane', 40, 0, 360, 120)
    lane.__setParent(pool)
    const taskA = createMockNode('task-a', 'bpmn-user-task', 100, 20, 100, 60)
    const taskB = createMockNode('task-b', 'bpmn-user-task', 220, 20, 100, 60)
    taskA.__setParent(lane)
    taskB.__setParent(lane)
    const graph = createMockGraph([pool, lane, taskA, taskB])

    setupPoolContainment(graph, { onViolation })
    emitGraphEvent(graph, 'node:added', { node: taskA })
    emitGraphEvent(graph, 'node:added', { node: taskB })

    taskA.setPosition(120, 40)
    emitGraphEvent(graph, 'node:change:position', { node: taskA, options: { selection: 'selection-batch' } })
    taskB.setPosition(240, 40)
    emitGraphEvent(graph, 'node:change:position', { node: taskB, options: { selection: 'selection-batch' } })
    graph.model.emit('batch:stop', { name: 'move-selection' })

    taskB.setPosition(420, 260)
    emitGraphEvent(graph, 'node:change:position', { node: taskB, options: { selection: 'selection-next' } })

    expect(onViolation).toHaveBeenCalledOnce()
    expect(taskB.setPosition).toHaveBeenLastCalledWith(240, 40, { silent: false })
    expect(taskB.getPosition()).toEqual({ x: 240, y: 40 })
  })

  it('node:moved 时 Lane 跨 Pool 回退后也应刷新待修复子节点', () => {
    const onViolation = vi.fn()
    const poolA = createMockNode('pool-a', 'bpmn-pool', 0, 0, 400, 240)
    const poolB = createMockNode('pool-b', 'bpmn-pool', 520, 0, 400, 240)
    const lane = createMockNode('lane', 'bpmn-lane', 40, 0, 360, 120)
    lane.__setParent(poolA)
    const task = createMockNode('task', 'bpmn-user-task', 100, 20, 100, 60)
    task.__setParent(lane)
    const graph = createMockGraph([poolA, poolB, lane, task])

    setupPoolContainment(graph, { onViolation })
    emitGraphEvent(graph, 'node:added', { node: lane })
    emitGraphEvent(graph, 'node:added', { node: task })

    lane.setPosition(560, 0)
    task.setPosition(620, 20)
    emitGraphEvent(graph, 'node:moved', { node: lane })

    expect(onViolation).toHaveBeenCalledOnce()
    expect(lane.setPosition).toHaveBeenLastCalledWith(40, 0, { silent: false })
    expect(task.setPosition).toHaveBeenLastCalledWith(100, 20, { silent: false })
    expect(task.getPosition()).toEqual({ x: 100, y: 20 })
    expect(task.getParent()?.id).toBe('lane')
  })

  it('node:moved 时若存在其他泳池拖拽，当前节点校验应直接短路', () => {
    const onViolation = vi.fn()
    const poolA = createMockNode('pool-a', 'bpmn-pool', 0, 0, 400, 240)
    const poolB = createMockNode('pool-b', 'bpmn-pool', 520, 0, 400, 240)
    const task = createMockNode('task', 'bpmn-user-task', 620, 20, 100, 60)
    task.__setParent(poolB)
    const graph = createMockGraph([poolA, poolB, task])

    setupPoolContainment(graph, { onViolation })
    emitGraphEvent(graph, 'node:added', { node: task })

    emitGraphEvent(graph, 'node:moving', { node: poolA })
    task.setPosition(980, 260)
    emitGraphEvent(graph, 'node:moved', { node: task })

    expect(onViolation).not.toHaveBeenCalled()
    expect(task.getPosition()).toEqual({ x: 980, y: 260 })
  })

  it('node:moved 时若泳道拖拽过程中出现过越界，再回到合法位置后仍应按拖拽基线修复子节点', () => {
    const onViolation = vi.fn()
    const poolA = createMockNode('pool-a', 'bpmn-pool', 0, 0, 400, 240)
    const poolB = createMockNode('pool-b', 'bpmn-pool', 520, 0, 400, 240)
    const lane = createMockNode('lane', 'bpmn-lane', 40, 0, 360, 120)
    lane.__setParent(poolA)
    const task = createMockNode('task', 'bpmn-user-task', 100, 20, 100, 60)
    task.__setParent(lane)
    const graph = createMockGraph([poolA, poolB, lane, task])

    setupPoolContainment(graph, { onViolation })
    emitGraphEvent(graph, 'node:added', { node: lane })
    emitGraphEvent(graph, 'node:added', { node: task })

    lane.setPosition(560, 0)
    task.setPosition(620, 20)
    emitGraphEvent(graph, 'node:moving', { node: lane })

    task.setPosition(620, 20)
    emitGraphEvent(graph, 'node:moved', { node: lane })

    expect(onViolation).toHaveBeenCalledOnce()
    expect(task.setPosition).toHaveBeenLastCalledWith(100, 20, { silent: false })
    expect(task.getPosition()).toEqual({ x: 100, y: 20 })
  })

  it('constrainToContainer=false 时，Lane 先越界再回到合法位置后，结束拖拽仍应按基线修复子节点', () => {
    const onViolation = vi.fn()
    const poolA = createMockNode('pool-a', 'bpmn-pool', 0, 0, 400, 240)
    const poolB = createMockNode('pool-b', 'bpmn-pool', 520, 0, 400, 240)
    const lane = createMockNode('lane', 'bpmn-lane', 40, 0, 360, 120) as ReturnType<typeof createMockNode> & {
      getChildren: () => ReturnType<typeof createMockNode>[]
    }
    lane.__setParent(poolA)
    const task = createMockNode('task', 'bpmn-user-task', 100, 20, 100, 60)
    task.__setParent(lane)
    lane.getChildren = () => [task]
    const graph = createMockGraph([poolA, poolB, lane, task])

    setupPoolContainment(graph, { onViolation, constrainToContainer: false })
    emitGraphEvent(graph, 'node:added', { node: lane })
    emitGraphEvent(graph, 'node:added', { node: task })

    lane.setPosition(560, 0)
    task.setPosition(620, 20)
    emitGraphEvent(graph, 'node:moving', { node: lane })

    lane.setPosition(20, 0)
    task.setPosition(620, 20)
    emitGraphEvent(graph, 'node:moved', { node: lane })

    expect(onViolation).toHaveBeenCalledOnce()
    expect(lane.getPosition()).toEqual({ x: 20, y: 0 })
    expect(task.setPosition).toHaveBeenLastCalledWith(100, 20, { silent: false })
    expect(task.getPosition()).toEqual({ x: 100, y: 20 })
    expect(task.getParent()?.id).toBe('lane')
  })

  it('node:moving 时边界事件应直接跳过', () => {
    const pool = createMockNode('pool', 'bpmn-pool', 0, 0, 400, 240)
    const boundary = createMockNode('boundary', 'bpmn-boundary-event-timer', 100, 20, 36, 36)
    const graph = createMockGraph([pool, boundary])

    setupPoolContainment(graph)
    boundary.setPosition(420, 260)
    graph.emit('node:moving', { node: boundary })

    expect(boundary.setPosition).not.toHaveBeenLastCalledWith(100, 20, { silent: false })
    expect(pool.embed).not.toHaveBeenCalled()
  })

  it('node:moved 时边界事件应直接跳过', () => {
    const pool = createMockNode('pool', 'bpmn-pool', 0, 0, 400, 240)
    const boundary = createMockNode('boundary', 'bpmn-boundary-event-timer', 0, 0, 36, 36)
    const graph = createMockGraph([pool, boundary])

    setupPoolContainment(graph)
    graph.emit('node:moved', { node: boundary })

    expect(boundary.setPosition).not.toHaveBeenCalled()
    expect(pool.embed).not.toHaveBeenCalled()
  })

  it('node:moved 在容器内结束时应直接通过', () => {
    const onViolation = vi.fn()
    const pool = createMockNode('pool', 'bpmn-pool', 0, 0, 400, 240)
    const lane = createMockNode('lane', 'bpmn-lane', 40, 0, 360, 120)
    lane.__setParent(pool)
    const task = createMockNode('task', 'bpmn-user-task', 100, 20, 100, 60)
    task.__setParent(lane)
    const graph = createMockGraph([pool, lane, task])

    setupPoolContainment(graph, { onViolation })
    task.setPosition(120, 30)
    graph.emit('node:moved', { node: task })

    expect(onViolation).not.toHaveBeenCalled()
    expect(lane.embed).not.toHaveBeenCalled()
  })

  it('导入后 Lane 首次收到合法 moved 事件时，不应在缺少拖拽基线时误级联子节点', () => {
    const pool = createMockNode('pool', 'bpmn-pool', 0, 0, 400, 240)
    const lane = createMockNode('lane', 'bpmn-lane', 40, 0, 360, 120)
    lane.__setParent(pool)
    const task = createMockNode('task', 'bpmn-user-task', 100, 20, 100, 60)
    task.__setParent(lane)
    const graph = createMockGraph([pool, lane, task])

    setupPoolContainment(graph)

    emitGraphEvent(graph, 'node:moved', { node: lane })

    expect(task.setPosition).not.toHaveBeenCalled()
    expect(task.getPosition()).toEqual({ x: 100, y: 20 })
    expect(task.getParent()?.id).toBe('lane')
  })

  it('node:change:position 越界时应回退到上一个合法位置', () => {
    const onViolation = vi.fn()
    const pool = createMockNode('pool', 'bpmn-pool', 0, 0, 400, 240)
    const lane = createMockNode('lane', 'bpmn-lane', 40, 0, 360, 120)
    lane.__setParent(pool)
    const task = createMockNode('task', 'bpmn-user-task', 100, 20, 100, 60)
    task.__setParent(lane)
    const graph = createMockGraph([pool, lane, task])

    setupPoolContainment(graph, { onViolation })
    graph.emit('node:added', { node: task })

    task.setPosition(420, 260)
    graph.emit('node:change:position', { node: task })

    expect(onViolation).toHaveBeenCalledOnce()
    expect(task.setPosition).toHaveBeenLastCalledWith(100, 20, { silent: false })
  })

  it('node:change:size 越界时应回退尺寸与位置', () => {
    const onViolation = vi.fn()
    const pool = createMockNode('pool', 'bpmn-pool', 0, 0, 400, 240)
    const lane = createMockNode('lane', 'bpmn-lane', 40, 0, 360, 120)
    lane.__setParent(pool)
    const task = createMockNode('task', 'bpmn-user-task', 100, 20, 100, 60)
    task.__setParent(lane)
    const graph = createMockGraph([pool, lane, task])

    setupPoolContainment(graph, { onViolation })
    graph.emit('node:added', { node: task })

    task.resize(380, 180)
    graph.emit('node:change:size', { node: task })

    expect(onViolation).toHaveBeenCalledOnce()
    expect(task.resize).toHaveBeenLastCalledWith(100, 60, { silent: false })
    expect(task.getPosition()).toEqual({ x: 100, y: 20 })
  })

  it('Pool 缩小时不应小于内部内容边界', () => {
    const pool = createMockNode('pool', 'bpmn-pool', 0, 0, 400, 240) as ReturnType<typeof createMockNode> & {
      getChildren: () => Array<ReturnType<typeof createMockNode>>
    }
    const task = createMockNode('task', 'bpmn-user-task', 180, 120, 110, 60)
    pool.embed(task)
    pool.getChildren = () => [task]
    const graph = createMockGraph([pool, task])

    setupPoolContainment(graph)

    pool.setPosition(220, 160)
    pool.resize(80, 40)
    emitGraphEvent(graph, 'node:change:size', { node: pool })

    const poolRect = getNodeRect(pool)
    const taskRect = getNodeRect(task)

    expect(poolRect.x).toBeLessThanOrEqual(taskRect.x)
    expect(poolRect.y).toBeLessThanOrEqual(taskRect.y)
    expect(poolRect.x + poolRect.width).toBeGreaterThanOrEqual(taskRect.x + taskRect.width)
    expect(poolRect.y + poolRect.height).toBeGreaterThanOrEqual(taskRect.y + taskRect.height)
    expect(pool.resize).toHaveBeenCalled()
  })

  it('node:change:position 拖拽 Pool 时不应因内部内容联动改尺寸', () => {
    const pool = createMockNode('pool', 'bpmn-pool', 0, 0, 400, 240) as ReturnType<typeof createMockNode> & {
      getChildren: () => Array<ReturnType<typeof createMockNode>>
    }
    const task = createMockNode('task', 'bpmn-user-task', 180, 120, 110, 60)
    pool.embed(task)
    pool.getChildren = () => [task]
    const graph = createMockGraph([pool, task])

    setupPoolContainment(graph)

    pool.resize(80, 40)
    pool.resize.mockClear()
    pool.setPosition(220, 160)
    emitGraphEvent(graph, 'node:change:position', { node: pool })

    expect(getNodeRect(pool)).toMatchObject({
      x: 220,
      y: 160,
      width: 80,
      height: 40,
    })
    expect(pool.resize).not.toHaveBeenCalled()
  })

  it('Pool 在未经过 moving 的 moved 事件里若没有实际位移，不应触发额外后代同步', () => {
    const pool = createMockNode('pool', 'bpmn-pool', 0, 0, 400, 240)
    const lane = createMockNode('lane', 'bpmn-lane', 40, 0, 360, 120)
    lane.__setParent(pool)
    const task = createMockNode('task', 'bpmn-user-task', 100, 20, 100, 60)
    task.__setParent(lane)
    const graph = createMockGraph([pool, lane, task])

    setupPoolContainment(graph)
    emitGraphEvent(graph, 'node:added', { node: pool })
    emitGraphEvent(graph, 'node:added', { node: lane })
    emitGraphEvent(graph, 'node:added', { node: task })

    emitGraphEvent(graph, 'node:moved', { node: pool })

    expect(lane.getPosition()).toEqual({ x: 40, y: 0 })
    expect(task.getPosition()).toEqual({ x: 100, y: 20 })
  })

  it('泳池联动时 graph.getNodes 抛异常也不应打断后代同步分支', () => {
    const pool = createMockNode('pool', 'bpmn-pool', 0, 0, 400, 240)
    const task = createMockNode('task', 'bpmn-user-task', 100, 20, 100, 60)
    task.__setParent(pool)
    const nodes = [pool, task]
    const graph = createMockGraph(nodes) as ReturnType<typeof createMockGraph> & {
      getNodes: () => typeof nodes
    }

    setupPoolContainment(graph)
    emitGraphEvent(graph, 'node:added', { node: pool })
    emitGraphEvent(graph, 'node:added', { node: task })

    let getNodesCall = 0
    graph.getNodes = () => {
      getNodesCall += 1
      if (getNodesCall === 4) {
        throw new Error('boom')
      }
      return nodes
    }

    pool.setPosition(40, 10)

    expect(() => emitGraphEvent(graph, 'node:change:position', { node: pool })).not.toThrow()
    expect(task.getPosition()).toEqual({ x: 100, y: 20 })
  })

  it('初始化未能预热且当前 Pool 非法时，change:position 不应因缺少拖拽基线抛异常', () => {
    const onViolation = vi.fn()
    const poolA = createMockNode('pool-a', 'bpmn-pool', 0, 0, 400, 240)
    const poolB = createMockNode('pool-b', 'bpmn-pool', 280, 40, 400, 240)
    const nodes = [poolA, poolB]
    const graph = createMockGraph(nodes) as ReturnType<typeof createMockGraph> & {
      getNodes: () => typeof nodes
    }

    let getNodesCall = 0
    graph.getNodes = () => {
      getNodesCall += 1
      if (getNodesCall === 1) {
        throw new Error('bootstrap unavailable')
      }
      return nodes
    }

    setupPoolContainment(graph, { onViolation, constrainToContainer: false })

    expect(() => emitGraphEvent(graph, 'node:change:position', { node: poolB })).not.toThrow()
    expect(onViolation).toHaveBeenCalledOnce()
  })

  it('node:change:size 在无 resize 时应回退到 setSize', () => {
    const onViolation = vi.fn()
    const pool = createMockNode('pool', 'bpmn-pool', 0, 0, 400, 240)
    const lane = createMockNode('lane', 'bpmn-lane', 40, 0, 360, 120)
    lane.__setParent(pool)
    let position = { x: 100, y: 20 }
    let size = { width: 100, height: 60 }
    let parent: any = lane
    const task: any = {
      id: 'task',
      shape: 'bpmn-user-task',
      getPosition: () => ({ ...position }),
      getSize: () => ({ ...size }),
      setPosition: vi.fn((nextX: number, nextY: number) => {
        position = { x: nextX, y: nextY }
      }),
      setSize: vi.fn((nextWidth: number, nextHeight: number) => {
        size = { width: nextWidth, height: nextHeight }
      }),
      getParent: () => parent,
      embed: vi.fn(),
      unembed: vi.fn(),
      remove: vi.fn(),
      isNode: () => true,
      __setParent: (nextParent: any) => {
        parent = nextParent
      },
    }
    const graph = createMockGraph([pool, lane, task])

    setupPoolContainment(graph, { onViolation })
    graph.emit('node:added', { node: task })

    task.setSize(380, 180)
    graph.emit('node:change:size', { node: task })

    expect(onViolation).toHaveBeenCalledOnce()
    expect(task.setSize).toHaveBeenLastCalledWith(100, 60, { silent: false })
  })

  it('node:change:size 在节点无尺寸写接口时应只提示且不中断', () => {
    const onViolation = vi.fn()
    const pool = createMockNode('pool', 'bpmn-pool', 0, 0, 400, 240)
    const lane = createMockNode('lane', 'bpmn-lane', 40, 0, 360, 120)
    lane.__setParent(pool)
    let position = { x: 100, y: 20 }
    let size = { width: 100, height: 60 }
    let parent: any = lane
    const task: any = {
      id: 'task',
      shape: 'bpmn-user-task',
      getPosition: () => ({ ...position }),
      getSize: () => ({ ...size }),
      setPosition: vi.fn((nextX: number, nextY: number) => {
        position = { x: nextX, y: nextY }
      }),
      getParent: () => parent,
      embed: vi.fn(),
      unembed: vi.fn(),
      remove: vi.fn(),
      isNode: () => true,
      __setParent: (nextParent: any) => {
        parent = nextParent
      },
      __setSize: (nextWidth: number, nextHeight: number) => {
        size = { width: nextWidth, height: nextHeight }
      },
    }
    const graph = createMockGraph([pool, lane, task])

    setupPoolContainment(graph, { onViolation })
    graph.emit('node:added', { node: task })

    task.__setSize(380, 180)

    expect(() => graph.emit('node:change:size', { node: task })).not.toThrow()
    expect(onViolation).toHaveBeenCalledOnce()
    expect(task.setPosition).not.toHaveBeenCalledWith(100, 20, { silent: false })
  })

  it('node:change:position 带 ui 标记时应跳过容器约束', () => {
    const onViolation = vi.fn()
    const pool = createMockNode('pool', 'bpmn-pool', 0, 0, 400, 240)
    const lane = createMockNode('lane', 'bpmn-lane', 40, 0, 360, 120)
    lane.__setParent(pool)
    const task = createMockNode('task', 'bpmn-user-task', 100, 20, 100, 60)
    task.__setParent(lane)
    const graph = createMockGraph([pool, lane, task])

    setupPoolContainment(graph, { onViolation })
    graph.emit('node:added', { node: task })

    task.setPosition(420, 260)
    graph.emit('node:change:position', { node: task, options: { ui: true } })

    expect(onViolation).not.toHaveBeenCalled()
    expect(task.setPosition).not.toHaveBeenLastCalledWith(100, 20, { silent: false })
  })

  it('node:change:position 带 silent 标记时应跳过容器约束', () => {
    const onViolation = vi.fn()
    const pool = createMockNode('pool', 'bpmn-pool', 0, 0, 400, 240)
    const lane = createMockNode('lane', 'bpmn-lane', 40, 0, 360, 120)
    lane.__setParent(pool)
    const task = createMockNode('task', 'bpmn-user-task', 100, 20, 100, 60)
    task.__setParent(lane)
    const graph = createMockGraph([pool, lane, task])

    setupPoolContainment(graph, { onViolation })
    graph.emit('node:added', { node: task })

    task.setPosition(420, 260)
    graph.emit('node:change:position', { node: task, options: { silent: true } })

    expect(onViolation).not.toHaveBeenCalled()
    expect(task.setPosition).not.toHaveBeenLastCalledWith(100, 20, { silent: false })
  })

  it('node:change:position 带 translateBy 时应通过 getCellById 识别泳池联动并跳过', () => {
    const onViolation = vi.fn()
    const pool = createMockNode('pool', 'bpmn-pool', 0, 0, 400, 240)
    const lane = createMockNode('lane', 'bpmn-lane', 40, 0, 360, 120)
    lane.__setParent(pool)
    const task = createMockNode('task', 'bpmn-user-task', 100, 20, 100, 60)
    task.__setParent(lane)
    const graph = createMockGraph([pool, lane, task]) as ReturnType<typeof createMockGraph> & {
      getCellById?: ReturnType<typeof vi.fn>
    }
    graph.getCellById = vi.fn((id: string) => (id === pool.id ? pool : null))

    setupPoolContainment(graph, { onViolation })
    emitGraphEvent(graph, 'node:added', { node: task })

    task.setPosition(420, 260)
    emitGraphEvent(graph, 'node:change:position', { node: task, options: { translateBy: pool.id } })

    expect(graph.getCellById).toHaveBeenCalledWith(pool.id)
    expect(onViolation).not.toHaveBeenCalled()
    expect(task.getPosition()).toEqual({ x: 420, y: 260 })
  })

  it('node:change:position 带 translateBy 时，定位泳池失败也不应中断后续校验', () => {
    const onViolation = vi.fn()
    const pool = createMockNode('pool', 'bpmn-pool', 0, 0, 400, 240)
    const lane = createMockNode('lane', 'bpmn-lane', 40, 0, 360, 120)
    lane.__setParent(pool)
    const task = createMockNode('task', 'bpmn-user-task', 100, 20, 100, 60)
    task.__setParent(lane)
    const nodes = [pool, lane, task]
    const graph = createMockGraph(nodes) as ReturnType<typeof createMockGraph> & {
      getCellById?: ReturnType<typeof vi.fn>
      getNodes: () => typeof nodes
    }

    setupPoolContainment(graph, { onViolation })
    emitGraphEvent(graph, 'node:added', { node: task })

    let getNodesCall = 0
    graph.getCellById = vi.fn(() => {
      throw new Error('boom')
    })
    graph.getNodes = () => {
      getNodesCall += 1
      if (getNodesCall === 1) {
        throw new Error('boom')
      }
      return nodes
    }

    emitGraphEvent(graph, 'node:change:position', { node: task, options: { translateBy: 'missing-pool' } })

    expect(graph.getCellById).toHaveBeenCalledWith('missing-pool')
    expect(onViolation).not.toHaveBeenCalled()
    expect(task.getPosition()).toEqual({ x: 100, y: 20 })
  })

  it('node:change:position 带 translateBy 且 getCellById 不可用时，应回退到图节点扫描定位泳池', () => {
    const onViolation = vi.fn()
    const pool = createMockNode('pool', 'bpmn-pool', 0, 0, 400, 240)
    const lane = createMockNode('lane', 'bpmn-lane', 40, 0, 360, 120)
    lane.__setParent(pool)
    const task = createMockNode('task', 'bpmn-user-task', 100, 20, 100, 60)
    task.__setParent(lane)
    const nodes = [pool, lane, task]
    const graph = createMockGraph(nodes) as ReturnType<typeof createMockGraph> & {
      getCellById?: ReturnType<typeof vi.fn>
      getNodes: () => typeof nodes
    }

    graph.getCellById = vi.fn(() => null)
    graph.getNodes = () => nodes

    setupPoolContainment(graph, { onViolation })
    emitGraphEvent(graph, 'node:added', { node: task })

    task.setPosition(420, 260)
    emitGraphEvent(graph, 'node:change:position', { node: task, options: { translateBy: pool.id } })

    task.setPosition(140, 50)
    emitGraphEvent(graph, 'node:change:position', { node: task, options: { translateBy: 'missing-pool' } })

    expect(graph.getCellById).toHaveBeenCalledWith(pool.id)
    expect(graph.getCellById).toHaveBeenCalledWith('missing-pool')
    expect(onViolation).not.toHaveBeenCalled()
    expect(task.getPosition()).toEqual({ x: 140, y: 50 })
  })

  it('node:change:position 带 translateBy=lane 时，不应带动 Lane 内部节点且重复拖拽也不应异常', () => {
    const onViolation = vi.fn()
    const pool = createMockNode('pool', 'bpmn-pool', 0, 0, 400, 240)
    const lane = createMockNode('lane', 'bpmn-lane', 40, 0, 360, 120)
    lane.__setParent(pool)
    const task = createMockNode('task', 'bpmn-user-task', 100, 20, 100, 60)
    task.__setParent(lane)
    const graph = createMockGraph([pool, lane, task]) as ReturnType<typeof createMockGraph> & {
      getCellById?: ReturnType<typeof vi.fn>
    }
    graph.getCellById = vi.fn((id: string) => {
      if (id === lane.id) return lane
      if (id === pool.id) return pool
      return null
    })

    setupPoolContainment(graph, { onViolation })
    emitGraphEvent(graph, 'node:added', { node: lane })
    emitGraphEvent(graph, 'node:added', { node: task })

    const laneTargets = [20, 10, 30]
    for (const targetX of laneTargets) {
      lane.setPosition(targetX, 0)
      emitGraphEvent(graph, 'node:moving', { node: lane })

      task.setPosition(task.getPosition().x + 20, task.getPosition().y + 10)
      expect(() => {
        emitGraphEvent(graph, 'node:change:position', { node: task, options: { translateBy: lane.id } })
      }).not.toThrow()

      emitGraphEvent(graph, 'node:moved', { node: lane })

      expect(task.getPosition()).toEqual({ x: 100, y: 20 })
      expect(task.getParent()?.id).toBe('lane')
    }

    expect(onViolation).not.toHaveBeenCalled()
  })

  it('Pool 拖拽期间，Lane 联动产生的 translateBy=lane 不应把内部任务错误回退到原地', () => {
    const onViolation = vi.fn()
    const pool = createMockNode('pool', 'bpmn-pool', 0, 0, 400, 240)
    const lane = createMockNode('lane', 'bpmn-lane', 40, 0, 360, 120)
    lane.__setParent(pool)
    const task = createMockNode('task', 'bpmn-user-task', 100, 20, 100, 60)
    task.__setParent(lane)
    const graph = createMockGraph([pool, lane, task]) as ReturnType<typeof createMockGraph> & {
      getCellById?: ReturnType<typeof vi.fn>
    }

    graph.getCellById = vi.fn((id: string) => {
      if (id === lane.id) return lane
      if (id === pool.id) return pool
      return null
    })

    setupPoolContainment(graph, { onViolation })
    emitGraphEvent(graph, 'node:added', { node: pool })
    emitGraphEvent(graph, 'node:added', { node: lane })
    emitGraphEvent(graph, 'node:added', { node: task })

    pool.setPosition(30, 15)
    emitGraphEvent(graph, 'node:moving', { node: pool })

    task.setPosition(130, 35)
    emitGraphEvent(graph, 'node:change:position', { node: task, options: { translateBy: lane.id } })

    expect(onViolation).not.toHaveBeenCalled()
    expect(task.getPosition()).toEqual({ x: 130, y: 35 })
    expect(task.getParent()?.id).toBe(lane.id)
  })

  it('node:change:position 带 translateBy=lane 且子节点本身也是 Lane 时，也应恢复原位', () => {
    const pool = createMockNode('pool', 'bpmn-pool', 0, 0, 400, 240)
    const parentLane = createMockNode('parent-lane', 'bpmn-lane', 40, 0, 360, 180)
    parentLane.__setParent(pool)
    const childLane = createMockNode('child-lane', 'bpmn-lane', 80, 0, 320, 120)
    childLane.__setParent(parentLane)
    const graph = createMockGraph([pool, parentLane, childLane]) as ReturnType<typeof createMockGraph> & {
      getCellById?: ReturnType<typeof vi.fn>
    }

    graph.getCellById = vi.fn((id: string) => {
      if (id === parentLane.id) return parentLane
      if (id === pool.id) return pool
      return null
    })

    setupPoolContainment(graph)
    emitGraphEvent(graph, 'node:added', { node: parentLane })
    emitGraphEvent(graph, 'node:added', { node: childLane })

    parentLane.setPosition(20, 0)
    emitGraphEvent(graph, 'node:moving', { node: parentLane })

    childLane.setPosition(60, 0)
    emitGraphEvent(graph, 'node:change:position', { node: childLane, options: { translateBy: parentLane.id } })

    expect(childLane.getPosition()).toEqual({ x: 80, y: 0 })
    expect(childLane.getParent()?.id).toBe('parent-lane')
  })

  it('安装阶段未能预热合法状态时，Lane 首次收到越界 change:position 也应按无基线兜底处理', () => {
    const onViolation = vi.fn()
    const poolA = createMockNode('pool-a', 'bpmn-pool', 0, 0, 400, 240)
    const poolB = createMockNode('pool-b', 'bpmn-pool', 520, 0, 400, 240)
    const lane = createMockNode('lane', 'bpmn-lane', 560, 0, 360, 120)
    lane.__setParent(poolA)
    const nodes = [poolA, poolB, lane]
    const graph = createMockGraph(nodes) as ReturnType<typeof createMockGraph> & {
      getNodes: () => typeof nodes
    }

    let getNodesCall = 0
    graph.getNodes = () => {
      getNodesCall += 1
      if (getNodesCall === 1) {
        throw new Error('bootstrap unavailable')
      }
      return nodes
    }

    setupPoolContainment(graph, { onViolation, constrainToContainer: false })

    expect(() => emitGraphEvent(graph, 'node:change:position', { node: lane })).not.toThrow()
    expect(onViolation).toHaveBeenCalledOnce()
    expect(lane.getPosition()).toEqual({ x: 560, y: 0 })
    expect(lane.getParent()?.id).toBe('pool-a')
  })

  it('node:change:position 在 constrainToContainer=false 时越界只提示不回退', () => {
    const onViolation = vi.fn()
    const pool = createMockNode('pool', 'bpmn-pool', 0, 0, 400, 240)
    const lane = createMockNode('lane', 'bpmn-lane', 40, 0, 360, 120)
    lane.__setParent(pool)
    const task = createMockNode('task', 'bpmn-user-task', 100, 20, 100, 60)
    task.__setParent(lane)
    const graph = createMockGraph([pool, lane, task])

    setupPoolContainment(graph, { onViolation, constrainToContainer: false })
    graph.emit('node:added', { node: task })

    task.setPosition(420, 260)
    graph.emit('node:change:position', { node: task })

    expect(onViolation).toHaveBeenCalledOnce()
    expect(task.setPosition).not.toHaveBeenLastCalledWith(100, 20, { silent: true })
  })

  it('选框拖拽产生的 change:position 越界时应回退到拖拽前位置', () => {
    const onViolation = vi.fn()
    const pool = createMockNode('pool', 'bpmn-pool', 0, 0, 400, 240)
    const lane = createMockNode('lane', 'bpmn-lane', 40, 0, 360, 120)
    lane.__setParent(pool)
    const task = createMockNode('task', 'bpmn-user-task', 100, 20, 100, 60)
    task.__setParent(lane)
    const graph = createMockGraph([pool, lane, task])

    setupPoolContainment(graph, { onViolation })
    graph.emit('node:added', { node: task })

    task.setPosition(140, 50)
    graph.emit('node:change:position', { node: task, options: { selection: 'selection-1' } })

    task.setPosition(420, 260)
    graph.emit('node:change:position', { node: task, options: { selection: 'selection-1' } })

    expect(onViolation).toHaveBeenCalledOnce()
    expect(task.setPosition).toHaveBeenLastCalledWith(100, 20, { silent: false })
  })

  it('选框拖拽结束后应清理拖拽基线，并以下一次起点作为回退位置', () => {
    const onViolation = vi.fn()
    const pool = createMockNode('pool', 'bpmn-pool', 0, 0, 400, 240)
    const lane = createMockNode('lane', 'bpmn-lane', 40, 0, 360, 120)
    lane.__setParent(pool)
    const task = createMockNode('task', 'bpmn-user-task', 100, 20, 100, 60)
    task.__setParent(lane)
    const graph = createMockGraph([pool, lane, task])

    setupPoolContainment(graph, { onViolation })
    graph.emit('node:added', { node: task })

    task.setPosition(140, 50)
    graph.emit('node:change:position', { node: task, options: { selection: 'selection-1' } })
    graph.model.emit('batch:stop', { name: 'move-selection' })

    task.setPosition(420, 260)
    graph.emit('node:change:position', { node: task, options: { selection: 'selection-2' } })

    expect(onViolation).toHaveBeenCalledOnce()
    expect(task.setPosition).toHaveBeenLastCalledWith(140, 50, { silent: false })
  })

  it('选框拖拽越界后继续移动时，仍应锁定回拖拽前位置直到抬起鼠标', () => {
    const onViolation = vi.fn()
    const pool = createMockNode('pool', 'bpmn-pool', 0, 0, 400, 240)
    const lane = createMockNode('lane', 'bpmn-lane', 40, 0, 360, 120)
    lane.__setParent(pool)
    const task = createMockNode('task', 'bpmn-user-task', 100, 20, 100, 60)
    task.__setParent(lane)
    const graph = createMockGraph([pool, lane, task])

    setupPoolContainment(graph, { onViolation })
    graph.emit('node:added', { node: task })

    task.setPosition(140, 50)
    graph.emit('node:change:position', { node: task, options: { selection: 'selection-v2' } })

    task.setPosition(420, 260)
    graph.emit('node:change:position', { node: task, options: { selection: 'selection-v2' } })

    task.setPosition(180, 70)
    graph.emit('node:change:position', { node: task, options: { selection: 'selection-v2' } })

    expect(onViolation).toHaveBeenCalledOnce()
    expect(task.setPosition).toHaveBeenLastCalledWith(100, 20, { silent: false })
    expect(task.getPosition()).toEqual({ x: 100, y: 20 })
  })

  it('selection v2 抬起鼠标后应清理锁定，并以下一次起点作为回退位置', () => {
    const onViolation = vi.fn()
    const ownerDocument = createMockDocument()
    const pool = createMockNode('pool', 'bpmn-pool', 0, 0, 400, 240)
    const lane = createMockNode('lane', 'bpmn-lane', 40, 0, 360, 120)
    lane.__setParent(pool)
    const task = createMockNode('task', 'bpmn-user-task', 100, 20, 100, 60)
    task.__setParent(lane)
    const graph = createMockGraph([pool, lane, task])
    graph.container = { ownerDocument }

    setupPoolContainment(graph, { onViolation })
    graph.emit('node:added', { node: task })

    task.setPosition(140, 50)
    graph.emit('node:change:position', { node: task, options: { selection: 'selection-v2' } })

    ownerDocument.dispatchEvent({ type: 'mouseup' })

    task.setPosition(180, 70)
    graph.emit('node:change:position', { node: task, options: { selection: 'selection-v3' } })

    task.setPosition(420, 260)
    graph.emit('node:change:position', { node: task, options: { selection: 'selection-v3' } })

    expect(onViolation).toHaveBeenCalledOnce()
    expect(task.setPosition).toHaveBeenLastCalledWith(140, 50, { silent: false })
    expect(task.getPosition()).toEqual({ x: 140, y: 50 })
  })

  it('普通拖拽抬起鼠标时，未违规节点不应触发额外回退收尾', () => {
    const ownerDocument = createMockDocument()
    const pool = createMockNode('pool', 'bpmn-pool', 0, 0, 400, 240)
    const lane = createMockNode('lane', 'bpmn-lane', 40, 0, 360, 120)
    lane.__setParent(pool)
    const task = createMockNode('task', 'bpmn-user-task', 100, 20, 100, 60)
    task.__setParent(lane)
    const graph = createMockGraph([pool, lane, task]) as ReturnType<typeof createMockGraph> & {
      container?: { ownerDocument: ReturnType<typeof createMockDocument> }
    }
    graph.container = { ownerDocument }

    setupPoolContainment(graph)
    emitGraphEvent(graph, 'node:added', { node: task })

    task.setPosition(140, 50)
    emitGraphEvent(graph, 'node:moving', { node: task })
    const setPositionCallsBeforeRelease = task.setPosition.mock.calls.length

    ownerDocument.dispatchEvent({ type: 'mouseup' })

    expect(task.setPosition).toHaveBeenCalledTimes(setPositionCallsBeforeRelease)
    expect(task.getPosition()).toEqual({ x: 140, y: 50 })
  })

  it('Lane 选框拖拽跨 Pool 时应回退到拖拽前位置', () => {
    const onViolation = vi.fn()
    const poolA = createMockNode('pool-a', 'bpmn-pool', 0, 0, 400, 240)
    const poolB = createMockNode('pool-b', 'bpmn-pool', 520, 0, 400, 240)
    const lane = createMockNode('lane', 'bpmn-lane', 40, 0, 320, 120)
    lane.__setParent(poolA)
    const graph = createMockGraph([poolA, poolB, lane])

    setupPoolContainment(graph, { onViolation })
    graph.emit('node:added', { node: lane })

    lane.setPosition(560, 0)
    graph.emit('node:change:position', { node: lane, options: { selection: 'selection-lane-1' } })

    expect(onViolation).toHaveBeenCalledOnce()
    expect(lane.setPosition).toHaveBeenLastCalledWith(40, 0, { silent: false })
    expect(lane.getParent()?.id).toBe('pool-a')
  })

  it('Lane 选框拖拽一旦被锁定，后续 change:position 仍应回到拖拽前位置', () => {
    const onViolation = vi.fn()
    const poolA = createMockNode('pool-a', 'bpmn-pool', 0, 0, 400, 240)
    const poolB = createMockNode('pool-b', 'bpmn-pool', 520, 0, 400, 240)
    const lane = createMockNode('lane', 'bpmn-lane', 40, 0, 320, 120)
    lane.__setParent(poolA)
    const graph = createMockGraph([poolA, poolB, lane])

    setupPoolContainment(graph, { onViolation })
    graph.emit('node:added', { node: lane })

    lane.setPosition(560, 0)
    graph.emit('node:change:position', { node: lane, options: { selection: 'selection-lane-1' } })

    lane.setPosition(620, 0)
    graph.emit('node:change:position', { node: lane, options: { selection: 'selection-lane-1' } })

    expect(onViolation).toHaveBeenCalledOnce()
    expect(lane.setPosition).toHaveBeenLastCalledWith(40, 0, { silent: false })
    expect(lane.getPosition()).toEqual({ x: 40, y: 0 })
  })

  it('constrainToContainer=false 时，Lane 越界只提示不回退并保持当前位移', () => {
    const onViolation = vi.fn()
    const poolA = createMockNode('pool-a', 'bpmn-pool', 0, 0, 400, 240)
    const poolB = createMockNode('pool-b', 'bpmn-pool', 520, 0, 400, 240)
    const lane = createMockNode('lane', 'bpmn-lane', 40, 0, 320, 120)
    lane.__setParent(poolA)
    const graph = createMockGraph([poolA, poolB, lane])

    setupPoolContainment(graph, { onViolation, constrainToContainer: false })
    graph.emit('node:added', { node: lane })

    lane.setPosition(560, 0)
    graph.emit('node:change:position', { node: lane })

    expect(onViolation).toHaveBeenCalledOnce()
    expect(lane.getPosition()).toEqual({ x: 560, y: 0 })
    expect(lane.getParent()?.id).toBe('pool-a')
  })

  it('Pool 拖拽期间子节点联动 position change 不应被独立回退', () => {
    const onViolation = vi.fn()
    const pool = createMockNode('pool', 'bpmn-pool', 0, 0, 400, 240)
    const task = createMockNode('task', 'bpmn-user-task', 100, 20, 100, 60)
    task.__setParent(pool)
    const graph = createMockGraph([pool, task])

    setupPoolContainment(graph, { onViolation })
    graph.emit('node:added', { node: pool })
    graph.emit('node:added', { node: task })

    emitGraphEvent(graph, 'node:moving', { node: pool })
    task.setPosition(140, 60)
    graph.emit('node:change:position', { node: task })

    expect(onViolation).not.toHaveBeenCalled()
    expect(task.setPosition).toHaveBeenCalledTimes(1)
    expect(task.getPosition()).toEqual({ x: 140, y: 60 })
  })

  it('Pool 拖拽期间嵌套在 Lane 内的子节点联动 position change 也不应被独立回退', () => {
    const onViolation = vi.fn()
    const pool = createMockNode('pool', 'bpmn-pool', 0, 0, 400, 240)
    const lane = createMockNode('lane', 'bpmn-lane', 40, 0, 360, 120)
    lane.__setParent(pool)
    const task = createMockNode('task', 'bpmn-user-task', 100, 20, 100, 60)
    task.__setParent(lane)
    const graph = createMockGraph([pool, lane, task])

    setupPoolContainment(graph, { onViolation })
    graph.emit('node:added', { node: pool })
    graph.emit('node:added', { node: lane })
    graph.emit('node:added', { node: task })

    emitGraphEvent(graph, 'node:moving', { node: pool })
    task.setPosition(170, 50)
    graph.emit('node:change:position', { node: task })

    expect(onViolation).not.toHaveBeenCalled()
    expect(task.setPosition).toHaveBeenCalledTimes(1)
    expect(task.getPosition()).toEqual({ x: 170, y: 50 })
  })

  it('Pool 拖拽时父链暂失的已记录子节点，仍应沿记住的 Lane 容器链继续随动', () => {
    const pool = createMockNode('pool', 'bpmn-pool', 0, 0, 400, 240)
    const lane = createMockNode('lane', 'bpmn-lane', 40, 0, 360, 120)
    lane.__setParent(pool)
    const task = createMockNode('task', 'bpmn-user-task', 100, 20, 100, 60)
    task.__setParent(lane)
    const graph = createMockGraph([pool, lane, task])

    setupPoolContainment(graph)
    emitGraphEvent(graph, 'node:added', { node: lane })
    emitGraphEvent(graph, 'node:added', { node: task })

    task.__setParent(null)
    pool.setPosition(40, 10)
    emitGraphEvent(graph, 'node:change:position', { node: pool })

    expect(task.getPosition()).toEqual({ x: 140, y: 30 })
  })

  it('Pool 在 moved 收尾阶段也应继续补位随动父链暂失的已记录子节点', () => {
    const pool = createMockNode('pool', 'bpmn-pool', 0, 0, 400, 240)
    const lane = createMockNode('lane', 'bpmn-lane', 40, 0, 360, 120)
    lane.__setParent(pool)
    const task = createMockNode('task', 'bpmn-user-task', 100, 20, 100, 60)
    task.__setParent(lane)
    const graph = createMockGraph([pool, lane, task])

    setupPoolContainment(graph)
    emitGraphEvent(graph, 'node:added', { node: pool })
    emitGraphEvent(graph, 'node:added', { node: lane })
    emitGraphEvent(graph, 'node:added', { node: task })

    emitGraphEvent(graph, 'node:moving', { node: pool })
    task.__setParent(null)
    pool.setPosition(40, 10)
    emitGraphEvent(graph, 'node:moved', { node: pool })

    expect(task.getPosition()).toEqual({ x: 140, y: 30 })
  })

  it('Pool 拖拽期间 Lane 自身的联动 position change 也不应被独立回退', () => {
    const onViolation = vi.fn()
    const pool = createMockNode('pool', 'bpmn-pool', 0, 0, 400, 240)
    const lane = createMockNode('lane', 'bpmn-lane', 40, 0, 360, 120)
    lane.__setParent(pool)
    const graph = createMockGraph([pool, lane])

    setupPoolContainment(graph, { onViolation })
    graph.emit('node:added', { node: pool })
    graph.emit('node:added', { node: lane })

    emitGraphEvent(graph, 'node:moving', { node: pool })
    lane.setPosition(110, 30)
    graph.emit('node:change:position', { node: lane })

    expect(onViolation).not.toHaveBeenCalled()
    expect(lane.setPosition).toHaveBeenCalledTimes(1)
    expect(lane.getPosition()).toEqual({ x: 110, y: 30 })
  })

  it('存在其他泳池拖拽时，当前节点的独立 moving 校验应直接短路', () => {
    const onViolation = vi.fn()
    const poolA = createMockNode('pool-a', 'bpmn-pool', 0, 0, 400, 240)
    const poolB = createMockNode('pool-b', 'bpmn-pool', 520, 0, 400, 240)
    const task = createMockNode('task', 'bpmn-user-task', 620, 20, 100, 60)
    task.__setParent(poolB)
    const graph = createMockGraph([poolA, poolB, task])

    setupPoolContainment(graph, { onViolation })
    emitGraphEvent(graph, 'node:added', { node: task })

    emitGraphEvent(graph, 'node:moving', { node: poolA })
    task.setPosition(980, 260)
    emitGraphEvent(graph, 'node:moving', { node: task })

    expect(onViolation).not.toHaveBeenCalled()
    expect(task.getPosition()).toEqual({ x: 980, y: 260 })
  })

  it('Pool 拖入另一 Pool 时应回退到原位置', () => {
    const onViolation = vi.fn()
    const poolA = createMockNode('pool-a', 'bpmn-pool', 0, 0, 400, 240)
    const poolB = createMockNode('pool-b', 'bpmn-pool', 520, 0, 400, 240)
    const graph = createMockGraph([poolA, poolB])

    setupPoolContainment(graph, { onViolation })
    graph.emit('node:added', { node: poolA })
    graph.emit('node:added', { node: poolB })

    poolA.setPosition(560, 0)
    emitGraphEvent(graph, 'node:moving', { node: poolA })

    expect(onViolation).toHaveBeenCalledOnce()
    expect(poolA.setPosition).toHaveBeenLastCalledWith(0, 0, { silent: false })
  })

  it('Pool 拖拽基线晚到时，不应把已随动的嵌套泳道与子节点回写成较小位移', () => {
    const pool = createMockNode('pool', 'bpmn-pool', 0, 0, 400, 240)
    const lane = createMockNode('lane', 'bpmn-lane', 40, 0, 360, 120)
    lane.__setParent(pool)
    const task = createMockNode('task', 'bpmn-user-task', 100, 20, 100, 60)
    task.__setParent(lane)
    const graph = createMockGraph([pool, lane, task])

    setupPoolContainment(graph)
    graph.emit('node:added', { node: pool })
    graph.emit('node:added', { node: lane })
    graph.emit('node:added', { node: task })

    pool.setPosition(40, 10)
    emitGraphEvent(graph, 'node:change:position', { node: pool })

    pool.setPosition(70, 30)
    lane.setPosition(110, 30)
    task.setPosition(170, 50)
    emitGraphEvent(graph, 'node:moved', { node: pool })

    expect(lane.getPosition()).toEqual({ x: 110, y: 30 })
    expect(task.getPosition()).toEqual({ x: 170, y: 50 })
  })

  it('泳道仍合法但内部子节点越界时，应在泳道移动校验阶段回退子节点', () => {
    const pool = createMockNode('pool', 'bpmn-pool', 0, 0, 400, 240)
    const lane = createMockNode('lane', 'bpmn-lane', 40, 0, 360, 120)
    lane.__setParent(pool)
    const task = createMockNode('task', 'bpmn-user-task', 100, 20, 100, 60)
    task.__setParent(lane)
    const graph = createMockGraph([pool, lane, task])

    setupPoolContainment(graph)

    task.setPosition(420, 260)
    emitGraphEvent(graph, 'node:moving', { node: lane })

    expect(task.setPosition).toHaveBeenLastCalledWith(100, 20, { silent: false })
    expect(task.getPosition()).toEqual({ x: 100, y: 20 })
  })

  it('Lane 回退后 childIds 已失效时，抬起鼠标仍应回退为扫描当前父链修复子节点', () => {
    const ownerDocument = createMockDocument()
    const leftPool = createMockNode('pool-left', 'bpmn-pool', 0, 0, 400, 240)
    const rightPool = createMockNode('pool-right', 'bpmn-pool', 460, 0, 400, 240)
    const lane = createMockNode('lane', 'bpmn-lane', 40, 0, 360, 120)
    lane.__setParent(leftPool)
    const task = createMockNode('task', 'bpmn-user-task', 100, 20, 100, 60)
    task.__setParent(lane)
    const graph = createMockGraph([leftPool, rightPool, lane, task]) as ReturnType<typeof createMockGraph> & {
      container?: { ownerDocument: ReturnType<typeof createMockDocument> }
      getCellById?: (id: string) => null
    }
    graph.container = { ownerDocument }
    graph.getCellById = () => null

    setupPoolContainment(graph)

    lane.setPosition(520, 0)
    task.setPosition(540, 20)
    emitGraphEvent(graph, 'node:moving', { node: lane })
    ownerDocument.dispatchEvent({ type: 'mouseup' })

    expect(lane.getPosition()).toEqual({ x: 40, y: 0 })
    expect(task.getPosition()).toEqual({ x: 100, y: 20 })
    expect(task.getParent()?.id).toBe(lane.id)
  })

  it('回退位置时 translate 抛异常应退化为 setPosition', () => {
    const onViolation = vi.fn()
    const pool = createMockNode('pool', 'bpmn-pool', 0, 0, 400, 240)
    const lane = createMockNode('lane', 'bpmn-lane', 40, 0, 360, 120)
    lane.__setParent(pool)
    const task = createMockNode('task', 'bpmn-user-task', 100, 20, 100, 60) as ReturnType<typeof createMockNode> & {
      translate?: ReturnType<typeof vi.fn>
    }
    task.__setParent(lane)
    task.translate = vi.fn(() => {
      throw new Error('boom')
    })
    const graph = createMockGraph([pool, lane, task])

    setupPoolContainment(graph, { onViolation })
    graph.emit('node:added', { node: task })

    task.setPosition(420, 260)
    graph.emit('node:moving', { node: task })

    expect(onViolation).toHaveBeenCalledOnce()
    expect(task.translate).toHaveBeenCalled()
    expect(task.setPosition).toHaveBeenLastCalledWith(100, 20, { silent: false })
  })

  it('Lane 回退时 tracked childIds 命中节点时，应优先按已记录子节点恢复', () => {
    const leftPool = createMockNode('pool-left', 'bpmn-pool', 0, 0, 400, 240)
    const rightPool = createMockNode('pool-right', 'bpmn-pool', 460, 0, 400, 240)
    const lane = createMockNode('lane', 'bpmn-lane', 40, 0, 360, 120)
    lane.__setParent(leftPool)
    const task = createMockNode('task', 'bpmn-user-task', 100, 20, 100, 60)
    task.__setParent(lane)
    const graph = createMockGraph([leftPool, rightPool, lane, task]) as ReturnType<typeof createMockGraph> & {
      getCellById?: (id: string) => ReturnType<typeof createMockNode> | null
    }
    graph.getCellById = (id: string) => (id === task.id ? task : null)

    setupPoolContainment(graph)

    lane.setPosition(520, 0)
    task.setPosition(540, 20)
    emitGraphEvent(graph, 'node:moving', { node: lane })

    expect(lane.getPosition()).toEqual({ x: 40, y: 0 })
    expect(task.getPosition()).toEqual({ x: 100, y: 20 })
  })

  it('延迟修复泳道子节点时，graph.getNodes 抛异常也不应中断', () => {
    const ownerDocument = createMockDocument()
    const leftPool = createMockNode('pool-left', 'bpmn-pool', 0, 0, 400, 240)
    const rightPool = createMockNode('pool-right', 'bpmn-pool', 460, 0, 400, 240)
    const lane = createMockNode('lane', 'bpmn-lane', 40, 0, 360, 120)
    lane.__setParent(leftPool)
    const task = createMockNode('task', 'bpmn-user-task', 100, 20, 100, 60)
    task.__setParent(lane)
    const graph = createMockGraph([leftPool, rightPool, lane, task]) as ReturnType<typeof createMockGraph> & {
      container?: { ownerDocument: ReturnType<typeof createMockDocument> }
      getCellById?: (id: string) => ReturnType<typeof createMockNode> | null
      getNodes: () => Array<ReturnType<typeof createMockNode>>
    }
    graph.container = { ownerDocument }
    graph.getCellById = (id: string) => (id === task.id ? task : null)

    setupPoolContainment(graph)

    lane.setPosition(520, 0)
    task.setPosition(540, 20)
    emitGraphEvent(graph, 'node:moving', { node: lane })

    graph.getNodes = () => {
      throw new Error('boom')
    }

    expect(() => ownerDocument.dispatchEvent({ type: 'mouseup' })).not.toThrow()
  })

  it('非拖拽的重复越界事件只应提示一次', () => {
    const onViolation = vi.fn()
    const pool = createMockNode('pool', 'bpmn-pool', 0, 0, 400, 240)
    const lane = createMockNode('lane', 'bpmn-lane', 40, 0, 360, 120)
    lane.__setParent(pool)
    const task = createMockNode('task', 'bpmn-user-task', 100, 20, 100, 60)
    task.__setParent(lane)
    const graph = createMockGraph([pool, lane, task])

    setupPoolContainment(graph, { onViolation, constrainToContainer: false })
    graph.emit('node:added', { node: task })

    task.setPosition(420, 260)
    graph.emit('node:change:position', { node: task })
    graph.emit('node:change:position', { node: task })

    expect(onViolation).toHaveBeenCalledOnce()
  })

  it('回退过程中再次触发 moving/change 事件时应短路，避免重入', () => {
    const onViolation = vi.fn()
    const pool = createMockNode('pool', 'bpmn-pool', 0, 0, 400, 240)
    const lane = createMockNode('lane', 'bpmn-lane', 40, 0, 360, 120)
    lane.__setParent(pool)
    const task = createMockNode('task', 'bpmn-user-task', 100, 20, 100, 60)
    task.__setParent(lane)
    const graph = createMockGraph([pool, lane, task])

    setupPoolContainment(graph, { onViolation })
    graph.emit('node:added', { node: task })

    const baseSetPosition = task.setPosition
    baseSetPosition(420, 260)
    task.setPosition = vi.fn((nextX: number, nextY: number, options?: unknown) => {
      graph.emit('node:moving', { node: task })
      graph.emit('node:change:position', { node: task })
      graph.emit('node:moved', { node: task })
      baseSetPosition(nextX, nextY, options)
    })

    expect(() => graph.emit('node:change:position', { node: task })).not.toThrow()
    expect(onViolation).toHaveBeenCalledOnce()
  })

  it('同步校验阶段若 Pool 集合变化导致缺失建议容器时也应容忍', () => {
    const pool = createMockNode('pool', 'bpmn-pool', 0, 0, 400, 240)
    const lane = createMockNode('lane', 'bpmn-lane', 40, 0, 360, 120)
    lane.__setParent(pool)
    const task = createMockNode('task', 'bpmn-user-task', 100, 20, 100, 60)
    task.__setParent(lane)

    const graph = createMockGraph([pool, lane, task])
    let callCount = 0
    graph.getNodes = () => {
      callCount += 1
      return callCount <= 2 ? [pool, lane, task] : []
    }

    setupPoolContainment(graph)

    expect(() => graph.emit('node:added', { node: task })).not.toThrow()
  })

  it('node:change:parent 丢失父链但仍位于泳道内时应重新嵌入', () => {
    const pool = createMockNode('pool', 'bpmn-pool', 0, 0, 400, 240)
    const lane = createMockNode('lane', 'bpmn-lane', 40, 0, 360, 120)
    lane.__setParent(pool)
    const task = createMockNode('task', 'bpmn-user-task', 100, 20, 100, 60)
    task.__setParent(lane)
    const graph = createMockGraph([pool, lane, task])

    setupPoolContainment(graph)
    graph.emit('node:added', { node: task })

    lane.unembed(task)
    task.__setParent(null)
    graph.emit('node:change:parent', { node: task })

    expect(lane.embed).toHaveBeenLastCalledWith(task)
    expect(task.getParent()?.id).toBe('lane')
  })

  it('容器 getChildren 返回非数组时，应退化为重新嵌入且不中断', () => {
    const pool = createMockNode('pool', 'bpmn-pool', 0, 0, 400, 240)
    const lane = createMockNode('lane', 'bpmn-lane', 40, 0, 360, 120) as ReturnType<typeof createMockNode> & {
      getChildren: () => null
    }
    lane.__setParent(pool)
    lane.getChildren = () => null

    const task = createMockNode('task', 'bpmn-user-task', 100, 20, 100, 60)
    task.__setParent(lane)

    const graph = createMockGraph([pool, lane, task])

    setupPoolContainment(graph)
    expect(() => graph.emit('node:added', { node: task })).not.toThrow()
    expect(lane.embed).toHaveBeenCalledWith(task)
    expect(task.getParent()?.id).toBe('lane')
  })

  it('容器 getChildren 抛异常时，应退化为重新嵌入且不中断', () => {
    const pool = createMockNode('pool', 'bpmn-pool', 0, 0, 400, 240)
    const lane = createMockNode('lane', 'bpmn-lane', 40, 0, 360, 120) as ReturnType<typeof createMockNode> & {
      getChildren: () => never
    }
    lane.__setParent(pool)
    lane.getChildren = () => {
      throw new Error('mock getChildren error')
    }

    const task = createMockNode('task', 'bpmn-user-task', 100, 20, 100, 60)
    task.__setParent(lane)

    const graph = createMockGraph([pool, lane, task])

    setupPoolContainment(graph)
    expect(() => graph.emit('node:added', { node: task })).not.toThrow()
    expect(lane.embed).toHaveBeenCalledWith(task)
    expect(task.getParent()?.id).toBe('lane')
  })

  it('回退阶段若仍找不到期望容器，应仅恢复已记录的位置且不中断', () => {
    const onViolation = vi.fn()
    const pool = createMockNode('pool', 'bpmn-pool', 0, 0, 400, 240)
    const task = createMockNode('task', 'bpmn-user-task', 420, 260, 100, 60)
    const graph = createMockGraph([pool, task])

    setupPoolContainment(graph, { onViolation })
    expect(() => graph.emit('node:moved', { node: task })).not.toThrow()

    expect(onViolation).toHaveBeenCalledOnce()
    expect(task.getPosition()).toEqual({ x: 420, y: 260 })
    expect(task.getParent()).toBeNull()
  })

  it('node:moved 回退位置与当前位置一致时应直接短路', () => {
    const onViolation = vi.fn()
    const pool = createMockNode('pool', 'bpmn-pool', 0, 0, 400, 240)
    const lane = createMockNode('lane', 'bpmn-lane', 40, 0, 360, 120)
    lane.__setParent(pool)
    const task = createMockNode('task', 'bpmn-user-task', 100, 20, 100, 60)
    task.__setParent(lane)
    const graph = createMockGraph([pool, lane, task])

    setupPoolContainment(graph, { onViolation })
    graph.emit('node:added', { node: task })

    lane.getSize = () => ({ width: 40, height: 20 })
    pool.getSize = () => ({ width: 80, height: 40 })
    graph.emit('node:moved', { node: task })

    expect(onViolation).toHaveBeenCalledOnce()
    expect(task.setPosition).not.toHaveBeenCalled()
  })

  it('constrainToContainer=false 时越界只提示不回退', () => {
    const onViolation = vi.fn()
    const pool = createMockNode('pool', 'bpmn-pool', 0, 0, 400, 240)
    const lane = createMockNode('lane', 'bpmn-lane', 40, 0, 360, 120)
    lane.__setParent(pool)
    const task = createMockNode('task', 'bpmn-user-task', 100, 20, 100, 60)
    task.__setParent(lane)
    const graph = createMockGraph([pool, lane, task])

    setupPoolContainment(graph, { onViolation, constrainToContainer: false })
    graph.emit('node:added', { node: task })
    task.setPosition(420, 260)
    graph.emit('node:moving', { node: task })

    expect(onViolation).toHaveBeenCalledOnce()
    expect(task.setPosition).not.toHaveBeenLastCalledWith(100, 20)
  })

  it('node:moved 在 constrainToContainer=false 时越界只提示不回退', () => {
    const onViolation = vi.fn()
    const pool = createMockNode('pool', 'bpmn-pool', 0, 0, 400, 240)
    const lane = createMockNode('lane', 'bpmn-lane', 40, 0, 360, 120)
    lane.__setParent(pool)
    const task = createMockNode('task', 'bpmn-user-task', 100, 20, 100, 60)
    task.__setParent(lane)
    const graph = createMockGraph([pool, lane, task])

    setupPoolContainment(graph, { onViolation, constrainToContainer: false })
    graph.emit('node:added', { node: task })
    task.setPosition(420, 260)
    graph.emit('node:moved', { node: task })

    expect(onViolation).toHaveBeenCalledOnce()
    expect(task.setPosition).not.toHaveBeenLastCalledWith(100, 20)
  })

  it('无 lastValidPosition 时越界不应抛异常', () => {
    const onViolation = vi.fn()
    const pool = createMockNode('pool', 'bpmn-pool', 0, 0, 400, 240)
    const task = createMockNode('task', 'bpmn-user-task', 420, 260, 100, 60)
    const graph = createMockGraph([pool])

    setupPoolContainment(graph, { onViolation })
    expect(() => graph.emit('node:moving', { node: task })).not.toThrow()
    expect(onViolation).toHaveBeenCalledOnce()
  })

  it('node:moved 在无 lastValidPosition 时越界不应抛异常', () => {
    const onViolation = vi.fn()
    const pool = createMockNode('pool', 'bpmn-pool', 0, 0, 400, 240)
    const task = createMockNode('task', 'bpmn-user-task', 420, 260, 100, 60)
    const graph = createMockGraph([pool])

    setupPoolContainment(graph, { onViolation })
    expect(() => graph.emit('node:moved', { node: task })).not.toThrow()
    expect(onViolation).toHaveBeenCalledOnce()
  })

  it('真实 Graph 中普通流程节点线性越界后应回退到越界前最后一个 Pool 内合法位置', () => {
    registerBehaviorTestShapes([BPMN_POOL, BPMN_LANE, BPMN_USER_TASK])

    const graph = createBehaviorTestGraph()
    const onViolation = vi.fn()
    const dispose = setupPoolContainment(graph, { onViolation })

    const pool = graph.addNode({
      id: 'pool',
      shape: BPMN_POOL,
      x: 0,
      y: 0,
      width: 400,
      height: 240,
      data: { bpmn: { isHorizontal: true } },
      attrs: { headerLabel: { text: 'Pool' } },
    })
    const lane = graph.addNode({
      id: 'lane',
      shape: BPMN_LANE,
      x: 40,
      y: 0,
      width: 360,
      height: 120,
      parent: pool.id,
      data: { bpmn: { isHorizontal: true } },
      attrs: { headerLabel: { text: 'Lane' } },
    })
    const task = graph.addNode({
      id: 'task',
      shape: BPMN_USER_TASK,
      x: 100,
      y: 20,
      width: 100,
      height: 60,
      parent: lane.id,
      attrs: { label: { text: 'Task' } },
    })
    pool.embed(lane)
    lane.embed(task)

    emitGraphEvent(graph, 'node:added', { node: task })
    dragNodeByPositionLinearly(graph, task, { x: 320, y: 240 }, 8)

    const taskRect = getNodeRect(task)
    const poolRect = getNodeRect(pool)

    expect(onViolation).toHaveBeenCalledOnce()
    expect(task.getParent()?.id).toBe(pool.id)
    expect(taskRect.x).toBeGreaterThan(100)
    expect(taskRect.y).toBeGreaterThan(20)
    expect(taskRect.x + taskRect.width).toBeLessThanOrEqual(poolRect.x + poolRect.width)
    expect(taskRect.y + taskRect.height).toBeLessThanOrEqual(poolRect.y + poolRect.height)

    dispose()
    destroyBehaviorTestGraph(graph)
  })

  it('导入后首次直拖前即使未记住基线，也应以当前合法位置作为回退起点', () => {
    const onViolation = vi.fn()
    const nodes: ReturnType<typeof createMockNode>[] = []
    const graph = createMockGraph(nodes)

    setupPoolContainment(graph, { onViolation })

    const pool = createMockNode('pool', 'bpmn-pool', 0, 0, 400, 240)
    const lane = createMockNode('lane', 'bpmn-lane', 40, 0, 360, 120)
    lane.__setParent(pool)
    const task = createMockNode('task', 'bpmn-user-task', 100, 20, 100, 60)
    task.__setParent(lane)
    nodes.push(pool, lane, task)

    graph.emit('node:moving', { node: task })

    task.setPosition(420, 260)
    graph.emit('node:moving', { node: task })
    graph.emit('node:moved', { node: task })

    expect(onViolation).toHaveBeenCalledOnce()
    expect(task.setPosition).toHaveBeenLastCalledWith(100, 20, { silent: false })
    expect(task.getParent()?.id).toBe('lane')
    expect(task.getPosition()).toEqual({ x: 100, y: 20 })
  })

  it('真实 Graph 中节点越界期间若失去父容器，回退后应恢复父链', () => {
    registerBehaviorTestShapes([BPMN_POOL, BPMN_LANE, BPMN_USER_TASK])

    const graph = createBehaviorTestGraph()
    const onViolation = vi.fn()
    const dispose = setupPoolContainment(graph, { onViolation })

    const pool = graph.addNode({
      id: 'pool',
      shape: BPMN_POOL,
      x: 0,
      y: 0,
      width: 400,
      height: 240,
      data: { bpmn: { isHorizontal: true } },
      attrs: { headerLabel: { text: 'Pool' } },
    })
    const lane = graph.addNode({
      id: 'lane',
      shape: BPMN_LANE,
      x: 40,
      y: 0,
      width: 360,
      height: 120,
      parent: pool.id,
      data: { bpmn: { isHorizontal: true } },
      attrs: { headerLabel: { text: 'Lane' } },
    })
    const task = graph.addNode({
      id: 'task',
      shape: BPMN_USER_TASK,
      x: 100,
      y: 20,
      width: 100,
      height: 60,
      parent: lane.id,
      attrs: { label: { text: 'Task' } },
    })

    pool.embed(lane)
    lane.embed(task)
    emitGraphEvent(graph, 'node:added', { node: task })

    lane.unembed(task)
    task.setPosition(420, 260)
    emitGraphEvent(graph, 'node:moved', { node: task })

    expect(onViolation).toHaveBeenCalledOnce()
    expect(task.getParent()?.id).toBe(lane.id)
    expect(task.getPosition()).toEqual({ x: 100, y: 20 })

    dispose()
    destroyBehaviorTestGraph(graph)
  })

  it('真实 Graph 中拖拽 Lane 跨 Pool 失败后，子任务也应保持原父链', () => {
    registerBehaviorTestShapes([BPMN_POOL, BPMN_LANE, BPMN_USER_TASK])

    const graph = createBehaviorTestGraph()
    const dispose = setupPoolContainment(graph)

    const leftPool = graph.addNode({
      id: 'pool-left',
      shape: BPMN_POOL,
      x: 40,
      y: 40,
      width: 340,
      height: 220,
      data: { bpmn: { isHorizontal: true } },
      attrs: { headerLabel: { text: 'LeftPool' } },
    })
    const rightPool = graph.addNode({
      id: 'pool-right',
      shape: BPMN_POOL,
      x: 480,
      y: 40,
      width: 340,
      height: 220,
      data: { bpmn: { isHorizontal: true } },
      attrs: { headerLabel: { text: 'RightPool' } },
    })
    const lane = graph.addNode({
      id: 'lane-left',
      shape: BPMN_LANE,
      x: 70,
      y: 40,
      width: 310,
      height: 220,
      parent: leftPool.id,
      data: { bpmn: { isHorizontal: true } },
      attrs: { headerLabel: { text: 'LeftLane' } },
    })
    const task = graph.addNode({
      id: 'task-left',
      shape: BPMN_USER_TASK,
      x: 150,
      y: 110,
      width: 110,
      height: 60,
      parent: lane.id,
      attrs: { label: { text: 'Task' } },
    })

    leftPool.embed(lane)
    lane.embed(task)
    emitGraphEvent(graph, 'node:added', { node: lane })
    emitGraphEvent(graph, 'node:added', { node: task })

    dragNodeLinearly(graph, lane, { x: 440, y: 0 }, 8)

    expect(rightPool.getChildren?.()?.length ?? 0).toBe(0)
    expect(lane.getParent()?.id).toBe(leftPool.id)
    expect(task.getParent()?.id).toBe(lane.id)
    expect(getNodeRect(lane)).toMatchObject({ x: 70, y: 40, width: 310, height: 220 })
    const taskRect = getNodeRect(task)
    expect(taskRect.width).toBe(110)
    expect(taskRect.height).toBe(60)
    expect(Math.abs(taskRect.x - 150)).toBeLessThanOrEqual(6)
    expect(Math.abs(taskRect.y - 110)).toBeLessThanOrEqual(6)

    dispose()
    destroyBehaviorTestGraph(graph)
  })

  it('父指针已恢复但容器 children 链缺失时，回退阶段仍应补做嵌入修复', () => {
    const onViolation = vi.fn()
    const pool = createMockNode('pool', 'bpmn-pool', 0, 0, 400, 240)
    const lane = createMockNode('lane', 'bpmn-lane', 40, 0, 360, 120) as ReturnType<typeof createMockNode> & {
      getChildren: () => never[]
    }
    lane.__setParent(pool)
    lane.getChildren = () => []

    const task = createMockNode('task', 'bpmn-user-task', 100, 20, 100, 60)
    task.__setParent(lane)

    const graph = createMockGraph([pool, lane, task])

    setupPoolContainment(graph, { onViolation })
    graph.emit('node:added', { node: task })
    lane.embed.mockClear()

    task.setPosition(420, 260)
    graph.emit('node:moved', { node: task })

    expect(onViolation).toHaveBeenCalledOnce()
    expect(lane.embed).toHaveBeenCalledOnce()
    expect(lane.embed).toHaveBeenLastCalledWith(task)
    expect(task.getParent()?.id).toBe('lane')
    expect(task.getPosition()).toEqual({ x: 100, y: 20 })
  })

  it('真实 Graph 中宿主线性越界回退到 Pool 内时，边界事件也应随宿主一起保持附着', () => {
    registerBehaviorTestShapes([BPMN_POOL, BPMN_LANE, BPMN_USER_TASK, BPMN_BOUNDARY_EVENT_TIMER])

    const graph = createBehaviorTestGraph()
    const onViolation = vi.fn()
    const dispose = setupPoolContainment(graph, { onViolation })

    const pool = graph.addNode({
      id: 'pool',
      shape: BPMN_POOL,
      x: 0,
      y: 0,
      width: 400,
      height: 240,
      data: { bpmn: { isHorizontal: true } },
      attrs: { headerLabel: { text: 'Pool' } },
    })
    const lane = graph.addNode({
      id: 'lane',
      shape: BPMN_LANE,
      x: 40,
      y: 0,
      width: 360,
      height: 120,
      parent: pool.id,
      data: { bpmn: { isHorizontal: true } },
      attrs: { headerLabel: { text: 'Lane' } },
    })
    const task = graph.addNode({
      id: 'task',
      shape: BPMN_USER_TASK,
      x: 100,
      y: 20,
      width: 100,
      height: 60,
      parent: lane.id,
      attrs: { label: { text: 'Task' } },
    })
    const boundary = graph.addNode({
      id: 'boundary',
      shape: BPMN_BOUNDARY_EVENT_TIMER,
      x: 182,
      y: 32,
      width: 36,
      height: 36,
    })

    attachBoundaryToHost(graph, boundary, task)
    emitGraphEvent(graph, 'node:added', { node: task })
    dragNodeLinearly(graph, task, { x: 320, y: 240 }, 8)

    const taskRect = getNodeRect(task)
    const poolRect = getNodeRect(pool)

    expect(onViolation).toHaveBeenCalledOnce()
    expect(task.getParent()?.id).toBe(pool.id)
    expect(taskRect.x).toBeGreaterThan(100)
    expect(taskRect.y).toBeGreaterThan(20)
    expect(taskRect.x + taskRect.width).toBeLessThanOrEqual(poolRect.x + poolRect.width)
    expect(taskRect.y + taskRect.height).toBeLessThanOrEqual(poolRect.y + poolRect.height)
    expect(boundary.getParent()?.id).toBe(task.id)
    expect(distanceToRectEdge(getNodeCenter(boundary), getNodeRect(task))).toBeCloseTo(0, 5)

    dispose()
    destroyBehaviorTestGraph(graph)
  })

  it('真实 Graph 中节点越界恢复后，再拖拽 Pool 时应继续带动嵌套 Lane 与任务', () => {
    registerBehaviorTestShapes([BPMN_POOL, BPMN_LANE, BPMN_USER_TASK])

    const graph = createBehaviorTestGraph()
    const dispose = setupPoolContainment(graph)

    const pool = graph.addNode({
      id: 'pool-1',
      shape: BPMN_POOL,
      x: 40,
      y: 40,
      width: 400,
      height: 220,
      data: { bpmn: { isHorizontal: true } },
      attrs: { headerLabel: { text: 'Pool' } },
    })
    const lane = graph.addNode({
      id: 'lane-1',
      shape: BPMN_LANE,
      x: 70,
      y: 40,
      width: 370,
      height: 120,
      parent: pool.id,
      data: { bpmn: { isHorizontal: true } },
      attrs: { headerLabel: { text: 'Lane' } },
    })
    const task = graph.addNode({
      id: 'task-1',
      shape: BPMN_USER_TASK,
      x: 120,
      y: 70,
      width: 100,
      height: 60,
      parent: lane.id,
      attrs: { label: { text: 'Task' } },
    })

    pool.embed(lane)
    lane.embed(task)
    emitGraphEvent(graph, 'node:added', { node: pool })
    emitGraphEvent(graph, 'node:added', { node: lane })
    emitGraphEvent(graph, 'node:added', { node: task })

    dragNodeLinearly(graph, task, { x: 320, y: 240 }, 8)
    const restoredTaskParentId = task.getParent()?.id ?? null

    const poolBefore = getNodeRect(pool)
    const laneBefore = getNodeRect(lane)
    const taskBefore = getNodeRect(task)

    dragNodeByPositionLinearly(graph, pool, { x: 70, y: 30 }, 8)

    const poolAfter = getNodeRect(pool)
    const laneAfter = getNodeRect(lane)
    const taskAfter = getNodeRect(task)
    const delta = {
      x: poolAfter.x - poolBefore.x,
      y: poolAfter.y - poolBefore.y,
    }

    expect(delta).toEqual({ x: 70, y: 30 })
    expect(lane.getParent()?.id).toBe(pool.id)
  expect(task.getParent()?.id ?? null).toBe(restoredTaskParentId)
    expect(laneAfter.x - laneBefore.x).toBe(delta.x)
    expect(laneAfter.y - laneBefore.y).toBe(delta.y)
    expect(taskAfter.x - taskBefore.x).toBe(delta.x)
    expect(taskAfter.y - taskBefore.y).toBe(delta.y)

    dispose()
    destroyBehaviorTestGraph(graph)
  })

  it('真实 Graph 中宿主越界恢复后，再拖拽 Pool 时边界事件也应继续随动', () => {
    registerBehaviorTestShapes([BPMN_POOL, BPMN_LANE, BPMN_USER_TASK, BPMN_BOUNDARY_EVENT_TIMER])

    const graph = createBehaviorTestGraph()
    const dispose = setupPoolContainment(graph)

    const pool = graph.addNode({
      id: 'pool-1',
      shape: BPMN_POOL,
      x: 40,
      y: 40,
      width: 400,
      height: 220,
      data: { bpmn: { isHorizontal: true } },
      attrs: { headerLabel: { text: 'Pool' } },
    })
    const lane = graph.addNode({
      id: 'lane-1',
      shape: BPMN_LANE,
      x: 70,
      y: 40,
      width: 370,
      height: 120,
      parent: pool.id,
      data: { bpmn: { isHorizontal: true } },
      attrs: { headerLabel: { text: 'Lane' } },
    })
    const task = graph.addNode({
      id: 'task-1',
      shape: BPMN_USER_TASK,
      x: 120,
      y: 70,
      width: 100,
      height: 60,
      parent: lane.id,
      attrs: { label: { text: 'Task' } },
    })
    const boundary = graph.addNode({
      id: 'boundary-1',
      shape: BPMN_BOUNDARY_EVENT_TIMER,
      x: 202,
      y: 82,
      width: 36,
      height: 36,
    })

    pool.embed(lane)
    lane.embed(task)
    attachBoundaryToHost(graph, boundary, task)
    emitGraphEvent(graph, 'node:added', { node: pool })
    emitGraphEvent(graph, 'node:added', { node: lane })
    emitGraphEvent(graph, 'node:added', { node: task })

    dragNodeByPositionLinearly(graph, task, { x: 320, y: 240 }, 8)
    const restoredTaskParentId = task.getParent()?.id ?? null
    expect(boundary.getParent()?.id).toBe(task.id)

    const poolBefore = getNodeRect(pool)
    const taskBefore = getNodeRect(task)
    const boundaryBefore = getNodeRect(boundary)

    dragNodeByPositionLinearly(graph, pool, { x: 60, y: 20 }, 8)

    const poolAfter = getNodeRect(pool)
    const taskAfter = getNodeRect(task)
    const boundaryAfter = getNodeRect(boundary)
    const delta = {
      x: poolAfter.x - poolBefore.x,
      y: poolAfter.y - poolBefore.y,
    }

    expect(delta).toEqual({ x: 60, y: 20 })
  expect(task.getParent()?.id ?? null).toBe(restoredTaskParentId)
    expect(boundary.getParent()?.id).toBe(task.id)
    expect(taskAfter.x - taskBefore.x).toBe(delta.x)
    expect(taskAfter.y - taskBefore.y).toBe(delta.y)
    expect(boundaryAfter.x - boundaryBefore.x).toBe(delta.x)
    expect(boundaryAfter.y - boundaryBefore.y).toBe(delta.y)

    dispose()
    destroyBehaviorTestGraph(graph)
  })

  it('宿主越界回退时应通过 translate 带回已附着的边界事件', () => {
    const onViolation = vi.fn()
    const pool = createCascadeNode('pool', 'bpmn-pool', 0, 0, 400, 240)
    const lane = createCascadeNode('lane', 'bpmn-lane', 40, 0, 360, 120)
    lane.__setParent(pool)
    const task = createCascadeNode('task', 'bpmn-user-task', 100, 20, 100, 60)
    task.__setParent(lane)
    const boundary = createCascadeNode('boundary', 'bpmn-boundary-event-timer', 182, 32, 36, 36)
    task.embed(boundary)
    const graph = createMockGraph([pool, lane, task, boundary])

    setupPoolContainment(graph, { onViolation })
    graph.emit('node:added', { node: task })

    task.translate(320, 240)
    graph.emit('node:moved', { node: task })

    expect(onViolation).toHaveBeenCalledOnce()
    expect(task.translate).toHaveBeenLastCalledWith(-320, -240, { silent: false })
    expect(task.getPosition()).toEqual({ x: 100, y: 20 })
    expect(boundary.getPosition()).toEqual({ x: 182, y: 32 })
  })

  it('宿主提示回调抛异常时不应打断主链路', () => {
    const pool = createMockNode('pool', 'bpmn-pool', 0, 0, 400, 240)
    const task = createMockNode('task', 'bpmn-user-task', 420, 260, 100, 60)
    const graph = createMockGraph([pool, task])

    setupPoolContainment(graph, {
      onViolation: () => { throw new Error('mock host error') },
    })

    expect(() => graph.emit('node:added', { node: task })).not.toThrow()
  })

  it('初始化读取 graph.getNodes 抛异常时不应中断安装', () => {
    const handlers: Record<string, Function[]> = {}
    const graph = {
      getNodes: () => { throw new Error('mock graph error') },
      on: (event: string, fn: Function) => {
        handlers[event] = handlers[event] || []
        handlers[event].push(fn)
      },
      off: (event: string, fn: Function) => {
        handlers[event] = (handlers[event] || []).filter((handler) => handler !== fn)
      },
    } as any

    expect(() => setupPoolContainment(graph)).not.toThrow()
  })
})