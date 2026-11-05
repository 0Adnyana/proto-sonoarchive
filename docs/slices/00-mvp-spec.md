# Sonoarchive MVP Spec

Oct 30, 2026 · Bayu

## Overview

Sonoarchive MVP is an Electron desktop app that suggests the top 5 UCS v8.2.1 CatIDs for each audio file, lets the user confirm one, and writes the result into the file and a local index. It exists to prove one loop end to end: import → suggest → confirm → write metadata → retrain the probe.

The UI uses plain default components (table, radio list, text inputs, buttons) and the default system colours. No custom theme, icons or animation.

- User stories for this spec: [01-user-stories.md](01-user-stories.md)
- Build order, as 8 end-to-end testable slices: [build-slices/00-overview.md](build-slices/00-overview.md)

## Scope

| Area | In the MVP | Out of the MVP |
| --- | --- | --- |
| Platform | Electron desktop app (Windows, macOS, Linux) | Web or mobile versions |
| Model | Frozen PANNs CNN14 embedding + linear probe over the 753 UCS v8.2.1 CatIDs | Fine-tuning CNN14, other encoders |
| Retraining | Linear probe only, via the Python backend | Retraining the encoder |
| Tagging | Top-5 CatID suggestions; user confirms one and types FXName, CreatorID, SourceID | Automatic FXName, auto-accepting labels |
| Formats | WAV, MP3, FLAC | Other formats |
| Metadata | iXML (WAV), ID3v2.4 (MP3), Vorbis comment (FLAC), plus the app database; optional rename to the UCS filename on Save | Batch rename of many files at once, export to other library tools |
| Search | Similarity search and text search (supporting, not evaluated) | Advanced filters, saved searches |
| Audio work | Basic play button for the selected file | Sound generation, editing, mixing |
| Licence | Open source, non-commercial academic prototype | Commercial release |

## Architecture & ML pipeline

Tagging runs fully offline inside Electron through ONNX Runtime; Python is needed only when the user retrains the probe.

```
                    Tagging runs inside Electron; Python only retrains the probe

  ┌───────────────────────┐  IPC  ┌───────────────────────────┐  IPC  ┌─────────────────────────────┐
  │ Renderer (UI)         │◄─────►│ Main process              │◄─────►│ Inference worker            │
  │ Library, Tag, Search  │       │ IPC, file import, playback│       │ ONNX Runtime                │
  │ Default HTML comps    │       │ Writes iXML, ID3, Vorbis  │       │ Log-mel → frozen CNN14      │
  └───────────────────────┘       │ Text + similarity search  │       │ 2048-d embedding            │
                                  └─────┬─────────┬─────────┬─┘       │ Linear probe → top-5 CatIDs │
                   read / write tags    │         │         │         └──────────────▲──────────────┘
              ┌─────────────────────────┘         │         └────────────┐           │ new probe
              ▼                       read / write ▼               retrain ▼           │
  ┌───────────────────────┐       ┌───────────────────────────┐       ┌──────────────┴──────────────┐
  │ Audio files           │       │ SQLite database           │       │ Python backend              │
  │ WAV, MP3, FLAC        │       │ files, embeddings, labels │       │ Retrains linear probe only  │
  │ Tags written in place │       │ suggestions, UCS table    │       │ Data + confirmed labels     │
  └───────────────────────┘       └───────────────────────────┘       │ Exports new probe weights   │
                                                                      └─────────────────────────────┘
```

The worker runs off the main process so analysis never freezes the window.

- **Encoder:** PANNs CNN14 (Kong et al., 2020), frozen, exported once to ONNX. Input is mono audio resampled to 32 kHz; output is a 2048-d embedding per file. Files over 10 s are split into 10 s windows (50% overlap); window scores are averaged for the top-5, and window embeddings are averaged for similarity search.
- **Probe:** one linear layer, 2048 → 753 UCS v8.2.1 CatIDs, softmax scores. Stored as a small separate file with its label list and a version, so it can be swapped without touching the encoder.
- **Category:** looked up from the predicted CatID, not predicted separately, as in Beck & Lerch (2026).
- **Suggestions:** the 5 highest-scoring CatIDs, shown with their scores.
- **Retraining:** the backend fits the probe on stored embeddings of the training sets plus the user's confirmed labels, exports new weights, and the worker reloads them. The encoder is never retrained, so no audio needs re-embedding.
- **Similarity search:** cosine distance query in sqlite-vec over the stored float32 embeddings.

## Core user flow

One file is tagged at a time; the loop below is the whole MVP.

1. **Import.** User picks a folder; the app lists every WAV, MP3 and FLAC file in it and adds them to the database as *untagged*.
2. **Analyse.** The app computes each file's CNN14 embedding and the probe's top-5 CatIDs in the background, and stores both.
3. **Review.** User selects a file, plays it, and sees the 5 suggestions with their scores and category/subcategory names.
4. **Confirm.** User picks one suggestion, or searches the full UCS list if none fits, then types FXName, CreatorID and SourceID.
5. **Save.** The app writes the metadata into the file, marks it *tagged* in the database, and logs whether the chosen CatID was suggestion 1–5 or a manual pick. If Rename is ticked, it also renames the file to CatID_FXName_CreatorID_SourceID and updates its path in the database.
6. **Retrain (optional).** User clicks *Retrain*; the Python backend refits the probe on the training data plus all confirmed labels, and the app reloads the new probe.

## Screens

Three screens in one window, switched by plain tabs at the top. Default component styles and colours throughout.

| Screen | Components | What it does |
| --- | --- | --- |
| Library | *Import folder* button, table (file name, format, duration, status, CatID), status text for background analysis | Lists imported files; selecting a row opens it in Tag |
| Tag | File name + *Play/Stop* button; radio list of 5 suggestions (CatID, Category › SubCategory, score); *Other…* dropdown with all 753 CatIDs; text inputs for FXName, CreatorID, SourceID; Rename to UCS filename checkbox with a preview of the new name; *Save* and *Next file* buttons | Confirms one label and writes metadata |
| Search | Text input + *Search* button; *Find similar to selected file* button; results table (file, CatID, FXName, similarity) | Text search and embedding similarity search |

Retraining sits on the Library screen as a *Retrain probe* button with a status line (running, done with date, or error). Save is disabled until a CatID is chosen and FXName is not empty.

## Data & metadata writing

Every confirmed label goes to two places: inside the audio file, and into a local SQLite database (better-sqlite3 driver with the sqlite-vec extension) that drives the Library and Search screens.

**Fields written** (same six for every format): CatID, Category, SubCategory, FXName, CreatorID, SourceID. Category and SubCategory are looked up from the CatID in the UCS v8.2.1 table, never typed.

| Format | Container | Where the fields go |
| --- | --- | --- |
| WAV | iXML chunk | One tag per field in the open iXML `USER` block (read by Soundminer, Soundly, SoundQ, BaseHead); FXName also copied to the BWF `bext` Description |
| MP3 | ID3v2.4 | One `TXXX` frame per field, description = field name |
| FLAC | Vorbis comment | One comment per field, upper-case field name as key |

The writer keeps all existing audio data and other chunks/tags untouched, and writes to a temp copy that replaces the original only after it re-reads cleanly. Field names sit in one mapping table, so a tool-specific export can be added later as a separate step without changing the tagging flow.

**Database tables (minimum):**

- `files`: path, format, duration, status (untagged / tagged), modified time
- `embeddings`: file id, 2048-d CNN14 vector stored as float32 (about 8 KB per file) in a sqlite-vec vec0 table
- `suggestions`: file id, rank 1–5, CatID, score, probe version
- `labels`: file id, CatID, FXName, CreatorID, SourceID, chosen rank (1–5 or manual), timestamp
- `ucs`: the 753 UCS v8.2.1 rows (CatID, Category, SubCategory, explanation, synonyms), loaded from `fixtures/UCS v8.2.1 Full List.xlsx`

**Training data for the probe:** the prototype ships with the existing trained probe. Retraining uses EnvSound-UCS (Beck & Lerch, 2026) and FoleySet (Wang & Lerch, 2026), plus the user's confirmed labels.

## Evaluation

Two parts; search features are not evaluated.

| Part | Setup | Metrics |
| --- | --- | --- |
| Test-set classification | Published EnvSound-UCS and FoleySet test splits, subcategory (CatID) level | Macro F1, top-1 accuracy, top-5 accuracy |
| Correction simulation | Replay the test files through the tag flow, treating the true CatID as the user's choice; optionally retrain in batches and repeat | Share of files where the true CatID is suggestion 1, in 2–5, or needs a manual pick; change after each retrain |

**Reference point:** the replicated frozen CNN14 + linear probe on EnvSound-UCS reached subcategory macro F1 0.496 ± 0.007 and accuracy 0.567 on the original test split, close to the paper's 0.49. Training without tie-broken labels raised accuracy to 0.628 on the same tie-free test rows. Top-5 accuracy has not been measured yet.

## Open items

- [x] Long files: decided. Files over 10 s are cut into 10 s windows with 50% overlap. Each window goes through CNN14 + probe, and the scores are averaged into one top-5. Files of 10 s or less are embedded whole. Expected to help long files (closer to the training clips); not yet measured.
- [x] Exact iXML / ID3 / Vorbis field names: decided. Use the open iXML USER fields that Soundminer, Soundly, SoundQ and BaseHead share, with ID3 TXXX and Vorbis fields under the same names. Test reading in Soundly and SoundQ, and check against a Soundminer-tagged file. If a tool needs different names, add a separate export step.
- [x] Rename files to the UCS pattern `CatID_FXName_CreatorID_SourceID`: in scope as an optional checkbox on Save (see Core user flow, step 5).
