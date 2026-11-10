import { existsSync, realpathSync, renameSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { SaveWavInput } from '../shared/ipc'
import type { MetadataFieldValues } from '../shared/metadata-fields'
import { ucsFilename } from '../shared/ucs-filename'
import { assertSavableLabel, type LibraryDatabase, saveLabel } from './database'
import { writeWavMetadata } from './wav-metadata'

export function saveTaggedWav(
  db: LibraryDatabase,
  input: SaveWavInput,
): string {
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
  const nextName = ucsFilename(input.path, {
    catId: input.catId,
    fxName: prepared.fxName,
    creatorId: prepared.creatorId,
    sourceId: prepared.sourceId,
  })
  const destination = join(dirname(input.path), nextName)
  if (!input.rename || destination === input.path) {
    writeWavMetadata(input.path, values)
    saveLabel(db, input)
    return input.path
  }
  if (basenameRejected(nextName)) {
    writeWavMetadata(input.path, values)
    saveLabel(db, input)
    throw new Error(`Could not rename the file to ${nextName}.`)
  }
  if (nameTaken(db, input.path, destination)) {
    writeWavMetadata(input.path, values)
    saveLabel(db, input)
    throw new Error(`A file named ${nextName} already exists.`)
  }
  writeWavMetadata(input.path, values)
  try {
    renameSync(input.path, destination)
  } catch (error) {
    saveLabel(db, input)
    throw new Error(`Could not rename the file to ${nextName}.`, {
      cause: error,
    })
  }
  try {
    storeRenamedFile(db, input, destination, nextName)
  } catch (error) {
    try {
      renameSync(destination, input.path)
    } catch {
      throw error
    }
    saveLabel(db, input)
    throw error
  }
  return destination
}

function storeRenamedFile(
  db: LibraryDatabase,
  input: SaveWavInput,
  destination: string,
  nextName: string,
): void {
  const moveSuggestions = db.prepare(
    'UPDATE suggestions SET path = ? WHERE path = ?',
  )
  const moveLabels = db.prepare('UPDATE labels SET path = ? WHERE path = ?')
  const moveFile = db.prepare(
    'UPDATE files SET path = ?, name = ? WHERE path = ?',
  )
  const write = db.transaction(() => {
    if (moveFile.run(destination, nextName, input.path).changes !== 1) {
      throw new Error(`No stored file for ${input.path}`)
    }
    moveSuggestions.run(destination, input.path)
    moveLabels.run(destination, input.path)
    saveLabel(db, { ...input, path: destination })
  })
  write()
}

function basenameRejected(name: string): boolean {
  return (
    name.length === 0 ||
    name.includes('/') ||
    name.includes('\\') ||
    name.includes('\0')
  )
}

function nameTaken(
  db: LibraryDatabase,
  current: string,
  destination: string,
): boolean {
  const stored = db
    .prepare('SELECT path FROM files WHERE path = ?')
    .get(destination) as { path: string } | undefined
  if (stored) return true
  if (!existsSync(destination)) return false
  try {
    return realpathSync(destination) !== realpathSync(current)
  } catch {
    return true
  }
}
