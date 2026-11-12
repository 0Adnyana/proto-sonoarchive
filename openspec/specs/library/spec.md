# library Specification

## Purpose

TBD
## Requirements
### Requirement: Library lists imported files

The Library screen SHALL show a table with one row per stored file and the columns file name, format, duration, status, and CatID, while no text-search or find-similar result is showing. Duration SHALL be shown in seconds. An untagged file SHALL show status *untagged* and its stored top-1 CatID, or an empty CatID when it has no suggestions. A tagged file SHALL show status *tagged* and the CatID stored on its label. While a text-search or find-similar result is showing, the table SHALL list those hits instead of every stored file. The metadata slideover SHALL show an imported file's name only while that file is open.

#### Scenario: Imported files appear as untagged

- **WHEN** a folder of WAV files has been imported and none of those files has suggestions
- **THEN** each stored file is listed with its name, format `wav`, duration, status *untagged*, and an empty CatID

#### Scenario: A file with suggestions shows its top-1 CatID

- **WHEN** a stored file has a rank-1 suggestion and no label
- **THEN** its CatID cell shows that CatID and its status is *untagged*

#### Scenario: A tagged file shows the chosen CatID

- **WHEN** a stored file has a label
- **THEN** its status is *tagged* and its CatID cell shows the label's CatID

#### Scenario: A query replaces the stored rows

- **WHEN** a text query has been submitted and it returned one hit
- **THEN** the table lists that hit and does not list a stored file that was not returned

### Requirement: Import results stay visible

The Library screen SHALL show a status line for the import. The window SHALL remain usable after an import, including opening and closing the metadata slideover and submitting a search.

#### Scenario: A finished import reports how many files were stored

- **WHEN** an import finishes
- **THEN** the status line reports how many files were stored

#### Scenario: The stored rows stay while a file is open

- **WHEN** the user opens a file after an import and then closes the slideover
- **THEN** the library table shows the same stored rows

### Requirement: Files survive a restart

Stored files, their suggestions, and their labels SHALL be read back from the local database when the app opens. Quitting SHALL NOT delete them.

#### Scenario: Reopen shows the same rows

- **WHEN** the user quits after WAV files have been imported, then opens the app again
- **THEN** the same files are listed with the same names, format, durations, and status *untagged*

#### Scenario: Reopen shows stored top-1 CatIDs

- **WHEN** the user quits after suggestions have been stored, then opens the app again
- **THEN** those files are listed with the same top-1 CatIDs and status *untagged*

#### Scenario: Reopen shows a saved label

- **WHEN** the user quits after a file has been tagged, then opens the app again
- **THEN** that file is listed with status *tagged*, the same chosen CatID, and the same FXName, CreatorID, SourceID, and rank

### Requirement: The UCS catalog is stored

The database SHALL contain the 753 UCS v8.2.1 rows from `fixtures/UCS v8.2.1 Full List.xlsx`, one row per CatID, with Category, SubCategory, explanation, and synonyms.

#### Scenario: Catalog has 753 CatIDs

- **WHEN** the app opens with the UCS workbook available and `ucs` is empty
- **THEN** the `ucs` table contains 753 rows and no duplicate CatIDs

#### Scenario: Opening again does not duplicate the catalog

- **WHEN** the app opens a second time with the catalog already stored
- **THEN** the `ucs` table still contains 753 rows

### Requirement: A renamed file is listed under its new name

After *Save* renames a file, the library SHALL contain one row for that file. That row SHALL use the new path and the new file name, SHALL keep the file's suggestions and embedding, and SHALL show status *tagged* with the saved CatID. The previous path SHALL NOT be listed. Quitting and opening the app SHALL list the new file name.

#### Scenario: Library shows the new name

- **WHEN** *Save* has renamed a file to its UCS filename
- **THEN** the library table shows that new file name once, with status *tagged* and the saved CatID, and does not show the previous file name

#### Scenario: Restart lists the new name

- **WHEN** the user quits after a file was renamed and then opens the app again
- **THEN** that file is listed with the new file name, status *tagged*, and the same CatID

### Requirement: Library shows analysis progress

The Library screen SHALL show a progress sentence while a background analysis queue is running and after that queue has finished in the current session. The sentence SHALL read `N / M analysed`, where M is the number of files queued and N is how many of those files the queue has finished. N SHALL increase as each file finishes, including a file whose analysis failed. The sentence SHALL reach `M / M analysed` when the queue is idle. When no file has been queued, the Library SHALL NOT show a progress sentence. The import status sentence SHALL stay on the status line.

#### Scenario: The count advances until every queued file is finished

- **WHEN** an import queues more than one file for analysis
- **THEN** the status line shows `N / M analysed` with N increasing until it shows `M / M analysed`

#### Scenario: Import and progress share the status line

- **WHEN** an import has reported how many files were stored and analysis is still running
- **THEN** the status line still reports how many files were stored and includes the progress sentence

#### Scenario: No queue leaves the progress sentence out

- **WHEN** the Library is shown and no file has been queued for analysis
- **THEN** the status line does not contain `analysed`
