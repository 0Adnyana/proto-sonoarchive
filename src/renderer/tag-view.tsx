import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  isLabelRank,
  type LabelRank,
  type LibraryFile,
  type UcsEntry,
} from '../shared/ipc'
import { ucsFilename } from '../shared/ucs-filename'
import { errorText, type LibraryBridge } from './library'
import { catalogOption, nextUntaggedPath, suggestionLabel } from './tag'

type TagViewProps = {
  file: LibraryFile | null
  files: readonly LibraryFile[]
  catalog: readonly UcsEntry[]
  notice: string
  bridge: Pick<LibraryBridge, 'saveLabel' | 'mediaUrl'>
  onOpen: (path: string) => void
}

export function TagView({
  file,
  files,
  catalog,
  notice,
  bridge,
  onOpen,
}: TagViewProps) {
  return (
    <section className="flex max-w-2xl flex-col gap-4">
      <h1 className="text-lg font-semibold">Tag</h1>
      {file ? (
        <TagEditor
          key={file.path}
          file={file}
          files={files}
          catalog={catalog}
          notice={notice}
          bridge={bridge}
          onOpen={onOpen}
        />
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            Select a file in Library.
          </p>
          <div>
            <Button type="button" disabled>
              Play
            </Button>
          </div>
          <p role="status">{notice}</p>
        </>
      )}
    </section>
  )
}

function TagEditor({
  file,
  files,
  catalog,
  notice,
  bridge,
  onOpen,
}: TagViewProps & { file: LibraryFile }) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const initial = choiceFromLabel(file)
  const [rank, setRank] = useState(initial.rank)
  const [manual, setManual] = useState(initial.manual)
  const [fxName, setFxName] = useState(file.label?.fxName ?? '')
  const [creatorId, setCreatorId] = useState(file.label?.creatorId ?? '')
  const [sourceId, setSourceId] = useState(file.label?.sourceId ?? '')
  const [rename, setRename] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [saveStatus, setSaveStatus] = useState('')
  const catalogById = new Map(catalog.map((entry) => [entry.catId, entry]))
  const selectedCatId = manual
    ? manual
    : rank
      ? (file.suggestions[Number(rank) - 1]?.catId ?? null)
      : null
  const selectedRank: LabelRank | null = manual
    ? 'manual'
    : isLabelRank(rank) && rank !== 'manual'
      ? rank
      : null
  const saveEnabled =
    selectedCatId !== null && selectedRank !== null && fxName.trim().length > 0
  const preview = ucsFilename(file.path, {
    catId: selectedCatId ?? '',
    fxName,
    creatorId,
    sourceId,
  })

  useEffect(() => {
    const audio = audioRef.current
    return () => {
      audio?.pause()
    }
  }, [])

  async function onPlayStop(): Promise<void> {
    const audio = audioRef.current
    if (!audio) return
    if (playing) {
      audio.pause()
      audio.currentTime = 0
      setPlaying(false)
      return
    }
    try {
      const url = await bridge.mediaUrl(file.path)
      if (audio.getAttribute('src') !== url) audio.src = url
      await audio.play()
      setPlaying(true)
    } catch (error: unknown) {
      setPlaying(false)
      setSaveStatus(errorText(error))
    }
  }

  async function onSave(): Promise<void> {
    if (!selectedCatId || !selectedRank) return
    try {
      const savedPath = await bridge.saveLabel({
        path: file.path,
        catId: selectedCatId,
        fxName,
        creatorId,
        sourceId,
        rank: selectedRank,
        rename,
      })
      setSaveStatus('')
      toast.success(`Saved ${file.name} as ${selectedCatId}`)
      onOpen(savedPath)
    } catch (error: unknown) {
      setSaveStatus(errorText(error))
    }
  }

  function onNext(): void {
    const next = nextUntaggedPath(files, file.path)
    if (next) onOpen(next)
  }

  return (
    <>
      <p className="text-sm font-medium">{file.name}</p>
      <div>
        <Button type="button" onClick={() => void onPlayStop()}>
          {playing ? 'Stop' : 'Play'}
        </Button>
      </div>
      {file.suggestions.length > 0 ? (
        <fieldset className="flex flex-col gap-3">
          <legend className="text-sm font-medium">Suggestions</legend>
          <RadioGroup
            aria-label="Suggestions"
            value={rank}
            onValueChange={(value) => {
              setRank(value)
              setManual('')
            }}
          >
            {file.suggestions.map((suggestion, index) => {
              const value = String(index + 1)
              const id = `suggestion-${value}`
              return (
                <div key={value} className="flex items-start gap-2">
                  <RadioGroupItem value={value} id={id} className="mt-0.5" />
                  <Label htmlFor={id} className="font-normal">
                    {suggestionLabel(
                      suggestion,
                      catalogById.get(suggestion.catId),
                    )}
                  </Label>
                </div>
              )
            })}
          </RadioGroup>
        </fieldset>
      ) : null}
      <div className="flex flex-col gap-2">
        <Label htmlFor="other-cat">Other…</Label>
        <Select
          value={manual}
          onValueChange={(value) => {
            setManual(value)
            setRank('')
          }}
        >
          <SelectTrigger id="other-cat" className="w-full">
            <SelectValue placeholder="Choose a CatID" />
          </SelectTrigger>
          <SelectContent position="popper" className="max-h-80">
            {catalog.map((entry) => (
              <SelectItem key={entry.catId} value={entry.catId}>
                {catalogOption(entry)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="fx-name">FXName</Label>
        <Input
          id="fx-name"
          value={fxName}
          onChange={(event) => setFxName(event.target.value)}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="creator-id">CreatorID</Label>
        <Input
          id="creator-id"
          value={creatorId}
          onChange={(event) => setCreatorId(event.target.value)}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="source-id">SourceID</Label>
        <Input
          id="source-id"
          value={sourceId}
          onChange={(event) => setSourceId(event.target.value)}
        />
      </div>
      <div className="flex items-center gap-2">
        <Checkbox
          id="rename-ucs"
          checked={rename}
          onCheckedChange={(checked) => setRename(checked === true)}
        />
        <Label htmlFor="rename-ucs">Rename to UCS filename</Label>
      </div>
      <p className="text-sm text-muted-foreground">{preview}</p>
      <div className="flex gap-2">
        <Button
          type="button"
          disabled={!saveEnabled}
          onClick={() => void onSave()}
        >
          Save
        </Button>
        <Button type="button" variant="outline" onClick={onNext}>
          Next file
        </Button>
      </div>
      <p role="status">{saveStatus || notice}</p>
      {/* biome-ignore lint/a11y/useMediaCaption: the file being played is the sound effect */}
      <audio ref={audioRef} hidden />
    </>
  )
}

function choiceFromLabel(file: LibraryFile): { rank: string; manual: string } {
  const label = file.label
  if (!label) return { rank: '', manual: '' }
  if (label.rank === 'manual') return { rank: '', manual: label.catId }
  const suggestion = file.suggestions[Number(label.rank) - 1]
  if (suggestion?.catId === label.catId) return { rank: label.rank, manual: '' }
  return { rank: '', manual: '' }
}
