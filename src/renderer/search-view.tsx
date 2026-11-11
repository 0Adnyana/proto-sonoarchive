import { useState } from 'react'
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
import type { SearchHit } from '../shared/ipc'

type SearchViewProps = {
  openPath: string | null
  hits: readonly SearchHit[]
  message: string
  onSearchText: (query: string) => void
  onFindSimilar: () => void
  onOpen: (path: string) => void
}

export function SearchView({
  openPath,
  hits,
  message,
  onSearchText,
  onFindSimilar,
  onOpen,
}: SearchViewProps) {
  const [query, setQuery] = useState('')

  return (
    <section className="flex flex-col gap-3">
      <h1 className="text-lg font-semibold">Search</h1>
      <div className="flex flex-wrap items-center gap-2">
        <div className="w-64">
          <Input
            aria-label="Query"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== 'Enter') return
              event.preventDefault()
              onSearchText(query)
            }}
          />
        </div>
        <Button type="button" onClick={() => onSearchText(query)}>
          Search
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={openPath == null}
          onClick={() => {
            if (openPath == null) return
            onFindSimilar()
          }}
        >
          Find similar to selected file
        </Button>
      </div>
      <p role="status">{message}</p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>File</TableHead>
            <TableHead>CatID</TableHead>
            <TableHead>FXName</TableHead>
            <TableHead>Similarity</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {hits.map((hit) => (
            <TableRow
              key={hit.path}
              className="cursor-pointer"
              tabIndex={0}
              onClick={() => onOpen(hit.path)}
              onKeyDown={(event) => {
                if (event.key !== 'Enter' && event.key !== ' ') return
                event.preventDefault()
                onOpen(hit.path)
              }}
            >
              <TableCell>{hit.name}</TableCell>
              <TableCell>{hit.catId}</TableCell>
              <TableCell>{hit.fxName}</TableCell>
              <TableCell>{formatSimilarity(hit.similarity)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </section>
  )
}

function formatSimilarity(similarity: number | null): string {
  if (similarity === null) return ''
  return similarity.toFixed(3)
}
