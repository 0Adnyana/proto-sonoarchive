# Build slices

The MVP is built in 8 thin slices. Each one runs end to end, from audio file to what the user sees, and has its own test that must pass before the next slice starts. S1 is the walking skeleton; every later slice adds one capability to it.

Full spec: [../00-mvp-spec.md](../00-mvp-spec.md)

| Slice | What you can demo | Needs |
| --- | --- | --- |
| [S1 · Walking skeleton](S1-walking-skeleton.md) | Import a folder of short WAVs and see each file's top-5 CatIDs | — |
| [S2 · Tag and save WAV](S2-tag-and-save-wav.md) | Confirm a label; the tags show up in Soundly | S1 |
| [S3 · Long files](S3-long-files.md) | Keep tagging while long files analyse in the background | S1 |
| [S4 · UCS rename](S4-ucs-rename.md) | The file gets its UCS filename on Save | S2 |
| [S5 · Search](S5-search.md) | Text search and Find similar | S2 |
| [S6 · Retrain](S6-retrain.md) | *Retrain probe* produces a new, versioned probe | S2 |
| [S7 · Evaluation](S7-evaluation.md) | One command outputs macro F1, top-1, top-5 and the correction simulation | S1 |
| [S8 · MP3 and FLAC](S8-mp3-and-flac.md) | The same loop for MP3 and FLAC | S2, and MP3/FLAC files |

After S2, slices S3–S6 can be built in any order. S7 can run any time after S1. S8 is a later check: it needs MP3 and FLAC copies (F-formats) and a pass in Soundly and SoundQ, so it waits until those are available.

## Shared test fixtures

Every slice tests against the same small set, kept in the repo:

- **F-short:** 20 WAVs of 10 s or less from the EnvSound-UCS test split, with known CatIDs. At least two pairs share a subcategory.
- **F-ref:** the top-5 CatIDs and scores for each F-short file, computed by the original PyTorch pipeline and the existing probe.
- **F-formats:** 5 F-short files also encoded as MP3 and FLAC. Only S8 uses this; it can wait until those files exist.
- **F-long:** one 1-minute and one 10-minute file (e.g. ambiences).
- **F-sm:** one WAV tagged in Soundminer, as the field-name reference. S2 does not use it; S8 checks the mapping table against it.
