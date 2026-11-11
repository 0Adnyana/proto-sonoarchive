import { useEffect, useRef, useState } from 'react'
import { Toaster } from '@/components/ui/sonner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
import { SearchView } from './search-view'
import { TagView } from './tag-view'

type AppProps = {
  bridge: LibraryBridge
}

export function App({ bridge }: AppProps) {
  const [tab, setTab] = useState('library')
  const [openPath, setOpenPath] = useState<string | null>(null)
  const [files, setFiles] = useState<LibraryFile[]>([])
  const [catalog, setCatalog] = useState<UcsEntry[]>([])
  const [catalogNotice, setCatalogNotice] = useState('')
  const [baseStatus, setBaseStatus] = useState('')
  const [notices, setNotices] = useState<string[]>([])
  const [progress, setProgress] = useState<AnalysisProgress | null>(null)
  const [resetting, setResetting] = useState(false)
  const [hits, setHits] = useState<SearchHit[]>([])
  const [searchError, setSearchError] = useState('')
  const noticesRef = useRef<string[]>([])
  const searchRequest = useRef(0)
  const status = formatLibraryStatus(baseStatus, notices, progress)
  const openFile = files.find((file) => file.path === openPath) ?? null

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
    setTab('tag')
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
        setHits([])
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
        setSearchError('')
      })
      .catch((error: unknown) => {
        if (searchRequest.current !== id) return
        setHits([])
        setSearchError(errorText(error))
      })
  }

  function onSearchText(query: string): void {
    showSearchHits(() => bridge.searchText(query))
  }

  function onFindSimilar(): void {
    if (!openPath) return
    const path = openPath
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
      <Tabs value={tab} onValueChange={setTab} className="gap-4 p-6">
        <TabsList>
          <TabsTrigger value="library">Library</TabsTrigger>
          <TabsTrigger value="tag">Tag</TabsTrigger>
          <TabsTrigger value="search">Search</TabsTrigger>
        </TabsList>
        <TabsContent value="library">
          <LibraryView
            files={files}
            status={status}
            selectedPath={openPath}
            resetting={resetting}
            onImport={onImport}
            onReset={onReset}
            onOpen={openLibraryFile}
          />
        </TabsContent>
        <TabsContent value="tag">
          <TagView
            file={openFile}
            files={files}
            catalog={catalog}
            notice={catalogNotice}
            bridge={bridge}
            onOpen={setOpenPath}
          />
        </TabsContent>
        <TabsContent value="search">
          <SearchView
            openPath={openPath}
            hits={hits}
            message={searchError}
            onSearchText={onSearchText}
            onFindSimilar={onFindSimilar}
            onOpen={openLibraryFile}
          />
        </TabsContent>
      </Tabs>
      <Toaster />
    </>
  )
}
