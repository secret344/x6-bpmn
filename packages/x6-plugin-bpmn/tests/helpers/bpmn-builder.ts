/**
 * BPMN Document Builder — test utility
 *
 * Creates valid BPMN 2.0 XML documents programmatically via bpmn-moddle,
 * then validates they can be parsed back without errors.
 *
 * Rule: NO raw XML template strings in tests. All BPMN XML must go
 * through this builder so we guarantee structural BPMN 2.0 validity.
 */

import { BpmnModdle } from 'bpmn-moddle'
import type { ModdleElement } from 'bpmn-moddle'
import { createBpmnElement } from '../../src/utils/bpmn-xml-names'

// ============================================================================
// Types
// ============================================================================

export interface ShapeSpec {
  id: string
  x: number
  y: number
  width: number
  height: number
  isHorizontal?: boolean
  isExpanded?: boolean
  isMarkerVisible?: boolean
  attrs?: Record<string, string | number | boolean>
}

export interface EdgeSpec {
  id: string
  waypoints: Array<{ x: number; y: number }>
  messageVisibleKind?: 'initiating' | 'non_initiating'
  attrs?: Record<string, string | number | boolean>
}

export interface ProcessSpec {
  id: string
  isExecutable?: boolean
  elements: ElementSpec[]
}

export type ElementSpec =
  | StartEventSpec
  | EndEventSpec
  | IntermediateThrowEventSpec
  | IntermediateCatchEventSpec
  | BoundaryEventSpec
  | TaskSpec
  | GatewaySpec
  | SubProcessSpec
  | DataObjectSpec
  | DataStoreSpec
  | TextAnnotationSpec
  | GroupSpec
  | LaneSetSpec
  | SequenceFlowSpec
  | AssociationSpec
  | DataAssociationSpec

interface FlowContainerChildSpec {
  parentRef?: string
}

export interface StartEventSpec extends FlowContainerChildSpec {
  kind: 'startEvent'
  id: string
  name?: string
  eventDefinition?: string
  outgoing?: string[]
  parallelMultiple?: boolean
}

export interface EndEventSpec extends FlowContainerChildSpec {
  kind: 'endEvent'
  id: string
  name?: string
  eventDefinition?: string
  incoming?: string[]
}

export interface TaskSpec extends FlowContainerChildSpec {
  kind: 'task' | 'userTask' | 'serviceTask' | 'scriptTask' | 'sendTask' |
        'receiveTask' | 'manualTask' | 'businessRuleTask'
  id: string
  name?: string
  incoming?: string[]
  outgoing?: string[]
  dataInputAssociations?: string[]
  dataOutputAssociations?: string[]
}

export interface IntermediateThrowEventSpec extends FlowContainerChildSpec {
  kind: 'intermediateThrowEvent'
  id: string
  name?: string
  eventDefinition?: string
  incoming?: string[]
  outgoing?: string[]
}

export interface IntermediateCatchEventSpec extends FlowContainerChildSpec {
  kind: 'intermediateCatchEvent'
  id: string
  name?: string
  eventDefinition?: string
  incoming?: string[]
  outgoing?: string[]
}

export interface BoundaryEventSpec extends FlowContainerChildSpec {
  kind: 'boundaryEvent'
  id: string
  name?: string
  attachedToRef?: string
  cancelActivity?: boolean
  eventDefinition?: string
  parallelMultiple?: boolean
}

export interface GatewaySpec extends FlowContainerChildSpec {
  kind: 'exclusiveGateway' | 'parallelGateway' | 'inclusiveGateway' |
        'complexGateway' | 'eventBasedGateway'
  id: string
  name?: string
  default?: string
  incoming?: string[]
  outgoing?: string[]
}

export interface SubProcessSpec extends FlowContainerChildSpec {
  kind: 'subProcess' | 'transaction' | 'adHocSubProcess' | 'callActivity'
  id: string
  name?: string
  triggeredByEvent?: boolean
}

export interface DataObjectSpec extends FlowContainerChildSpec {
  kind: 'dataObjectReference'
  id: string
  name?: string
}

export interface DataStoreSpec extends FlowContainerChildSpec {
  kind: 'dataStoreReference'
  id: string
  name?: string
}

export interface TextAnnotationSpec {
  kind: 'textAnnotation'
  id: string
  text?: string
}

export interface GroupSpec {
  kind: 'group'
  id: string
  name?: string
}

export interface LaneSetSpec {
  kind: 'laneSet'
  id: string
  lanes: LaneSpec[]
}

export interface LaneSpec {
  id: string
  name?: string
  flowNodeRefs?: string[]
}

export interface SequenceFlowSpec extends FlowContainerChildSpec {
  kind: 'sequenceFlow'
  id: string
  sourceRef: string
  targetRef: string
  name?: string
  hasCondition?: boolean
  conditionBody?: string
}

export interface AssociationSpec {
  kind: 'association'
  id: string
  sourceRef: string
  targetRef: string
  direction?: 'One' | 'Both' | 'None'
}

export interface DataAssociationSpec {
  kind: 'dataInputAssociation' | 'dataOutputAssociation'
  id: string
  taskId: string
  dataRef: string
}

export interface CollaborationSpec {
  id: string
  participants: ParticipantSpec[]
  messageFlows?: MessageFlowSpec[]
}

export interface ParticipantSpec {
  id: string
  name?: string
  processRef: string
}

export interface MessageFlowSpec {
  id: string
  sourceRef: string
  targetRef: string
  name?: string
}

export interface BpmnDocumentSpec {
  id?: string
  targetNamespace?: string
  definitionsAttrs?: Record<string, string | number | boolean>
  processes: ProcessSpec[]
  collaboration?: CollaborationSpec
  /** DI shapes keyed by element id */
  shapes?: Record<string, ShapeSpec>
  /** DI edges keyed by element id */
  edges?: Record<string, EdgeSpec>
}

// ============================================================================
// Validation result
// ============================================================================

export interface BpmnValidationResult {
  valid: boolean
  xml: string
  warnings: string[]
  /** Parsed root element for structural assertions */
  rootElement: ModdleElement | null
}

function createBpmn(
  moddle: BpmnModdle,
  localName: string,
  attrs: Record<string, unknown>,
): ModdleElement {
  return createBpmnElement(moddle, localName, attrs)
}

// ============================================================================
// Builder
// ============================================================================

/**
 * Build a BPMN 2.0 XML document from a spec using bpmn-moddle,
 * then validate it by parsing back with bpmn-moddle.
 *
 * @throws if bpmn-moddle cannot serialize or parse the document
 */
export async function buildAndValidateBpmn(spec: BpmnDocumentSpec): Promise<BpmnValidationResult> {
  const moddle = new BpmnModdle()

  // ---- Build elements ----
  const nodeRegistry = new Map<string, ModdleElement>()

  // We need two passes: first create all nodes, then create flows (refs)
  const flowSpecsDeferred: SequenceFlowSpec[] = []
  const assocSpecsDeferred: AssociationSpec[] = []
  const dataAssocSpecsDeferred: DataAssociationSpec[] = []
  const associationElements = new Map<string, ModdleElement>()

  // default flow map: gateway id → seq flow id
  const gatewayDefaultMap = new Map<string, string>()

  for (const proc of spec.processes) {
    for (const el of proc.elements) {
      if (el.kind === 'sequenceFlow') {
        flowSpecsDeferred.push(el)
        continue
      }
      if (el.kind === 'association') {
        assocSpecsDeferred.push(el)
        continue
      }
      if (el.kind === 'dataInputAssociation' || el.kind === 'dataOutputAssociation') {
        dataAssocSpecsDeferred.push(el)
        continue
      }
      if (el.kind === 'laneSet') continue // handled per-process

      const moddleEl = createFlowElement(moddle, el)
      nodeRegistry.set(el.id, moddleEl)
    }
  }

  // Set attachedToRef on boundary events (requires all elements to be created first)
  for (const proc of spec.processes) {
    for (const el of proc.elements) {
      if (el.kind === 'boundaryEvent' && (el as BoundaryEventSpec).attachedToRef) {
        const boundaryEl = nodeRegistry.get(el.id)
        const hostEl = nodeRegistry.get((el as BoundaryEventSpec).attachedToRef!)
        if (boundaryEl && hostEl) {
          boundaryEl.attachedToRef = hostEl
        }
      }
    }
  }

  // Now create sequence flows
  const flowElements = new Map<string, ModdleElement>()
  for (const sf of flowSpecsDeferred) {
    const src = nodeRegistry.get(sf.sourceRef)
    const tgt = nodeRegistry.get(sf.targetRef)
    if (!src || !tgt) {
      throw new Error(`BpmnBuilder: unknown sourceRef "${sf.sourceRef}" or targetRef "${sf.targetRef}" in sequenceFlow "${sf.id}"`)
    }
    const props: Record<string, any> = {
      id: sf.id,
      sourceRef: src,
      targetRef: tgt,
    }
    if (sf.name) props.name = sf.name
    const seqFlow = createBpmn(moddle, 'sequenceFlow', props)
    if (sf.hasCondition) {
      seqFlow.conditionExpression = createBpmn(moddle, 'formalExpression', {
        body: sf.conditionBody ?? 'condition',
      })
    }
    flowElements.set(sf.id, seqFlow)
  }

  // Handle gateway defaults
  for (const proc of spec.processes) {
    for (const el of proc.elements) {
      if ((el.kind === 'exclusiveGateway' || el.kind === 'inclusiveGateway') && (el as GatewaySpec).default) {
        const gwEl = nodeRegistry.get(el.id)
        const defFlowEl = flowElements.get((el as GatewaySpec).default!)
        if (gwEl && defFlowEl) {
          gwEl.default = defFlowEl
        }
      }
    }
  }

  // Create associations
  for (const assoc of assocSpecsDeferred) {
    const src = nodeRegistry.get(assoc.sourceRef)
    const tgt = nodeRegistry.get(assoc.targetRef)
    if (!src || !tgt) {
      throw new Error(`BpmnBuilder: unknown ref in association "${assoc.id}"`)
    }
    const props: Record<string, any> = {
      id: assoc.id,
      sourceRef: src,
      targetRef: tgt,
    }
    if (assoc.direction) props.associationDirection = assoc.direction
    const assocEl = createBpmn(moddle, 'association', props)
    associationElements.set(assoc.id, assocEl)
  }

  // Create data associations and attach to tasks
  for (const da of dataAssocSpecsDeferred) {
    const task = nodeRegistry.get(da.taskId)
    const dataRef = nodeRegistry.get(da.dataRef)
    if (!task || !dataRef) {
      throw new Error(`BpmnBuilder: unknown taskId "${da.taskId}" or dataRef "${da.dataRef}" in ${da.kind}`)
    }
    if (da.kind === 'dataInputAssociation') {
      const daEl = createBpmn(moddle, 'dataInputAssociation', {
        id: da.id,
        sourceRef: [dataRef],
        targetRef: task,
      })
      task.dataInputAssociations = [...(task.dataInputAssociations ?? []), daEl]
    } else {
      const daEl = createBpmn(moddle, 'dataOutputAssociation', {
        id: da.id,
        sourceRef: [task],
        targetRef: dataRef,
      })
      task.dataOutputAssociations = [...(task.dataOutputAssociations ?? []), daEl]
    }
  }

  // Build processes
  const processElements = new Map<string, ModdleElement>()

  for (const proc of spec.processes) {
    const laneSetSpec = proc.elements.find((e) => e.kind === 'laneSet') as LaneSetSpec | undefined

    const processEl = createBpmn(moddle, 'process', {
      id: proc.id,
      isExecutable: proc.isExecutable ?? false,
    })

    const processFlowElements: ModdleElement[] = []
    const containerChildren = new Map<string, ModdleElement[]>()

    for (const el of proc.elements) {
      if (el.kind === 'laneSet' || el.kind === 'dataInputAssociation' || el.kind === 'dataOutputAssociation') {
        continue
      }

      const elementId = el.id
      const builtElement = el.kind === 'sequenceFlow'
        ? flowElements.get(elementId)
        : el.kind === 'association'
          ? associationElements.get(elementId)
          : nodeRegistry.get(elementId)

      if (!builtElement) {
        continue
      }

      const parentRef = (el as FlowContainerChildSpec).parentRef
      if (parentRef) {
        const children = containerChildren.get(parentRef) ?? []
        children.push(builtElement)
        containerChildren.set(parentRef, children)
        continue
      }

      processFlowElements.push(builtElement)
    }

    for (const [containerId, children] of containerChildren) {
      const container = nodeRegistry.get(containerId)
      if (!container) {
        throw new Error(`BpmnBuilder: unknown parentRef "${containerId}"`)
      }
      container.flowElements = [...(container.flowElements ?? []), ...children]
    }

    processEl.flowElements = processFlowElements

    if (laneSetSpec) {
      const lanes = laneSetSpec.lanes.map((lane) => {
        const flowNodeRefs = (lane.flowNodeRefs ?? []).map((refId) => nodeRegistry.get(refId)).filter(Boolean) as ModdleElement[]
        return createBpmn(moddle, 'lane', {
          id: lane.id,
          name: lane.name,
          flowNodeRef: flowNodeRefs,
        })
      })
      processEl.laneSets = [createBpmn(moddle, 'laneSet', {
        id: laneSetSpec.id,
        lanes,
      })]
    }

    processElements.set(proc.id, processEl)
  }

  // Build collaboration if specified
  let collaborationEl: ModdleElement | null = null
  if (spec.collaboration) {
    const coll = spec.collaboration
    const participants = coll.participants.map((p) =>
      createBpmn(moddle, 'participant', {
        id: p.id,
        name: p.name,
        processRef: processElements.get(p.processRef),
      }),
    )

    const msgFlows = (coll.messageFlows ?? []).map((mf) => {
      const src = nodeRegistry.get(mf.sourceRef) ?? processElements.get(mf.sourceRef)
      const tgt = nodeRegistry.get(mf.targetRef) ?? processElements.get(mf.targetRef)
      return createBpmn(moddle, 'messageFlow', {
        id: mf.id,
        sourceRef: src,
        targetRef: tgt,
        name: mf.name,
      })
    })

    collaborationEl = createBpmn(moddle, 'collaboration', {
      id: coll.id,
      participants,
      ...(msgFlows.length > 0 ? { messageFlows: msgFlows } : {}),
    })

    // Register participants in nodeRegistry for DI lookup
    for (const p of coll.participants) {
      const pEl = (collaborationEl.participants as ModdleElement[]).find((pe: any) => pe.id === p.id)
      if (pEl) nodeRegistry.set(p.id, pEl)
    }
  }

  // ---- Build DI ----
  const planeElements: ModdleElement[] = []

  if (spec.shapes) {
    for (const [, shapeSpec] of Object.entries(spec.shapes)) {
      const bpmnEl = nodeRegistry.get(shapeSpec.id)
      const shape = moddle.create('bpmndi:BPMNShape', {
        id: `${shapeSpec.id}_di`,
        bpmnElement: bpmnEl ?? { id: shapeSpec.id },
        ...(shapeSpec.isHorizontal !== undefined ? { isHorizontal: shapeSpec.isHorizontal } : {}),
        ...(shapeSpec.isExpanded !== undefined ? { isExpanded: shapeSpec.isExpanded } : {}),
        ...(shapeSpec.isMarkerVisible !== undefined ? { isMarkerVisible: shapeSpec.isMarkerVisible } : {}),
        ...(shapeSpec.attrs ?? {}),
      })
      shape.bounds = moddle.create('dc:Bounds', {
        x: shapeSpec.x,
        y: shapeSpec.y,
        width: shapeSpec.width,
        height: shapeSpec.height,
      })
      planeElements.push(shape)
    }
  }

  if (spec.edges) {
    for (const [edgeId, edgeSpec] of Object.entries(spec.edges)) {
      const bpmnEl = flowElements.get(edgeId) ?? nodeRegistry.get(edgeId)
      const edgeEl = moddle.create('bpmndi:BPMNEdge', {
        id: `${edgeId}_di`,
        bpmnElement: bpmnEl ?? { id: edgeId },
        ...(edgeSpec.messageVisibleKind !== undefined ? { messageVisibleKind: edgeSpec.messageVisibleKind } : {}),
        ...(edgeSpec.attrs ?? {}),
      })
      edgeEl.waypoint = edgeSpec.waypoints.map((wp) =>
        moddle.create('dc:Point', { x: wp.x, y: wp.y }),
      )
      planeElements.push(edgeEl)
    }
  }

  const diPlaneEl = collaborationEl ?? (processElements.size === 1 ? [...processElements.values()][0] : null)

  const plane = moddle.create('bpmndi:BPMNPlane', {
    id: 'BPMNPlane_1',
    bpmnElement: diPlaneEl,
  })
  plane.planeElement = planeElements

  const diagram = moddle.create('bpmndi:BPMNDiagram', { id: 'BPMNDiagram_1' })
  diagram.plane = plane

  // ---- Assemble definitions ----
  const definitions = createBpmn(moddle, 'definitions', {
    id: spec.id ?? 'Definitions_1',
    targetNamespace: spec.targetNamespace ?? 'http://bpmn.io/schema/bpmn',
    ...(spec.definitionsAttrs ?? {}),
  })

  const rootElements: ModdleElement[] = []
  if (collaborationEl) rootElements.push(collaborationEl)
  for (const procEl of processElements.values()) rootElements.push(procEl)
  definitions.rootElements = rootElements
  definitions.diagrams = [diagram]

  // ---- Serialize ----
  const { xml } = await moddle.toXML(definitions, { format: true, preamble: true })

  // ---- Validate: parse back ----
  const moddle2 = new BpmnModdle()
  const { rootElement, warnings } = await moddle2.fromXML(xml)

  const warningMessages = (warnings as any[]).map((w) =>
    typeof w === 'string' ? w : (w?.message ?? String(w)),
  )

  return {
    valid: warningMessages.length === 0,
    xml,
    warnings: warningMessages,
    rootElement: rootElement as ModdleElement,
  }
}

// ============================================================================
// Validate existing XML
// ============================================================================

/**
 * Parse and validate an existing XML string with bpmn-moddle.
 * Returns the parsed rootElement plus any parser warnings.
 */
export async function validateBpmnXml(xml: string): Promise<BpmnValidationResult> {
  const moddle = new BpmnModdle()
  const { rootElement, warnings } = await moddle.fromXML(xml)

  const warningMessages = (warnings as any[]).map((w) =>
    typeof w === 'string' ? w : (w?.message ?? String(w)),
  )

  return {
    valid: warningMessages.length === 0,
    xml,
    warnings: warningMessages,
    rootElement: rootElement as ModdleElement | null,
  }
}

// ============================================================================
// Element factory
// ============================================================================

function createFlowElement(moddle: BpmnModdle, spec: ElementSpec): ModdleElement {
  switch (spec.kind) {
    case 'startEvent': {
      const el = createBpmn(moddle, 'startEvent', {
        id: spec.id,
        ...(spec.name ? { name: spec.name } : {}),
        ...(spec.parallelMultiple ? { parallelMultiple: true } : {}),
      })
      if (spec.eventDefinition) {
        el.eventDefinitions = [createEventDefinition(moddle, spec.eventDefinition, `${spec.id}_ed`)]
      }
      return el
    }

    case 'endEvent': {
      const el = createBpmn(moddle, 'endEvent', {
        id: spec.id,
        ...(spec.name ? { name: spec.name } : {}),
      })
      if (spec.eventDefinition) {
        el.eventDefinitions = [createEventDefinition(moddle, spec.eventDefinition, `${spec.id}_ed`)]
      }
      return el
    }

    case 'task':
    case 'userTask':
    case 'serviceTask':
    case 'scriptTask':
    case 'sendTask':
    case 'receiveTask':
    case 'manualTask':
    case 'businessRuleTask': {
      return createBpmn(moddle, spec.kind, {
        id: spec.id,
        ...(spec.name ? { name: spec.name } : {}),
      })
    }

    case 'exclusiveGateway':
    case 'parallelGateway':
    case 'inclusiveGateway':
    case 'complexGateway':
    case 'eventBasedGateway': {
      return createBpmn(moddle, spec.kind, {
        id: spec.id,
        ...(spec.name ? { name: spec.name } : {}),
      })
    }

    case 'subProcess': {
      return createBpmn(moddle, 'subProcess', {
        id: spec.id,
        ...(spec.name ? { name: spec.name } : {}),
        ...(spec.triggeredByEvent ? { triggeredByEvent: true } : {}),
      })
    }

    case 'transaction': {
      return createBpmn(moddle, 'transaction', {
        id: spec.id,
        ...(spec.name ? { name: spec.name } : {}),
      })
    }

    case 'adHocSubProcess': {
      return createBpmn(moddle, 'adHocSubProcess', {
        id: spec.id,
        ...(spec.name ? { name: spec.name } : {}),
      })
    }

    case 'callActivity': {
      return createBpmn(moddle, 'callActivity', {
        id: spec.id,
        ...(spec.name ? { name: spec.name } : {}),
      })
    }

    case 'dataObjectReference': {
      return createBpmn(moddle, 'dataObjectReference', {
        id: spec.id,
        ...(spec.name ? { name: spec.name } : {}),
      })
    }

    case 'dataStoreReference': {
      return createBpmn(moddle, 'dataStoreReference', {
        id: spec.id,
        ...(spec.name ? { name: spec.name } : {}),
      })
    }

    case 'intermediateThrowEvent': {
      const el = createBpmn(moddle, 'intermediateThrowEvent', {
        id: spec.id,
        ...(spec.name ? { name: spec.name } : {}),
      })
      if (spec.eventDefinition) {
        el.eventDefinitions = [createEventDefinition(moddle, spec.eventDefinition, `${spec.id}_ed`)]
      }
      return el
    }

    case 'intermediateCatchEvent': {
      const el = createBpmn(moddle, 'intermediateCatchEvent', {
        id: spec.id,
        ...(spec.name ? { name: spec.name } : {}),
      })
      if (spec.eventDefinition) {
        el.eventDefinitions = [createEventDefinition(moddle, spec.eventDefinition, `${spec.id}_ed`)]
      }
      return el
    }

    case 'boundaryEvent': {
      const eventDefinition = (spec.eventDefinition ?? '').toLowerCase()
      const el = createBpmn(moddle, 'boundaryEvent', {
        id: spec.id,
        ...(spec.name ? { name: spec.name } : {}),
        cancelActivity: spec.cancelActivity ?? (eventDefinition === 'escalationeventdefinition' ? false : true),
        ...(spec.parallelMultiple ? { parallelMultiple: true } : {}),
      })
      if (spec.eventDefinition) {
        el.eventDefinitions = [createEventDefinition(moddle, spec.eventDefinition, `${spec.id}_ed`)]
      }
      return el
    }

    case 'textAnnotation': {
      return createBpmn(moddle, 'textAnnotation', {
        id: spec.id,
        text: spec.text ?? '',
      })
    }

    case 'group': {
      return createBpmn(moddle, 'group', {
        id: spec.id,
      })
    }

    default:
      throw new Error(`BpmnBuilder: unsupported element kind "${(spec as any).kind}"`)
  }
}

function createEventDefinition(moddle: BpmnModdle, eventDefinition: string, id: string): ModdleElement {
  return createBpmn(moddle, eventDefinition, { id })
}
