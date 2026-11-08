# Build slices

The MVP is built in 8 thin slices. Each one runs end to end, from audio file to what the user sees, and has its own test that must pass before the next slice starts. S1 is the walking skeleton; every later slice adds one capability to it.

Full spec: [../00-mvp-spec.md](../00-mvp-spec.md)

| Slice | What you can demo | Needs |
| --- | --- | --- |
| [S1 · Walking skeleton](S1-walking-skeleton.md) | Import a folder of short WAVs and see each file's top-5 CatIDs | — |
| [S2 · Tag and save WAV](S2-tag-and-save-wav.md) | Confirm a label; the tags show up in Soundly | S1 |
| [S3 · MP3 and FLAC](S3-mp3-and-flac.md) | The same loop for MP3 and FLAC | S2 |
| [S4 · Long files](S4-long-files.md) | Keep tagging while long files analyse in the background | S1 |
| [S5 · UCS rename](S5-ucs-rename.md) | The file gets its UCS filename on Save | S2 |
| [S6 · Search](S6-search.md) | Text search and Find similar | S2 |
| [S7 · Retrain](S7-retrain.md) | *Retrain probe* produces a new, versioned probe | S2 |
| [S8 · Evaluation](S8-evaluation.md) | One command outputs macro F1, top-1, top-5 and the correction simulation | S1 |

After S2, slices S3–S7 can be built in any order; S8 can run any time after S1.

## Shared test fixtures

Every slice tests against the same small set, kept in the repo:

- **F-short:** 20 WAVs of 10 s or less from the EnvSound-UCS test split, with known CatIDs. At least two pairs share a subcategory.
- **F-ref:** the top-5 CatIDs and scores for each F-short file, computed by the original PyTorch pipeline and the existing probe.
- **F-formats:** 5 F-short files also encoded as MP3 and FLAC.
- **F-long:** one 1-minute and one 10-minute file (e.g. ambiences).
- **F-sm:** one WAV tagged in Soundminer, as the field-name reference. S2 does not use it; a later slice checks the mapping table against it.
