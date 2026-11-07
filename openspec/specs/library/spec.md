# library Specification

## Purpose

TBD

## Requirements

### Requirement: Library lists imported files

The Library screen SHALL show a table with one row per stored file and the columns file name, format, duration, status, and CatID. Duration SHALL be shown in seconds. CatID SHALL be the stored top-1 CatID, or empty when that file has no suggestions. Tag and Search SHALL show no imported files.

#### Scenario: Imported files appear as untagged

- **WHEN** a folder of WAV files has been imported and none of those files has suggestions
- **THEN** each stored file is listed with its name, format `wav`, duration, status *untagged*, and an empty CatID

#### Scenario: A file with suggestions shows its top-1 CatID

- **WHEN** a stored file has a rank-1 suggestion
- **THEN** its CatID cell shows that CatID and its status is *untagged*

### Requirement: Import results stay visible

The Library screen SHALL show a status line for the import. The window SHALL remain usable after an import, including switching among Library, Tag, and Search.

#### Scenario: A finished import reports how many files were stored

- **WHEN** an import finishes
- **THEN** the status line reports how many files were stored

#### Scenario: Switching tabs keeps the stored rows

- **WHEN** the user opens Tag after an import and then returns to Library
- **THEN** the Library table shows the same stored rows

### Requirement: Files survive a restart

Stored files and their suggestions SHALL be read back from the local database when the app opens. Quitting SHALL NOT delete them.

#### Scenario: Reopen shows the same rows

- **WHEN** the user quits after WAV files have been imported, then opens the app again
- **THEN** the same files are listed with the same names, format, durations, and status *untagged*

#### Scenario: Reopen shows stored top-1 CatIDs

- **WHEN** the user quits after suggestions have been stored, then opens the app again
- **THEN** those files are listed with the same top-1 CatIDs and status *untagged*

### Requirement: The UCS catalog is stored

The database SHALL contain the 753 UCS v8.2.1 rows from `fixtures/UCS v8.2.1 Full List.xlsx`, one row per CatID, with Category, SubCategory, explanation, and synonyms.

#### Scenario: Catalog has 753 CatIDs

- **WHEN** the app opens with the UCS workbook available and `ucs` is empty
- **THEN** the `ucs` table contains 753 rows and no duplicate CatIDs

#### Scenario: Opening again does not duplicate the catalog

- **WHEN** the app opens a second time with the catalog already stored
- **THEN** the `ucs` table still contains 753 rows
