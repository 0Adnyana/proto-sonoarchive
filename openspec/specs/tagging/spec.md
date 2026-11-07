# tagging Specification

## Purpose

TBD

## Requirements

### Requirement: A Library row opens on Tag

Selecting a Library row SHALL open that file on the Tag screen and SHALL show its file name. Until a row is selected, Tag SHALL show no imported file name. Search SHALL show no imported file name.

#### Scenario: Selecting a row opens the file

- **WHEN** the user selects a stored file in Library
- **THEN** the Tag screen shows that file's name

#### Scenario: Tag starts without a file

- **WHEN** the user opens Tag before selecting a row
- **THEN** Tag shows no imported file name

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

### Requirement: Save writes one label and leaves the file untouched

*Save* SHALL store one `labels` row for the open file with CatID, FXName, CreatorID, SourceID, the chosen rank, and a timestamp, and SHALL set that file's status to *tagged*. Rank SHALL be the selected suggestion's rank, from 1 to 5, or *manual* when the CatID comes from *Other…*. A later *Save* for the same file SHALL replace that row. *Save* SHALL leave the file on disk unchanged.

#### Scenario: Suggestion 2 records rank 2

- **WHEN** the user picks suggestion 2, enters FXName, CreatorID, and SourceID, and activates *Save*
- **THEN** the `labels` row stores that CatID, those three fields, rank 2, and a timestamp, the file status is *tagged*, and the file bytes on disk are unchanged

#### Scenario: Other records a manual rank

- **WHEN** the user picks a CatID from *Other…*, enters an FXName, and activates *Save*
- **THEN** the `labels` row stores rank *manual* and the file bytes on disk are unchanged

#### Scenario: A second Save replaces the row

- **WHEN** the user saves a label for a file that already has one
- **THEN** that file has one `labels` row and the row is the later save

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
