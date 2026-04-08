/**
 * 核心数据模型层 — 字段能力定义与验证
 *
 * FieldCapability 是主库对字段的能力定义（默认值、normalize、validate、serialize、deserialize），
 * 同时可附带声明式编辑提示，供示例项目或宿主 UI 复用。
 */

import type {
  DataModelSet,
  FieldCapability,
  FieldEditorInput,
  FieldEditorOption,
  FieldValidateContext,
} from '../dialect/types'
import { classifyShape } from '../../config'

export interface ResolvedFieldEditor {
  key: string
  label: string
  input: FieldEditorInput
  placeholder?: string
  options?: FieldEditorOption[]
  scope?: FieldCapability['scope']
  defaultValue?: unknown
  description?: string
}

// ============================================================================
// 字段能力辅助函数
// ============================================================================

/**
 * 获取字段的默认值。
 */
export function getFieldDefaultValue(
  fieldName: string,
  dataModel: DataModelSet,
): unknown {
  const field = dataModel.fields[fieldName]
  return field?.defaultValue
}

/**
 * 对字段值进行 normalize 处理。
 */
export function normalizeFieldValue(
  fieldName: string,
  value: unknown,
  dataModel: DataModelSet,
): unknown {
  const field = dataModel.fields[fieldName]
  if (field?.normalize) {
    return field.normalize(value)
  }
  return value
}

/**
 * 验证字段值。
 *
 * @returns true 表示通过验证，字符串表示失败原因
 */
export function validateFieldValue(
  fieldName: string,
  value: unknown,
  context: FieldValidateContext,
  dataModel: DataModelSet,
): true | string {
  const field = dataModel.fields[fieldName]
  if (field?.validate) {
    return field.validate(value, context)
  }
  return true
}

/**
 * 序列化字段值（准备写入 XML / JSON）。
 */
export function serializeFieldValue(
  fieldName: string,
  value: unknown,
  dataModel: DataModelSet,
): unknown {
  const field = dataModel.fields[fieldName]
  if (field?.serialize) {
    return field.serialize(value)
  }
  return value
}

/**
 * 反序列化字段值（从 XML / JSON 读取后处理）。
 */
export function deserializeFieldValue(
  fieldName: string,
  value: unknown,
  dataModel: DataModelSet,
): unknown {
  const field = dataModel.fields[fieldName]
  if (field?.deserialize) {
    return field.deserialize(value)
  }
  return value
}

/**
 * 获取指定分类下的字段列表。
 */
export function getFieldsForCategory(
  category: string,
  dataModel: DataModelSet,
): string[] {
  return dataModel.categoryFields[category] || []
}

/**
 * 获取指定 shape 下的字段列表（比分类更细粒度）。
 * 如果 shapeFields 中有定义则使用，否则回退到 categoryFields。
 */
export function getFieldsForShape(
  shape: string,
  category: string,
  dataModel: DataModelSet,
): string[] {
  if (dataModel.shapeFields?.[shape]) {
    return dataModel.shapeFields[shape]
  }

  const directFields = dataModel.categoryFields[category] || []
  const classifiedCategory = classifyShape(shape)
  const classifiedFields =
    classifiedCategory !== 'unknown' && classifiedCategory !== category
      ? dataModel.categoryFields[classifiedCategory] || []
      : []

  if (classifiedFields.length === 0) return directFields
  if (directFields.length === 0) return classifiedFields

  return Array.from(new Set([...directFields, ...classifiedFields]))
}

function getResolvedFieldNamesForShape(
  shape: string,
  category: string,
  dataModel: DataModelSet,
): string[] {
  const fieldNames = getFieldsForShape(shape, category, dataModel)

  if (
    shape.includes('boundary') &&
    'cancelActivity' in dataModel.fields &&
    !fieldNames.includes('cancelActivity')
  ) {
    return [...fieldNames, 'cancelActivity']
  }

  return fieldNames
}

function resolveFieldEditors(
  fieldNames: string[],
  dataModel: DataModelSet,
): ResolvedFieldEditor[] {
  return fieldNames.map((fieldName) => {
    const field = dataModel.fields[fieldName]
    const editor = field?.editor

    return {
      key: fieldName,
      label: editor?.label || fieldName,
      input: editor?.input || 'text',
      ...(editor?.placeholder ? { placeholder: editor.placeholder } : {}),
      ...(editor?.options ? { options: editor.options } : {}),
      ...(field?.scope ? { scope: field.scope } : {}),
      ...(field && 'defaultValue' in field ? { defaultValue: field.defaultValue } : {}),
      ...(field?.description ? { description: field.description } : {}),
    }
  })
}

/**
 * 获取指定分类下的字段编辑提示。
 */
export function getFieldEditorsForCategory(
  category: string,
  dataModel: DataModelSet,
): ResolvedFieldEditor[] {
  return resolveFieldEditors(getFieldsForCategory(category, dataModel), dataModel)
}

/**
 * 获取指定 shape 下的字段编辑提示。
 */
export function getFieldEditorsForShape(
  shape: string,
  category: string,
  dataModel: DataModelSet,
): ResolvedFieldEditor[] {
  return resolveFieldEditors(getResolvedFieldNamesForShape(shape, category, dataModel), dataModel)
}

/**
 * 根据 dataModel 中的字段能力构建默认数据对象。
 */
export function buildDefaultData(
  fields: string[],
  dataModel: DataModelSet,
): Record<string, unknown> {
  const data: Record<string, unknown> = {}
  for (const fieldName of fields) {
    const field = dataModel.fields[fieldName]
    if (field && field.defaultValue !== undefined) {
      data[fieldName] = field.defaultValue
    }
  }
  return data
}

/**
 * 验证一组字段值。
 *
 * @returns 所有失败的字段及原因
 */
export function validateFields(
  data: Record<string, unknown>,
  fields: string[],
  context: FieldValidateContext,
  dataModel: DataModelSet,
): Array<{ field: string; reason: string }> {
  const failures: Array<{ field: string; reason: string }> = []
  for (const fieldName of fields) {
    const value = data[fieldName]
    const result = validateFieldValue(fieldName, value, context, dataModel)
    if (result !== true) {
      failures.push({ field: fieldName, reason: result })
    }
  }
  return failures
}
