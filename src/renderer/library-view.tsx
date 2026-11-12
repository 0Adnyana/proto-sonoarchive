import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { LibraryFile, SearchHit } from '../shared/ipc'
import { formatDurationSeconds } from './library'

type LibraryViewProps = {
  files: LibraryFile[]
  hits: readonly SearchHit[]
  showingHits: boolean
  query: string
  status: string
  selectedPath: string | null
  resetting: boolean
  onQueryChange: (value: string) => void
  onSubmitQuery: () => void
  onClearHits: () => void
  onImport: () => void
  onReset: () => void
  onOpen: (path: string) => void
}

export function LibraryView({
  files,
  hits,
  showingHits,
  query,
  status,
  selectedPath,
  resetting,
  onQueryChange,
  onSubmitQuery,
  onClearHits,
  onImport,
  onReset,
  onOpen,
}: LibraryViewProps) {
  const rows = showingHits ? hitRows(hits, files) : libraryRows(files)

  return (
    <section className="flex flex-col gap-3">
      <h1 className="text-lg font-semibold">Library</h1>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" onClick={onImport}>
          Import folder
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button type="button" variant="outline" disabled={resetting}>
              Reset database
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Reset database?</AlertDialogTitle>
              <AlertDialogDescription>
                This removes every imported file, suggestion, and label from the
                library. Audio files on disk stay where they are. The UCS
                catalog stays.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                disabled={resetting}
                onClick={onReset}
              >
                Reset database
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <div className="w-64">
          <Input
            aria-label="Query"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== 'Enter') return
              event.preventDefault()
              onSubmitQuery()
            }}
          />
        </div>
        <Button type="button" onClick={onSubmitQuery}>
          Search
        </Button>
        {showingHits ? (
          <Button type="button" variant="outline" onClick={onClearHits}>
            Clear results
          </Button>
        ) : null}
      </div>
      <p role="status" aria-label="Library status">
        {status}
      </p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>File name</TableHead>
            <TableHead>Format</TableHead>
            <TableHead>Duration (seconds)</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>CatID</TableHead>
            {showingHits ? (
              <>
                <TableHead>FXName</TableHead>
                <TableHead>Similarity</TableHead>
              </>
            ) : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow
              key={row.path}
              data-state={row.path === selectedPath ? 'selected' : undefined}
              className="cursor-pointer"
              tabIndex={0}
              onClick={() => onOpen(row.path)}
              onKeyDown={(event) => {
                if (event.key !== 'Enter' && event.key !== ' ') return
                event.preventDefault()
                onOpen(row.path)
              }}
            >
              <TableCell>{row.name}</TableCell>
              <TableCell>{row.format}</TableCell>
              <TableCell>{row.duration}</TableCell>
              <TableCell>{row.status}</TableCell>
              <TableCell>{row.catId}</TableCell>
              {showingHits ? (
                <>
                  <TableCell>{row.fxName}</TableCell>
                  <TableCell>{row.similarity}</TableCell>
                </>
              ) : null}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </section>
  )
}

type DisplayRow = {
  path: string
  name: string
  format: string
  duration: string
  status: string
  catId: string
  fxName: string
  similarity: string
}

function libraryRows(files: readonly LibraryFile[]): DisplayRow[] {
  return files.map((file) => ({
    path: file.path,
    name: file.name,
    format: file.format,
    duration: formatDurationSeconds(file.duration),
    status: file.status,
    catId: file.catId ?? '',
    fxName: '',
    similarity: '',
  }))
}

function hitRows(
  hits: readonly SearchHit[],
  files: readonly LibraryFile[],
): DisplayRow[] {
  const byPath = new Map(files.map((file) => [file.path, file]))
  return hits.map((hit) => {
    const file = byPath.get(hit.path)
    return {
      path: hit.path,
      name: hit.name,
      format: file?.format ?? '',
      duration: file ? formatDurationSeconds(file.duration) : '',
      status: file?.status ?? '',
      catId: hit.catId,
      fxName: hit.fxName,
      similarity: formatSimilarity(hit.similarity),
    }
  })
}

function formatSimilarity(similarity: number | null): string {
  if (similarity === null) return ''
  return similarity.toFixed(3)
}
