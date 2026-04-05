// bpmn-moddle v10 类型声明
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
     * 根据指定类型和属性创建 moddle 元素。
     */
    create(type: string, attrs?: Record<string, any>): ModdleElement

    /**
     * 创建任意类型元素（用于扩展元素）。
     */
    createAny(name: string, nsUri: string, properties?: Record<string, any>): ModdleElement

    /**
     * 将 BPMN 2.0 XML 字符串解析为 moddle 元素树。
     */
    fromXML(xmlStr: string, typeName?: string, options?: FromXMLOptions): Promise<ParseResult>

    /**
     * 将 moddle 元素树序列化为 BPMN 2.0 XML。
     */
    toXML(element: ModdleElement, options?: ToXMLOptions): Promise<SerializationResult>

    /**
     * 根据类型名获取类型描述符。
     */
    getType(type: string): any

    /**
     * 根据前缀或 URI 获取包。
     */
    getPackage(uriOrPrefix: string): any
  }
}
