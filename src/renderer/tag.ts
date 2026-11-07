import type { LibraryFile, Suggestion, UcsEntry } from '../shared/ipc'

export function formatScore(score: number): string {
  return score.toFixed(3)
}

export function categoryText(category: string, subCategory: string): string {
  return `${category} › ${subCategory}`
}

export function suggestionLabel(
  suggestion: Suggestion,
  entry: UcsEntry | undefined,
): string {
  const score = formatScore(suggestion.score)
  if (!entry) return `${suggestion.catId} ${score}`
  return `${suggestion.catId} ${categoryText(entry.category, entry.subCategory)} ${score}`
}

export function catalogOption(entry: UcsEntry): string {
  return `${entry.catId} ${categoryText(entry.category, entry.subCategory)}`
}

export function nextUntaggedPath(
  files: readonly LibraryFile[],
  currentPath: string,
): string | null {
  const start = files.findIndex((file) => file.path === currentPath)
  if (start < 0) return null
  for (let offset = 1; offset < files.length; offset += 1) {
    const file = files[(start + offset) % files.length]
    if (file?.status === 'untagged') return file.path
  }
  return null
}
