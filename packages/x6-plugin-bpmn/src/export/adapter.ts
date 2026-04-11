/**
 * BPMN 2.0 标准导出工厂
 *
 * 将 exportBpmnXml() 封装为 ExporterAdapter 接口，
 * 供方言运行时统一调度。
 */

import type { Graph } from '@antv/x6'
import type { ExporterAdapter, ProfileContext } from '../core/dialect/types'
import {
  createBpmnOpeningTagRegex,
  mergeBpmnXmlNameSettings,
} from '../utils/bpmn-xml-names'
import { mergeExtensionPropertySerialization } from '../utils/extension-properties'
import { exportBpmnXml } from './exporter'
import type { ExportBpmnOptions } from './exporter'

/** BPMN 2.0 导出前置扩展钩子。 */
export type Bpmn2ExportPreProcessor = (
  graph: Graph,
  context: ProfileContext,
) => void | Promise<void>

/** BPMN 2.0 导出后置扩展钩子。 */
export type Bpmn2ExportPostProcessor = (
  xml: string,
  context: ProfileContext,
) => string | Promise<string>

/** BPMN 2.0 导出工厂选项。 */
export interface Bpmn2ExporterAdapterOptions extends ExportBpmnOptions {
  /** 导出前扩展处理。 */
  preExport?: Bpmn2ExportPreProcessor
  /** 导出后扩展处理。 */
  postExportXml?: Bpmn2ExportPostProcessor
}

function injectNamespaces(
  xml: string,
  namespaces: Record<string, string>,
  xmlNames?: ExportBpmnOptions['serialization'] extends infer T
    ? T extends { xmlNames?: infer U }
      ? U
      : never
    : never,
): string {
  const defPattern = new RegExp(`(${createBpmnOpeningTagRegex('definitions', xmlNames).source})`)
  const match = xml.match(defPattern)
  if (!match) return xml

  let injection = ''
  for (const [prefix, uri] of Object.entries(namespaces)) {
    const nsAttr = `xmlns:${prefix}=`
    if (!xml.includes(nsAttr)) {
      injection += ` xmlns:${prefix}="${uri}"`
    }
  }

  return injection ? xml.replace(defPattern, `$1${injection}`) : xml
}

/**
 * 创建 BPMN 2.0 标准导出工厂。
 *
 * @param options — 传递给底层 exportBpmnXml 的选项
 */
export function createBpmn2ExporterAdapter(
  options?: Bpmn2ExporterAdapterOptions,
): ExporterAdapter {
  return {
    dialect: 'bpmn2',

    async exportXML(graph: Graph, context: ProfileContext): Promise<string> {
      if (options?.preExport) {
        await options.preExport(graph, context)
      }

      const profileSerialization = context.profile?.serialization
      const serialization = profileSerialization || options?.serialization
        ? {
            namespaces: profileSerialization?.namespaces || options?.serialization?.namespaces
              ? {
                  ...(profileSerialization?.namespaces ?? {}),
                  ...options?.serialization?.namespaces,
                }
              : undefined,
            xmlNames: profileSerialization?.xmlNames || options?.serialization?.xmlNames
              ? mergeBpmnXmlNameSettings(profileSerialization?.xmlNames, options?.serialization?.xmlNames)
              : undefined,
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
            targetNamespace: options?.serialization?.targetNamespace ?? profileSerialization?.targetNamespace,
            extensionProperties: mergeExtensionPropertySerialization(
              profileSerialization?.extensionProperties,
              options?.serialization?.extensionProperties,
            ),
            processAttributes: profileSerialization?.processAttributes || options?.serialization?.processAttributes
              ? {
                  ...(profileSerialization?.processAttributes ?? {}),
                  ...options?.serialization?.processAttributes,
                }
              : undefined,
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

      const xml = await exportBpmnXml(graph, { ...options, serialization })
      const xmlWithNamespaces = serialization?.namespaces
        ? injectNamespaces(xml, serialization.namespaces, serialization.xmlNames)
        : xml

      if (options?.postExportXml) {
        return options.postExportXml(xmlWithNamespaces, context)
      }

      return xmlWithNamespaces
    },
  }
}