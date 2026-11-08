# wav-metadata Specification

## Purpose

TBD

## Requirements

### Requirement: Field names come from one mapping table

The six metadata fields SHALL be CatID, Category, SubCategory, FXName, CreatorID, and SourceID. Their iXML `USER` element names SHALL come from one mapping table, in that order.

#### Scenario: The table lists the six names

- **WHEN** the mapping table is read
- **THEN** the names are CatID, Category, SubCategory, FXName, CreatorID, and SourceID, in that order

### Requirement: One iXML USER tag per field

A successful WAV save SHALL write each of the six values as the text of its `USER` element. Category and SubCategory SHALL be the `ucs` values for the chosen CatID. FXName, CreatorID, and SourceID SHALL be the trimmed values from the form. A missing `iXML` chunk SHALL be added. An existing `iXML` chunk SHALL be updated so that each mapped name has the new text. `USER` children outside the six names, and the rest of the `iXML` document, SHALL stay. The re-read value of a field SHALL be the saved text, including characters that XML must escape.

#### Scenario: The six values land in USER

- **WHEN** the user saves a CatID with FXName, CreatorID, and SourceID
- **THEN** the `USER` block has that CatID, the `ucs` Category and SubCategory for that CatID, and the trimmed FXName, CreatorID, and SourceID

#### Scenario: An empty CreatorID is still a tag

- **WHEN** the user saves a CatID and an FXName with CreatorID and SourceID empty
- **THEN** the `USER` block has empty CreatorID and SourceID elements

#### Scenario: A second save updates the same tags

- **WHEN** the user saves a different CatID and FXName on a WAV that already has these `USER` tags
- **THEN** the file has one `iXML` chunk and the `USER` values are the later save

#### Scenario: Another USER field stays

- **WHEN** the WAV already has a `USER` child that is not one of the six fields
- **THEN** that child is still present after Save

#### Scenario: An ampersand round-trips

- **WHEN** the user saves an FXName that contains `&`
- **THEN** the re-read `USER` FXName is that same text

### Requirement: FXName is copied to the bext Description

A successful WAV save SHALL write FXName into the `bext` Description. The Description SHALL be the first 256 bytes of the `bext` payload, NUL-terminated. When FXName fits, the Description SHALL read back as the full trimmed FXName. When FXName does not fit, the `USER` FXName SHALL keep the full trimmed string and the Description SHALL keep the longest prefix that fits. An existing `bext` payload beyond the Description SHALL stay byte-identical. A missing `bext` chunk SHALL be added with that Description.

#### Scenario: Description matches FXName

- **WHEN** the user saves an FXName that fits in the Description
- **THEN** the `bext` Description reads back as that FXName

#### Scenario: A long FXName stays whole in iXML

- **WHEN** the user saves an FXName that does not fit in 256 bytes
- **THEN** the `USER` FXName is the full string and the Description is its NUL-terminated prefix

#### Scenario: The rest of bext stays

- **WHEN** the WAV already has a `bext` chunk longer than 256 bytes
- **THEN** the payload after the Description is byte-identical after Save

### Requirement: The audio chunk stays byte-identical

A successful WAV save SHALL leave every `data` chunk byte-identical, including its chunk id, size, and payload. Every chunk this save does not edit SHALL stay byte-identical.

#### Scenario: The data chunk hash matches

- **WHEN** the user saves a label on a WAV
- **THEN** a hash of each `data` chunk equals the hash from before Save

### Requirement: Replace only after a clean re-read

The writer SHALL write a temp copy in the same directory as the original and SHALL replace the original only after re-reading that copy. The re-read SHALL show the six saved `USER` values, the Description that was written, and the same `data` chunk bytes. The temp file SHALL be gone after a successful replace and after a failed write.

#### Scenario: A clean copy replaces the original

- **WHEN** the temp copy re-reads with the saved values and the same `data` chunk
- **THEN** the original path contains that copy and no temp file remains

#### Scenario: A bad re-read leaves the original

- **WHEN** the temp copy does not re-read cleanly
- **THEN** the original bytes are unchanged and no temp file remains

### Requirement: A failed write leaves the original untouched

If the original is not writable, or the write fails before replace, the original file bytes SHALL stay as they were and no temp file SHALL remain.

#### Scenario: A read-only file is unchanged

- **WHEN** the original WAV is read-only and Save runs
- **THEN** the original bytes are unchanged and no temp file remains
