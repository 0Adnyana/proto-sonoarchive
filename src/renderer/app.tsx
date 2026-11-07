import { useEffect, useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { LibraryFile } from '../shared/ipc'
import {
  errorText,
  formatImportStatus,
  formatLibraryStatus,
  type LibraryBridge,
} from './library'
import { LibraryView } from './library-view'

type AppProps = {
  bridge: LibraryBridge
}

export function App({ bridge }: AppProps) {
  const [files, setFiles] = useState<LibraryFile[]>([])
  const [baseStatus, setBaseStatus] = useState('')
  const [notices, setNotices] = useState<string[]>([])
  const status = formatLibraryStatus(baseStatus, notices)

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
    <Tabs defaultValue="library" className="gap-4 p-6">
      <TabsList>
        <TabsTrigger value="library">Library</TabsTrigger>
        <TabsTrigger value="tag">Tag</TabsTrigger>
        <TabsTrigger value="search">Search</TabsTrigger>
      </TabsList>
      <TabsContent value="library">
        <LibraryView files={files} status={status} onImport={onImport} />
      </TabsContent>
      <TabsContent value="tag">
        <h1 className="text-lg font-semibold">Tag</h1>
      </TabsContent>
      <TabsContent value="search">
        <h1 className="text-lg font-semibold">Search</h1>
      </TabsContent>
    </Tabs>
  )
}
