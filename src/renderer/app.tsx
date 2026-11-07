import { useEffect, useState } from 'react'
import { Toaster } from '@/components/ui/sonner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { LibraryFile, UcsEntry } from '../shared/ipc'
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
  const [tab, setTab] = useState('library')
  const [openPath, setOpenPath] = useState<string | null>(null)
  const [files, setFiles] = useState<LibraryFile[]>([])
  const [catalog, setCatalog] = useState<UcsEntry[]>([])
  const [catalogNotice, setCatalogNotice] = useState('')
  const [baseStatus, setBaseStatus] = useState('')
  const [notices, setNotices] = useState<string[]>([])
  const status = formatLibraryStatus(baseStatus, notices)
  const openFile = files.find((file) => file.path === openPath) ?? null

  useEffect(() => {
    let seenChange = false
    let active = true
    const seenNotices: string[] = []

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
      seenNotices.push(notice)
      setNotices([...seenNotices])
    })

    return () => {
      active = false
      unsubscribe()
      unsubscribeNotice()
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
            onImport={onImport}
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
          <h1 className="text-lg font-semibold">Search</h1>
        </TabsContent>
      </Tabs>
      <Toaster />
    </>
  )
}
