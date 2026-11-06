import { useEffect, useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { LibraryFile } from '../shared/ipc'
import { errorText, formatImportStatus, type LibraryBridge } from './library'
import { LibraryView } from './library-view'

type AppProps = {
  bridge: LibraryBridge
}

export function App({ bridge }: AppProps) {
  const [files, setFiles] = useState<LibraryFile[]>([])
  const [status, setStatus] = useState('')

  useEffect(() => {
    let seenChange = false
    let active = true

    void bridge
      .listLibrary()
      .then((rows) => {
        if (!active || seenChange) return
        setFiles(rows)
      })
      .catch((error: unknown) => {
        if (!active) return
        setStatus(errorText(error))
      })

    const unsubscribe = bridge.onLibraryChanged((rows) => {
      seenChange = true
      setFiles(rows)
    })

    return () => {
      active = false
      unsubscribe()
    }
  }, [bridge])

  function onImport(): void {
    void bridge
      .importFolder()
      .then((result) => {
        if (!result) return
        setStatus(formatImportStatus(result))
      })
      .catch((error: unknown) => {
        setStatus(errorText(error))
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
