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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { LibraryFile } from '../shared/ipc'
import { formatDurationSeconds } from './library'

type LibraryViewProps = {
  files: LibraryFile[]
  status: string
  selectedPath: string | null
  resetting: boolean
  onImport: () => void
  onReset: () => void
  onOpen: (path: string) => void
}

export function LibraryView({
  files,
  status,
  selectedPath,
  resetting,
  onImport,
  onReset,
  onOpen,
}: LibraryViewProps) {
  return (
    <section className="flex flex-col gap-3">
      <h1 className="text-lg font-semibold">Library</h1>
      <div className="flex items-center gap-2">
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
      </div>
      <p role="status">{status}</p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>File name</TableHead>
            <TableHead>Format</TableHead>
            <TableHead>Duration (seconds)</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>CatID</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {files.map((file) => (
            <TableRow
              key={file.path}
              data-state={file.path === selectedPath ? 'selected' : undefined}
              className="cursor-pointer"
              tabIndex={0}
              onClick={() => onOpen(file.path)}
              onKeyDown={(event) => {
                if (event.key !== 'Enter' && event.key !== ' ') return
                event.preventDefault()
                onOpen(file.path)
              }}
            >
              <TableCell>{file.name}</TableCell>
              <TableCell>{file.format}</TableCell>
              <TableCell>{formatDurationSeconds(file.duration)}</TableCell>
              <TableCell>{file.status}</TableCell>
              <TableCell>{file.catId ?? ''}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </section>
  )
}
