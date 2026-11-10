# S4 · UCS rename

**Goal:** tick a box on Save and the file gets its UCS filename. **Builds on:** S2.

## Scope

- *Rename to UCS filename* checkbox on the Tag screen, unticked by default.
- Live preview of the new name: `CatID_FXName_CreatorID_SourceID.ext`, updated as fields change.
- On Save with the box ticked: write metadata first, then rename, then update the path in `files`.
- If a file with the new name already exists, nothing is renamed and an error is shown; the metadata is still saved.

**Not in this slice:** batch rename, UserCategory / VendorCategory / UserData blocks.

## End-to-end test

1. Tag an F-short file with the box ticked; the preview matches the fields.
2. After Save, the file on disk has the previewed name and Library shows it.
3. The renamed file still plays and still shows all six fields in Soundly.
4. Tag another file with the box unticked: its name is unchanged.
5. Tag a third file so its UCS name equals an existing file: error shown, no rename, metadata written.

## Done when

- [x] Steps 1–5 pass
