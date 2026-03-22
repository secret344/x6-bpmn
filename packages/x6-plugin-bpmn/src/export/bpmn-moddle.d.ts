// Type declarations for bpmn-moddle v10
// https://github.com/bpmn-io/bpmn-moddle

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

    /**
     * Create a moddle element of the given type with the given properties.
     */
    create(type: string, attrs?: Record<string, any>): ModdleElement

    /**
     * Create an any-typed element (for extension elements).
     */
    createAny(name: string, nsUri: string, properties?: Record<string, any>): ModdleElement

    /**
     * Parse a BPMN 2.0 XML string into a moddle element tree.
     */
    fromXML(xmlStr: string, typeName?: string, options?: FromXMLOptions): Promise<ParseResult>

    /**
     * Serialize a moddle element tree to BPMN 2.0 XML.
     */
    toXML(element: ModdleElement, options?: ToXMLOptions): Promise<SerializationResult>

    /**
     * Get a type descriptor by type name.
     */
    getType(type: string): any

    /**
     * Get a package by prefix or URI.
     */
    getPackage(uriOrPrefix: string): any
  }
}
