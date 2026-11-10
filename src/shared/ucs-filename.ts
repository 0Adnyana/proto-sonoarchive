export type UcsFilenameFields = {
  catId: string
  fxName: string
  creatorId: string
  sourceId: string
}

export function ucsFilename(
  filePath: string,
  fields: UcsFilenameFields,
): string {
  const stem = [fields.catId, fields.fxName, fields.creatorId, fields.sourceId]
    .map((field) => field.trim())
    .join('_')
  return `${stem}${extensionName(filePath)}`
}

function extensionName(filePath: string): string {
  const slash = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'))
  const name = slash === -1 ? filePath : filePath.slice(slash + 1)
  const dot = name.lastIndexOf('.')
  if (dot <= 0) return ''
  return name.slice(dot)
}
