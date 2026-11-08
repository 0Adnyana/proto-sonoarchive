# S2 · Tag and save WAV

**Goal:** confirm a label for a WAV and find the tags inside the file in Soundly. **Builds on:** S1.

## Scope

- Tag screen: file name, _Play/Stop_, radio list of 5 suggestions (CatID, Category › SubCategory, score), _Other…_ dropdown with all 753 CatIDs, inputs for FXName, CreatorID, SourceID, _Save_ and _Next file_.
- _Save_ is disabled until a CatID is chosen and FXName is not empty.
- `labels` table: CatID, FXName, CreatorID, SourceID, chosen rank (1–5 or manual), timestamp. File status becomes _tagged_.
- WAV writer: one tag per field in the iXML USER block; FXName also in the bext Description. Category and SubCategory come from the `ucs` table.
- Field names come from one mapping table.
- Writes go to a temp copy that replaces the original only after it re-reads cleanly.

**Not in this slice:** MP3/FLAC, rename, search, retraining, SoundQ, Soundminer.

## End-to-end test

1. Open an F-short file in Tag, play it, pick suggestion 2, fill all three fields, Save.
2. Library shows the file as _tagged_ with the chosen CatID.
3. Open the file in Soundly: CatID, Category, SubCategory, FXName, CreatorID and SourceID are visible.
4. The audio data chunk is byte-identical before and after Save (hash).
5. The `labels` row records rank 2. Repeat with _Other…_: rank is _manual_.
6. With FXName empty, _Save_ is disabled.
7. _Next file_ opens the next untagged file.

## Done when

- [x] Steps 1–7 pass
- [x] A failed write (e.g. read-only file) leaves the original untouched and shows an error
