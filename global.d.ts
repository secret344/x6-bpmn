declare module 'bpmn-moddle' {
  export interface ModdleElement {
    $type: string
    $attrs?: Record<string, any>
    $parent?: ModdleElement
    id?: string
    name?: string
    [key: string]: any
  }

  export interface ParseResult {
    rootElement: ModdleElement
    references: any[]
    warnings: any[]
    elementsById: Record<string, ModdleElement>
  }

  export interface SerializationResult {
    xml: string
  }

  export interface ToXMLOptions {
    format?: boolean
    preamble?: boolean
  }

  export interface FromXMLOptions {
    lax?: boolean
  }

  export class BpmnModdle {
    constructor(packages?: Record<string, any>, options?: Record<string, any>)
    create(type: string, attrs?: Record<string, any>): ModdleElement
    createAny(name: string, nsUri: string, properties?: Record<string, any>): ModdleElement
    fromXML(xmlStr: string, typeName?: string, options?: FromXMLOptions): Promise<ParseResult>
    toXML(element: ModdleElement, options?: ToXMLOptions): Promise<SerializationResult>
    getType(type: string): any
    getPackage(uriOrPrefix: string): any
  }
}