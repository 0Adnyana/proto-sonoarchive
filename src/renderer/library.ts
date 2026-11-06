import type {
  ImportFolderResult,
  LibraryFile,
  SonoarchiveBridge,
} from '../shared/ipc'

type LibraryBridge = Pick<
  SonoarchiveBridge,
  'importFolder' | 'listLibrary' | 'onLibraryChanged'
>

export function formatDurationSeconds(duration: number): string {
  const rounded = Math.round(duration * 1000) / 1000
  return String(rounded)
}

export function formatImportStatus(result: ImportFolderResult): string {
  const noun = result.stored === 1 ? 'file' : 'files'
  const stored = `Stored ${result.stored} ${noun}.`
  if (result.failed.length === 0) return stored
  return `${stored} Could not decode ${result.failed.join(', ')}.`
}

export function renderLibrary(root: ParentNode, files: LibraryFile[]): void {
  const tbody = root.querySelector<HTMLElement>('[data-library-rows]')
  if (!tbody) return
  tbody.replaceChildren(
    ...files.map((file) => {
      const row = document.createElement('tr')
      for (const value of [
        file.name,
        file.format,
        formatDurationSeconds(file.duration),
        file.status,
      ]) {
        const cell = document.createElement('td')
        cell.textContent = value
        row.append(cell)
      }
      return row
    }),
  )
}

export function renderLibraryStatus(root: ParentNode, message: string): void {
  const status = root.querySelector<HTMLElement>('[data-library-status]')
  if (!status) return
  status.textContent = message
}

export function startLibrary(root: ParentNode, bridge: LibraryBridge): void {
  let seenChange = false

  void bridge
    .listLibrary()
    .then((files) => {
      if (!seenChange) renderLibrary(root, files)
    })
    .catch((error: unknown) => {
      renderLibraryStatus(root, errorText(error))
    })

  bridge.onLibraryChanged((files) => {
    seenChange = true
    renderLibrary(root, files)
  })

  root
    .querySelector<HTMLButtonElement>('#import-folder')
    ?.addEventListener('click', () => {
      void bridge
        .importFolder()
        .then((result) => {
          if (!result) return
          renderLibraryStatus(root, formatImportStatus(result))
        })
        .catch((error: unknown) => {
          renderLibraryStatus(root, errorText(error))
        })
    })
}

function errorText(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  return 'Could not open the library.'
}
