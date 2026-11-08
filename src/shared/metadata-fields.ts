export const metadataFieldNames = [
  'CatID',
  'Category',
  'SubCategory',
  'FXName',
  'CreatorID',
  'SourceID',
] as const

export type MetadataFieldName = (typeof metadataFieldNames)[number]

export type MetadataFieldValues = Record<MetadataFieldName, string>
