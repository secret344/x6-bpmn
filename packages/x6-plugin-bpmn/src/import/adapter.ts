/**
 * BPMN 2.0 标准导入工厂
 *
 * 将 importBpmnXml() 封装为 ImporterAdapter 接口，
 * 供方言运行时统一调度。
 */

import type { Graph } from '@antv/x6'
import type { ImporterAdapter, ProfileContext } from '../core/dialect/types'
import { mergeBpmnXmlNameSettings } from '../utils/bpmn-xml-names'
import { mergeExtensionPropertySerialization } from '../utils/extension-properties'
import { parseBpmnXml, loadBpmnGraph } from './index'
import type { ImportBpmnOptions } from './index'
import type { BpmnImportData } from './types'

/** BPMN 2.0 导入后置扩展钩子。 */
export type Bpmn2ImportPostProcessor = (
  graph: Graph,
  context: ProfileContext,
  importedData: BpmnImportData,
) => void | Promise<void>

/** BPMN 2.0 导入工厂选项。 */
export interface Bpmn2ImporterAdapterOptions extends ImportBpmnOptions {
  /**
   * 导入完成后的扩展处理。
   * 可用于方言场景中的轻量后处理，而不必再复制一套 importer。
   */
  postImport?: Bpmn2ImportPostProcessor
}

/**
 * 创建 BPMN 2.0 标准导入工厂。
 *
 * @param options — 传递给底层 importBpmnXml 的选项
 */
export function createBpmn2ImporterAdapter(
  options?: Bpmn2ImporterAdapterOptions,
): ImporterAdapter {
  return {
    dialect: 'bpmn2',

    async importXML(graph: Graph, xml: string, context: ProfileContext): Promise<void> {
      const profileSerialization = context.profile?.serialization
      const serialization = profileSerialization || options?.serialization
        ? {
            nodeMapping: profileSerialization?.nodeMapping || options?.serialization?.nodeMapping
              ? {
                  ...(profileSerialization?.nodeMapping ?? {}),
                  ...options?.serialization?.nodeMapping,
                }
              : undefined,
            edgeMapping: profileSerialization?.edgeMapping || options?.serialization?.edgeMapping
              ? {
                  ...(profileSerialization?.edgeMapping ?? {}),
                  ...options?.serialization?.edgeMapping,
                }
              : undefined,
            namespaces: profileSerialization?.namespaces || options?.serialization?.namespaces
              ? {
                  ...(profileSerialization?.namespaces ?? {}),
                  ...options?.serialization?.namespaces,
                }
              : undefined,
            xmlNames: profileSerialization?.xmlNames || options?.serialization?.xmlNames
              ? mergeBpmnXmlNameSettings(profileSerialization?.xmlNames, options?.serialization?.xmlNames)
              : undefined,
            extensionProperties: mergeExtensionPropertySerialization(
              profileSerialization?.extensionProperties,
              options?.serialization?.extensionProperties,
            ),
            nodeSerializers: profileSerialization?.nodeSerializers || options?.serialization?.nodeSerializers
              ? {
                  ...(profileSerialization?.nodeSerializers ?? {}),
                  ...options?.serialization?.nodeSerializers,
                }
              : undefined,
            edgeSerializers: profileSerialization?.edgeSerializers || options?.serialization?.edgeSerializers
              ? {
                  ...(profileSerialization?.edgeSerializers ?? {}),
                  ...options?.serialization?.edgeSerializers,
                }
              : undefined,
          }
        : undefined

      const data = await parseBpmnXml(xml, { serialization })
      const { serialization: _serialization, postImport: _postImport, ...loadOptions } = options ?? {}
      loadBpmnGraph(graph, data, loadOptions)

      if (options?.postImport) {
        await options.postImport(graph, context, data)
      }
    },
  }
}