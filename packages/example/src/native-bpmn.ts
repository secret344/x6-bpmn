export const NATIVE_BPMN_FIELD_KEYS = new Set([
  'annotationText',
  'conditionExpression',
  'processRef',
])

export function filterNativeFieldEditors<T extends { key: string }>(editors: T[]): T[] {
  return editors.filter((editor) => NATIVE_BPMN_FIELD_KEYS.has(editor.key))
}

export function buildNativeBpmnData(
  previousBpmn: Record<string, unknown> | undefined,
  nextBpmn: Record<string, unknown> | undefined,
): Record<string, unknown> {
  const carriedForward = Object.fromEntries(
    Object.entries(previousBpmn ?? {}).filter(([key]) => !NATIVE_BPMN_FIELD_KEYS.has(key)),
  )

  const native = Object.fromEntries(
    Object.entries(nextBpmn ?? {}).filter(([key, value]) => {
      return NATIVE_BPMN_FIELD_KEYS.has(key) && value !== undefined && value !== null && value !== ''
    }),
  )

  return {
    ...carriedForward,
    ...native,
  }
}