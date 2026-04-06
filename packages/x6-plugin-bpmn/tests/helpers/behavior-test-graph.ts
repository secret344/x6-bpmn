import { Graph, type Node } from '@antv/x6'

type TestGraph = Graph & {
  __testContainer?: HTMLDivElement
}

type SvgTransformLike = {
  matrix: TestSvgMatrix
  setMatrix: (matrix: TestSvgMatrix) => void
  setTranslate: (tx: number, ty: number) => void
  setScale: (sx: number, sy: number) => void
  setRotate: (angle: number, cx: number, cy: number) => void
}

class TestSvgMatrix {
  a = 1
  b = 0
  c = 0
  d = 1
  e = 0
  f = 0

  constructor(init?: Partial<TestSvgMatrix>) {
    if (!init) {
      return
    }

    Object.assign(this, init)
  }

  multiply(other: Partial<TestSvgMatrix>): TestSvgMatrix {
    const source = new TestSvgMatrix(other)
    return new TestSvgMatrix({
      a: this.a * source.a + this.c * source.b,
      b: this.b * source.a + this.d * source.b,
      c: this.a * source.c + this.c * source.d,
      d: this.b * source.c + this.d * source.d,
      e: this.a * source.e + this.c * source.f + this.e,
      f: this.b * source.e + this.d * source.f + this.f,
    })
  }

  inverse(): TestSvgMatrix {
    const determinant = this.a * this.d - this.b * this.c
    if (determinant === 0) {
      return new TestSvgMatrix()
    }

    return new TestSvgMatrix({
      a: this.d / determinant,
      b: -this.b / determinant,
      c: -this.c / determinant,
      d: this.a / determinant,
      e: (this.c * this.f - this.d * this.e) / determinant,
      f: (this.b * this.e - this.a * this.f) / determinant,
    })
  }

  translate(tx = 0, ty = 0): TestSvgMatrix {
    return this.multiply({ e: tx, f: ty })
  }

  scale(sx: number, sy = sx): TestSvgMatrix {
    return this.scaleNonUniform(sx, sy)
  }

  scaleNonUniform(sx: number, sy: number): TestSvgMatrix {
    return this.multiply({ a: sx, d: sy })
  }

  rotate(angle: number): TestSvgMatrix {
    const radians = (angle * Math.PI) / 180
    const cos = Math.cos(radians)
    const sin = Math.sin(radians)
    return this.multiply({ a: cos, b: sin, c: -sin, d: cos })
  }

  skewX(angle: number): TestSvgMatrix {
    const radians = (angle * Math.PI) / 180
    return this.multiply({ a: 1, c: Math.tan(radians), d: 1 })
  }

  skewY(angle: number): TestSvgMatrix {
    const radians = (angle * Math.PI) / 180
    return this.multiply({ a: 1, b: Math.tan(radians), d: 1 })
  }
}

function createSvgMatrixLike(init?: Partial<TestSvgMatrix>): TestSvgMatrix {
  return new TestSvgMatrix(init)
}

function createSvgTransformLike(matrix?: Partial<TestSvgMatrix>): SvgTransformLike {
  return {
    matrix: createSvgMatrixLike(matrix),
    setMatrix(nextMatrix: TestSvgMatrix) {
      this.matrix = createSvgMatrixLike(nextMatrix)
    },
    setTranslate(tx: number, ty: number) {
      this.matrix = createSvgMatrixLike().translate(tx, ty)
    },
    setScale(sx: number, sy: number) {
      this.matrix = createSvgMatrixLike().scaleNonUniform(sx, sy)
    },
    setRotate(angle: number, cx: number, cy: number) {
      let nextMatrix = createSvgMatrixLike()
      if (cx !== 0 || cy !== 0) {
        nextMatrix = nextMatrix.translate(cx, cy).rotate(angle).translate(-cx, -cy)
      } else {
        nextMatrix = nextMatrix.rotate(angle)
      }

      this.matrix = nextMatrix
    },
  }
}

function matrixToTransformString(matrix: TestSvgMatrix): string {
  return `matrix(${matrix.a},${matrix.b},${matrix.c},${matrix.d},${matrix.e},${matrix.f})`
}

/**
 * 为 jsdom 补齐 X6 依赖的最小 SVG API。
 */
function ensureSvgDomApis(): void {
  const svgPrototype = globalThis.SVGSVGElement?.prototype as {
    createSVGMatrix?: () => TestSvgMatrix
    createSVGPoint?: () => {
      x: number
      y: number
      matrixTransform: (matrix: Partial<TestSvgMatrix>) => { x: number; y: number }
    }
    createSVGTransform?: () => SvgTransformLike
    createSVGTransformFromMatrix?: (matrix: Partial<TestSvgMatrix>) => SvgTransformLike
  } | undefined

  const graphicsPrototype = globalThis.SVGGraphicsElement?.prototype as {
    getScreenCTM?: () => TestSvgMatrix
  } | undefined

  const elementPrototype = globalThis.SVGElement?.prototype as {
    transform?: { baseVal: { appendItem: (item: SvgTransformLike) => SvgTransformLike } }
  } | undefined

  if (!svgPrototype || !graphicsPrototype || !elementPrototype) {
    return
  }

  if (typeof svgPrototype.createSVGMatrix !== 'function') {
    svgPrototype.createSVGMatrix = () => createSvgMatrixLike()
  }

  if (typeof svgPrototype.createSVGPoint !== 'function') {
    svgPrototype.createSVGPoint = () => ({
      x: 0,
      y: 0,
      matrixTransform(matrix: Partial<TestSvgMatrix>) {
        const transform = createSvgMatrixLike(matrix)
        return {
          x: transform.a * this.x + transform.c * this.y + transform.e,
          y: transform.b * this.x + transform.d * this.y + transform.f,
        }
      },
    })
  }

  if (typeof svgPrototype.createSVGTransform !== 'function') {
    svgPrototype.createSVGTransform = () => createSvgTransformLike()
  }

  if (typeof svgPrototype.createSVGTransformFromMatrix !== 'function') {
    svgPrototype.createSVGTransformFromMatrix = (matrix: Partial<TestSvgMatrix>) => createSvgTransformLike(matrix)
  }

  if (typeof graphicsPrototype.getScreenCTM !== 'function') {
    graphicsPrototype.getScreenCTM = () => createSvgMatrixLike()
  }

  if (!Object.getOwnPropertyDescriptor(elementPrototype, 'transform')) {
    Object.defineProperty(elementPrototype, 'transform', {
      configurable: true,
      get() {
        const element = this as SVGElement
        return {
          baseVal: {
            appendItem(item: SvgTransformLike) {
              const current = element.getAttribute('transform')
              const next = matrixToTransformString(item.matrix)
              element.setAttribute('transform', current ? `${current} ${next}` : next)
              return item
            },
          },
        }
      },
    })
  }
}

/**
 * 为行为测试注册最小可用图形，避免依赖完整渲染实现。
 */
export function registerBehaviorTestShapes(shapes: string[]): void {
  for (const shape of shapes) {
    try {
      Graph.registerNode(shape, {
        inherit: 'rect',
        attrs: {
          body: { fill: '#fff', stroke: '#000' },
          label: { text: '' },
          headerLabel: { text: '' },
        },
      }, true)
    } catch {
      // 图形重复注册时保持静默。
    }
  }
}

/**
 * 创建用于行为测试的真实 X6 Graph。
 */
export function createBehaviorTestGraph(width = 1200, height = 800): Graph {
  ensureSvgDomApis()

  const container = document.createElement('div')
  container.style.width = `${width}px`
  container.style.height = `${height}px`
  document.body.appendChild(container)

  const graph = new Graph({
    container,
    width,
    height,
    embedding: { enabled: true },
  }) as TestGraph

  graph.__testContainer = container
  return graph
}

/**
 * 销毁测试图实例并清理挂载容器。
 */
export function destroyBehaviorTestGraph(graph: Graph): void {
  const testGraph = graph as TestGraph
  const container = testGraph.__testContainer
  graph.dispose()
  container?.remove()
}

/**
 * 以线性步进方式拖拽节点，逼近真实用户拖动轨迹。
 */
export function dragNodeLinearly(
  graph: Graph,
  node: Node,
  delta: { x: number; y: number },
  steps = 8,
): void {
  const stepCount = Math.max(1, steps)
  const stepX = delta.x / stepCount
  const stepY = delta.y / stepCount

  for (let index = 0; index < stepCount; index += 1) {
    node.translate(stepX, stepY)
    emitGraphEvent(graph, 'node:moving', { node })
  }

  emitGraphEvent(graph, 'node:moved', { node })
}

/**
 * 统一派发 Graph 事件，避免测试直接依赖受保护的 emit 类型定义。
 */
export function emitGraphEvent(graph: Graph, eventName: string, args: unknown): void {
  const eventGraph = graph as unknown as {
    trigger?: (name: string, payload: unknown) => void
    emit?: (name: string, payload: unknown) => void
  }

  if (typeof eventGraph.trigger === 'function') {
    eventGraph.trigger(eventName, args)
    return
  }

  if (typeof eventGraph.emit === 'function') {
    eventGraph.emit(eventName, args)
  }
}

/**
 * 读取节点中心点，便于验证边框吸附位置。
 */
export function getNodeCenter(node: Pick<Node, 'getPosition' | 'getSize'>): { x: number; y: number } {
  const position = node.getPosition()
  const size = node.getSize()
  return {
    x: position.x + size.width / 2,
    y: position.y + size.height / 2,
  }
}

/**
 * 读取节点矩形，便于做几何断言。
 */
export function getNodeRect(node: Pick<Node, 'getPosition' | 'getSize'>): {
  x: number
  y: number
  width: number
  height: number
} {
  const position = node.getPosition()
  const size = node.getSize()
  return {
    x: position.x,
    y: position.y,
    width: size.width,
    height: size.height,
  }
}