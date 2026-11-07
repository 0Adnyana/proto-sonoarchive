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
  onImport: () => void
}

export function LibraryView({ files, status, onImport }: LibraryViewProps) {
  return (
    <section className="flex flex-col gap-3">
      <h1 className="text-lg font-semibold">Library</h1>
      <div>
        <Button type="button" onClick={onImport}>
          Import folder
        </Button>
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
            <TableRow key={file.name}>
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
