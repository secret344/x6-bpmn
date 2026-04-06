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
  let parent: any = null
  let removed = false

  const self: any = {
    id,
    shape,
    getPosition: () => ({ ...position }),
    getSize: () => ({ width, height }),
    setPosition: vi.fn((nextX: number, nextY: number) => {
      position = { x: nextX, y: nextY }
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
    _handlers: handlers,
  } as any
}

function createCascadeNode(id: string, shape: string, x: number, y: number, width: number, height: number) {
  let position = { x, y }
  let parent: any = null
  const children: any[] = []

  const self: any = {
    id,
    shape,
    getPosition: () => ({ ...position }),
    getSize: () => ({ width, height }),
    setPosition: vi.fn((nextX: number, nextY: number) => {
      position = { x: nextX, y: nextY }
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

  it('未设置 parent 但位于泳道内部时应返回建议容器', () => {
    const pool = createMockNode('pool', 'bpmn-pool', 0, 0, 400, 240)
    const lane = createMockNode('lane', 'bpmn-lane', 40, 0, 360, 120)
    const task = createMockNode('task', 'bpmn-user-task', 100, 20, 100, 60)
    const graph = createMockGraph([pool, lane, task])

    const result = validatePoolContainment(graph, task)
    expect(result.valid).toBe(true)
    expect(result.container?.id).toBe('lane')
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
  it('应绑定 node:added 和 node:moving，并返回 dispose 函数', () => {
    const graph = createMockGraph()
    const dispose = setupPoolContainment(graph)
    expect(graph._handlers['node:added']?.length).toBe(1)
    expect(graph._handlers['node:moving']?.length).toBe(1)
    expect(graph._handlers['node:moved']?.length).toBe(1)
    dispose()
    expect(graph._handlers['node:added']?.length).toBe(0)
    expect(graph._handlers['node:moving']?.length).toBe(0)
    expect(graph._handlers['node:moved']?.length).toBe(0)
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

  it('node:added 时泳道节点应直接跳过', () => {
    const pool = createMockNode('pool', 'bpmn-pool', 0, 0, 400, 240)
    const lane = createMockNode('lane', 'bpmn-lane', 40, 0, 360, 120)
    const graph = createMockGraph([pool, lane])

    setupPoolContainment(graph)
    emitGraphEvent(graph, 'node:added', { node: lane })

    expect(lane.remove).not.toHaveBeenCalled()
    expect(pool.embed).not.toHaveBeenCalled()
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

  it('node:added 时若不在任何 Pool / Lane 内应通知并移除节点', () => {
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
    expect(task.setPosition).toHaveBeenLastCalledWith(100, 20)
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
    expect(task.setPosition).toHaveBeenLastCalledWith(100, 20)
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
    expect(task.setPosition).toHaveBeenLastCalledWith(100, 20)
    expect(lane.embed).toHaveBeenLastCalledWith(task)
    expect(task.getParent()?.id).toBe('lane')
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
    expect(task.setPosition).toHaveBeenLastCalledWith(100, 20)
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

  it('node:moving 时泳道节点应直接跳过', () => {
    const pool = createMockNode('pool', 'bpmn-pool', 0, 0, 400, 240)
    const lane = createMockNode('lane', 'bpmn-lane', 40, 0, 360, 120)
    const graph = createMockGraph([pool, lane])

    setupPoolContainment(graph)
    lane.setPosition(60, 0)
    graph.emit('node:moving', { node: lane })

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

  it('真实 Graph 中普通流程节点线性越界后应回弹到最后合法位置', () => {
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
    dragNodeLinearly(graph, task, { x: 320, y: 240 }, 8)

    expect(onViolation).toHaveBeenCalledOnce()
    expect(task.getParent()?.id).toBe(pool.id)
    expect(task.getPosition().x).toBeCloseTo(300, 5)
    expect(task.getPosition().y).toBeCloseTo(170, 5)

    dispose()
    destroyBehaviorTestGraph(graph)
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

  it('真实 Graph 中宿主线性越界回弹时边界事件也应随宿主一起回到边框上', () => {
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

    expect(onViolation).toHaveBeenCalledOnce()
    expect(task.getParent()?.id).toBe(pool.id)
    expect(task.getPosition().x).toBeCloseTo(300, 5)
    expect(task.getPosition().y).toBeCloseTo(170, 5)
    expect(boundary.getParent()?.id).toBe(task.id)
    expect(distanceToRectEdge(getNodeCenter(boundary), getNodeRect(task))).toBeCloseTo(0, 5)

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
    expect(task.translate).toHaveBeenLastCalledWith(-320, -240)
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