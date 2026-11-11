# tagging Specification

## Purpose

TBD
## Requirements
### Requirement: A Library row opens on Tag

Selecting a Library row or a search result SHALL open that file on the Tag screen and SHALL show its file name. Until a file is opened, Tag SHALL show no imported file name. Before a search query, Search SHALL show no imported file name.

#### Scenario: Selecting a row opens the file

- **WHEN** the user selects a stored file in Library
- **THEN** the Tag screen shows that file's name

#### Scenario: Tag starts without a file

- **WHEN** the user opens Tag before selecting a row
- **THEN** Tag shows no imported file name

#### Scenario: A search result opens the file

- **WHEN** the user clicks a search result
- **THEN** the Tag screen shows that file's name

### Requirement: Play and Stop use the stored file

*Play/Stop* SHALL play the open file from its stored path. Playback SHALL use that file as stored and SHALL leave its bytes unchanged. While audio is playing the control SHALL read *Stop*. Activating *Stop* SHALL end playback and return to the start, and the control SHALL read *Play*. With no file open the control SHALL be disabled.

#### Scenario: Play starts the open file

- **WHEN** a file is open and the user activates *Play*
- **THEN** playback of that file starts and the control reads *Stop*

#### Scenario: Stop ends playback

- **WHEN** the open file is playing and the user activates *Stop*
- **THEN** playback ends at the start and the control reads *Play*

### Requirement: Five suggestions are a radio list

When the open file has five suggestions, Tag SHALL show them as a radio list in rank order, highest score first. Each option SHALL show its CatID, its Category › SubCategory from the UCS catalog, and its score.

#### Scenario: The list follows stored rank

- **WHEN** the open file has suggestion ranks 1 through 5
- **THEN** Tag shows five radio options in that order, each with its CatID, Category › SubCategory, and score

### Requirement: Other lists every CatID

*Other…* SHALL list all 753 UCS v8.2.1 CatIDs. Choosing one SHALL make that CatID the selection and SHALL clear the radio list. Choosing a radio option afterwards SHALL clear *Other…*.

#### Scenario: A catalog pick replaces the radios

- **WHEN** the user picks a CatID from *Other…*
- **THEN** that CatID is selected and none of the five radios is selected

#### Scenario: A radio pick clears Other

- **WHEN** a catalog CatID is selected and the user then picks suggestion 2
- **THEN** suggestion 2 is selected and *Other…* has no selection

### Requirement: Save waits for a CatID and an FXName

Tag SHALL show text inputs for FXName, CreatorID, and SourceID. *Save* SHALL be disabled until a CatID is selected and FXName is not empty after trimming whitespace. *Save* SHALL be enabled when those two are set, including when CreatorID or SourceID is empty.

#### Scenario: An empty FXName disables Save

- **WHEN** a CatID is selected and FXName is empty
- **THEN** *Save* is disabled

#### Scenario: Blank FXName stays disabled

- **WHEN** a CatID is selected and FXName contains only spaces
- **THEN** *Save* is disabled

#### Scenario: CatID and FXName enable Save

- **WHEN** a CatID is selected, FXName is not empty, and CreatorID and SourceID are empty
- **THEN** *Save* is enabled

### Requirement: Save writes one label and the WAV

*Save* SHALL write the open WAV's metadata before it stores a label. After that write succeeds, *Save* SHALL store one `labels` row for the open file with CatID, FXName, CreatorID, SourceID, the chosen rank, and a timestamp, and SHALL set that file's status to *tagged*. Rank SHALL be the selected suggestion's rank, from 1 to 5, or *manual* when the CatID comes from *Other…*. A later *Save* for the same file SHALL replace that row and write the WAV again. If the WAV write fails, *Save* SHALL leave the `labels` row and the file status as they were, SHALL leave the original file bytes unchanged, and Tag SHALL show the error.

#### Scenario: Suggestion 2 records rank 2

- **WHEN** the user picks suggestion 2, enters FXName, CreatorID, and SourceID, and activates *Save*
- **THEN** the WAV metadata write succeeds, the `labels` row stores that CatID, those three fields, rank 2, and a timestamp, and the file status is *tagged*

#### Scenario: Other records a manual rank

- **WHEN** the user picks a CatID from *Other…*, enters an FXName, and activates *Save*
- **THEN** the `labels` row stores rank *manual* and the WAV metadata write has succeeded

#### Scenario: A second Save replaces the row

- **WHEN** the user saves a label for a file that already has one
- **THEN** that file has one `labels` row and the row is the later save

#### Scenario: A failed write leaves the label and the file

- **WHEN** the open WAV cannot be replaced and the user activates *Save*
- **THEN** the `labels` row and the file status stay as they were, the original file bytes are unchanged, and Tag shows an error

### Requirement: Next file opens the next untagged file

*Next file* SHALL open the next *untagged* file after the current one in Library order. Library order SHALL be file name, case-insensitive, then path. A *tagged* file SHALL be skipped. When no untagged file follows, *Next file* SHALL wrap to the first untagged file. When no other untagged file exists, the open file SHALL stay as it is.

#### Scenario: The following untagged file opens

- **WHEN** the open file is followed in Library order by an untagged file and the user activates *Next file*
- **THEN** Tag shows that following file

#### Scenario: A tagged row is skipped

- **WHEN** the next Library row is tagged and a later row is untagged
- **THEN** *Next file* opens the later untagged file

#### Scenario: The only untagged file stays open

- **WHEN** the open file is the only untagged file and the user activates *Next file*
- **THEN** Tag still shows that file

### Requirement: An existing label fills the form

Opening a file that already has a label SHALL select its CatID and fill FXName, CreatorID, and SourceID. A rank from 1 to 5 SHALL select that radio when the suggestion is still present. Rank *manual* SHALL select *Other…*.

#### Scenario: Rank 2 is selected again

- **WHEN** the user opens a file whose saved rank is 2 and suggestion 2 is still present
- **THEN** suggestion 2 is selected and the three fields show the saved values

#### Scenario: A manual label selects Other

- **WHEN** the user opens a file whose saved rank is *manual*
- **THEN** *Other…* shows the saved CatID and the three fields show the saved values

### Requirement: Rename to UCS filename starts unticked

When a file is open, Tag SHALL show a checkbox named *Rename to UCS filename*. The checkbox SHALL be unticked when that file is opened. Opening a file that already has a label SHALL also leave the checkbox unticked.

#### Scenario: A newly opened file is unticked

- **WHEN** the user opens a file on Tag
- **THEN** *Rename to UCS filename* is shown and is unticked

#### Scenario: A tagged file opens unticked

- **WHEN** the user opens a file that already has a label
- **THEN** *Rename to UCS filename* is unticked

### Requirement: The preview is the UCS filename

While a file is open, Tag SHALL show the preview basename `CatID_FXName_CreatorID_SourceID` plus that file's current extension. CatID, FXName, CreatorID, and SourceID in that basename SHALL be the current field values with surrounding whitespace removed. An empty CreatorID or SourceID SHALL still occupy its place, so both empty values end the basename with `__` before the extension. The preview SHALL change when the selected CatID or any of the three text fields changes. The extension SHALL be the extension on the stored path, including its current case.

#### Scenario: The preview matches the fields

- **WHEN** a `.wav` file is open, a CatID is selected, and FXName, CreatorID, and SourceID are filled
- **THEN** the preview is `CatID_FXName_CreatorID_SourceID.wav` using those current values

#### Scenario: Empty ids stay in the name

- **WHEN** a CatID and an FXName are set and CreatorID and SourceID are empty
- **THEN** the preview ends with `__` before the extension

#### Scenario: Editing a field updates the preview

- **WHEN** the preview is showing and the user changes FXName
- **THEN** the preview uses the new FXName and the same CatID, CreatorID, SourceID, and extension

### Requirement: A ticked Save renames after the metadata write

When *Rename to UCS filename* is ticked and the previewed path is different from the open file's path, *Save* SHALL write the WAV metadata first. After that write succeeds, *Save* SHALL rename the file in its current directory to the previewed basename, then store the `labels` row and the file row at the new path. The file's suggestions and embedding SHALL remain on that row. Tag SHALL stay on the renamed file and SHALL show its new name. Playback SHALL use the new path. The renamed file SHALL contain the six saved metadata fields.

#### Scenario: Save renames to the preview

- **WHEN** the user ticks *Rename to UCS filename*, sets a CatID and the three text fields, and activates *Save*
- **THEN** the file on disk has the previewed name, the library row uses that name and path, and the previous filename is gone

#### Scenario: The renamed file keeps its tags and plays

- **WHEN** a file has been renamed by *Save*
- **THEN** reading the file back shows the saved CatID, Category, SubCategory, FXName, CreatorID, and SourceID, and *Play* uses the new path

#### Scenario: Tag stays on the renamed file

- **WHEN** *Save* renames the open file
- **THEN** Tag shows the new file name

### Requirement: An unticked Save keeps the filename

When *Rename to UCS filename* is unticked, *Save* SHALL write the WAV metadata and the `labels` row and SHALL leave the file's name and path unchanged.

#### Scenario: The filename survives an unticked Save

- **WHEN** the user leaves *Rename to UCS filename* unticked and activates *Save*
- **THEN** the metadata and the label are stored and the filename is the same as before *Save*

### Requirement: A taken UCS name is not used

When *Rename to UCS filename* is ticked and a different file already has the previewed name, *Save* SHALL write the WAV metadata and the `labels` row on the original path, SHALL NOT rename the file, and Tag SHALL show an error. The original filename SHALL remain. When the previewed path is the open file's current path, *Save* SHALL write the metadata and the label, SHALL NOT show that error, and SHALL leave the filename as it is.

#### Scenario: An existing file blocks the rename

- **WHEN** the user ticks *Rename to UCS filename* and the previewed name is already another file in the same directory
- **THEN** Tag shows an error, the original filename remains, and the original file has the saved metadata and a label

#### Scenario: The current name is not a collision

- **WHEN** the user ticks *Rename to UCS filename* and the previewed path is the open file's current path
- **THEN** *Save* succeeds, no collision error is shown, and the filename is unchanged

