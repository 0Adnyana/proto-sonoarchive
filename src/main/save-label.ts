import type { SaveLabelInput } from '../shared/ipc'
import type { MetadataFieldValues } from '../shared/metadata-fields'
import { assertSavableLabel, type LibraryDatabase, saveLabel } from './database'
import { writeWavMetadata } from './wav-metadata'

export function saveTaggedWav(
  db: LibraryDatabase,
  input: SaveLabelInput,
): void {
  const prepared = assertSavableLabel(db, input)
  const category = db
    .prepare(
      `SELECT Category AS category, SubCategory AS subCategory
       FROM ucs
       WHERE CatID = ?`,
    )
    .get(input.catId) as { category: string; subCategory: string } | undefined
  if (!category) throw new Error(`Unknown CatID ${input.catId}`)
  const values: MetadataFieldValues = {
    CatID: input.catId,
    Category: category.category,
    SubCategory: category.subCategory,
    FXName: prepared.fxName,
    CreatorID: prepared.creatorId,
    SourceID: prepared.sourceId,
  }
  writeWavMetadata(input.path, values)
  saveLabel(db, input)
}
