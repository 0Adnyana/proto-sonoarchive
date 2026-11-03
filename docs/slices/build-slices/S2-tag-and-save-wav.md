# S2 · Tag and save WAV

**Goal:** confirm a label for a WAV and find the tags inside the file in Soundly and SoundQ. **Builds on:** S1.

## Scope

- Tag screen: file name, *Play/Stop*, radio list of 5 suggestions (CatID, Category › SubCategory, score), *Other…* dropdown with all 453 CatIDs, inputs for FXName, CreatorID, SourceID, *Save* and *Next file*.
- *Save* is disabled until a CatID is chosen and FXName is not empty.
- `labels` table: CatID, FXName, CreatorID, SourceID, chosen rank (1–5 or manual), timestamp. File status becomes *tagged*.
- WAV writer: one tag per field in the iXML USER block; FXName also in the bext Description. Category and SubCategory come from the `ucs` table.
- Field names come from one mapping table.
- Writes go to a temp copy that replaces the original only after it re-reads cleanly.

**Not in this slice:** MP3/FLAC, rename, search, retraining.

## End-to-end test

1. Open an F-short file in Tag, play it, pick suggestion 2, fill all three fields, Save.
2. Library shows the file as *tagged* with the chosen CatID.
3. Open the file in Soundly and in SoundQ: CatID, Category, SubCategory, FXName, CreatorID and SourceID are visible.
4. The iXML USER field names match F-sm.
5. The audio data chunk is byte-identical before and after Save (hash).
6. The `labels` row records rank 2. Repeat with *Other…*: rank is *manual*.
7. With FXName empty, *Save* is disabled.
8. *Next file* opens the next untagged file.

## Done when

- [ ] Steps 1–8 pass
- [ ] A failed write (e.g. read-only file) leaves the original untouched and shows an error
