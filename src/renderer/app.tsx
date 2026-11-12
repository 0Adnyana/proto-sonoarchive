import { useEffect, useRef, useState } from 'react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Toaster } from '@/components/ui/sonner'
import type {
  AnalysisProgress,
  LibraryFile,
  SearchHit,
  UcsEntry,
} from '../shared/ipc'
import {
  errorText,
  formatImportStatus,
  formatLibraryStatus,
  type LibraryBridge,
} from './library'
import { LibraryView } from './library-view'
import { TagView } from './tag-view'

type AppProps = {
  bridge: LibraryBridge
}

export function App({ bridge }: AppProps) {
  const [openPath, setOpenPath] = useState<string | null>(null)
  const [files, setFiles] = useState<LibraryFile[]>([])
  const [catalog, setCatalog] = useState<UcsEntry[]>([])
  const [catalogNotice, setCatalogNotice] = useState('')
  const [baseStatus, setBaseStatus] = useState('')
  const [notices, setNotices] = useState<string[]>([])
  const [progress, setProgress] = useState<AnalysisProgress | null>(null)
  const [resetting, setResetting] = useState(false)
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<SearchHit[]>([])
  const [showingHits, setShowingHits] = useState(false)
  const [searchError, setSearchError] = useState('')
  const noticesRef = useRef<string[]>([])
  const searchRequest = useRef(0)
  const status = formatLibraryStatus(baseStatus, notices, progress, searchError)
  const openFile = files.find((file) => file.path === openPath) ?? null
  const openName =
    openFile?.name ??
    hits.find((hit) => hit.path === openPath)?.name ??
    fileNameFromPath(openPath)

  useEffect(() => {
    let seenChange = false
    let active = true
    noticesRef.current = []

    void bridge
      .listLibrary()
      .then((rows) => {
        if (!active || seenChange) return
        setFiles(rows)
      })
      .catch((error: unknown) => {
        if (!active) return
        setBaseStatus(errorText(error))
      })

    const unsubscribe = bridge.onLibraryChanged((rows) => {
      seenChange = true
      setFiles(rows)
    })
    const unsubscribeNotice = bridge.onLibraryNotice((notice) => {
      if (!active) return
      noticesRef.current = [...noticesRef.current, notice]
      setNotices(noticesRef.current)
    })
    const unsubscribeProgress = bridge.onAnalysisProgress((next) => {
      if (!active) return
      setProgress(next)
    })

    return () => {
      active = false
      unsubscribe()
      unsubscribeNotice()
      unsubscribeProgress()
    }
  }, [bridge])

  useEffect(() => {
    let active = true
    void bridge
      .listUcs()
      .then((rows) => {
        if (!active) return
        setCatalog(rows)
      })
      .catch((error: unknown) => {
        if (!active) return
        setCatalogNotice(errorText(error))
      })
    return () => {
      active = false
    }
  }, [bridge])

  function openLibraryFile(path: string): void {
    setOpenPath(path)
  }

  function clearHits(): void {
    searchRequest.current += 1
    setHits([])
    setShowingHits(false)
    setSearchError('')
  }

  function onReset(): void {
    setResetting(true)
    // Keep a rejection from a missing or throwing bridge off the click handler,
    // so the confirmation dialog can close and the button can be used again.
    void Promise.resolve()
      .then(() => bridge.resetLibrary())
      .then(() => {
        noticesRef.current = []
        setNotices([])
        setProgress(null)
        setOpenPath(null)
        searchRequest.current += 1
        setQuery('')
        setHits([])
        setShowingHits(false)
        setSearchError('')
        setBaseStatus('Database reset.')
      })
      .catch((error: unknown) => {
        setBaseStatus(errorText(error))
      })
      .finally(() => {
        setResetting(false)
      })
  }

  function showSearchHits(start: () => Promise<SearchHit[]>): void {
    const id = searchRequest.current + 1
    searchRequest.current = id
    void Promise.resolve()
      .then(start)
      .then((rows) => {
        if (searchRequest.current !== id) return
        setHits(rows)
        setShowingHits(true)
        setSearchError('')
      })
      .catch((error: unknown) => {
        if (searchRequest.current !== id) return
        setHits([])
        setShowingHits(true)
        setSearchError(errorText(error))
      })
  }

  function onSearchText(): void {
    if (query.trim() === '') return
    showSearchHits(() => bridge.searchText(query))
  }

  function onFindSimilar(): void {
    if (!openPath) return
    const path = openPath
    setQuery('')
    showSearchHits(() => bridge.findSimilar(path))
  }

  function onImport(): void {
    void bridge
      .importFolder()
      .then((result) => {
        if (!result) return
        setBaseStatus(formatImportStatus(result))
      })
      .catch((error: unknown) => {
        setBaseStatus(errorText(error))
      })
  }

  return (
    <>
      <div className="p-6">
        <LibraryView
          files={files}
          hits={hits}
          showingHits={showingHits}
          query={query}
          status={status}
          selectedPath={openPath}
          resetting={resetting}
          onQueryChange={setQuery}
          onSubmitQuery={onSearchText}
          onClearHits={clearHits}
          onImport={onImport}
          onReset={onReset}
          onOpen={openLibraryFile}
        />
      </div>
      <Sheet
        modal={false}
        open={openPath !== null}
        onOpenChange={(open) => {
          if (!open) setOpenPath(null)
        }}
      >
        <SheetContent
          side="right"
          showOverlay={false}
          className="overflow-y-auto sm:max-w-md"
          onInteractOutside={(event) => event.preventDefault()}
          onPointerDownOutside={(event) => event.preventDefault()}
        >
          <SheetHeader>
            <SheetTitle>{openName}</SheetTitle>
            <SheetDescription className="sr-only">
              Edit tags for this file.
            </SheetDescription>
          </SheetHeader>
          {openFile ? (
            <div className="px-4 pb-4">
              <TagView
                file={openFile}
                files={files}
                catalog={catalog}
                notice={catalogNotice}
                bridge={bridge}
                onOpen={setOpenPath}
                onFindSimilar={onFindSimilar}
              />
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
      <Toaster />
    </>
  )
}

function fileNameFromPath(path: string | null): string {
  if (!path) return ''
  const parts = path.split(/[/\\]/)
  return parts[parts.length - 1] ?? path
}
