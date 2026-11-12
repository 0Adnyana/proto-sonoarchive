# renderer-ui Specification

## Purpose

TBD
## Requirements
### Requirement: Renderer is a React application

The desktop renderer SHALL mount one React root into a single mount node. The HTML document, before the script runs, SHALL NOT contain the library table, the search field, or the metadata slideover. After the root renders, the document SHALL contain the library and its search field, and SHALL NOT contain a tab for Library, Tag, or Search. The metadata slideover SHALL stay closed until a file is opened.

#### Scenario: Static document is only a mount point

- **WHEN** the renderer HTML is read before the script runs
- **THEN** it contains one mount node and no library table, search field, or metadata slideover

#### Scenario: Started renderer is the library

- **WHEN** the React renderer has started
- **THEN** the document contains the library and its search field, and it does not contain a tab for Library, Tag, or Search

### Requirement: Shell and Library use the shared component set

The repository SHALL install shadcn for the renderer and SHALL include its button, sheet, table, input, label, radio-group, select, and checkbox components under the renderer source. The *Import folder* control and the library table SHALL be rendered with those components. The library search field SHALL be rendered with the input component. The metadata slideover SHALL be rendered with the sheet component. The slideover's *Play/Stop*, suggestion radios, *Other…* list, text fields, *Rename to UCS filename* checkbox, *Save*, *Next file*, and *Find similar to selected file* SHALL be rendered with those components. The main process, preload, and worker SHALL NOT import React.

#### Scenario: Shared components exist in the renderer

- **WHEN** a developer lists the renderer component directory after install
- **THEN** the shadcn button, sheet, table, input, label, radio-group, select, and checkbox components are present

#### Scenario: Import, search, and the file table are on the library

- **WHEN** the library is shown and no search results are showing
- **THEN** it shows an *Import folder* control, a search field, and a table whose headers are File name, Format, Duration (seconds), Status, and CatID

### Requirement: Library view follows the preload bridge

The Library view SHALL load files through the preload bridge, SHALL start an import only through that bridge, and SHALL replace its rows when the bridge reports a library change. Cancelling the picker SHALL leave the rows and the status line unchanged. A bridge failure SHALL be shown on the status line. Before a search query, the library table SHALL list the stored files. After a query, the library table SHALL list a file name only for a row of the current results. The metadata slideover SHALL show an imported file's name only while that file is open.

#### Scenario: Stored files appear on start

- **WHEN** the view starts and the bridge lists one stored WAV
- **THEN** the table shows that file's name, format `wav`, duration in seconds, and status *untagged*

#### Scenario: A finished import reports how many files were stored

- **WHEN** an import finishes with stored files and one decode failure
- **THEN** the status line reports how many files were stored and names the file that failed

#### Scenario: Cancelling the picker changes nothing

- **WHEN** the user activates *Import folder* and the bridge returns no folder
- **THEN** the status line stays empty and the listed rows stay as they were

#### Scenario: Opening a file keeps the stored rows

- **WHEN** the user opens a listed file and then closes the slideover, without running a search
- **THEN** the library table shows the same rows

#### Scenario: An open file is named in the slideover

- **WHEN** the user selects a listed file and no search results are shown
- **THEN** the slideover shows that file's name and the library table still lists the stored files

#### Scenario: A database failure is shown on the status line

- **WHEN** listing the library fails
- **THEN** the status line includes the failure message

### Requirement: Library view shows the top-1 CatID from the bridge

The Library table SHALL show each untagged row's top-1 CatID from the preload bridge. The CatID cell SHALL be empty when that row has no suggestions, and its status SHALL be *untagged*. A tagged row SHALL show status *tagged* and the CatID from its saved label.

#### Scenario: A suggestion fills the CatID cell

- **WHEN** the bridge lists an untagged file whose top-1 CatID is present
- **THEN** the CatID cell shows that CatID and the status cell is *untagged*

#### Scenario: No suggestion leaves the CatID cell empty

- **WHEN** the bridge lists an untagged file with no suggestions
- **THEN** the CatID cell is empty and the status cell is *untagged*

#### Scenario: A label fills the CatID cell

- **WHEN** the bridge lists a tagged file
- **THEN** the CatID cell shows the label's CatID and the status cell is *tagged*

### Requirement: An analysis failure stays on the status line with the import result

The Library view SHALL show an analysis failure on the status line. That message SHALL NOT remove an import result already shown on the status line.

#### Scenario: A failure follows a finished import

- **WHEN** the status line already reports how many files were stored and analysis then fails
- **THEN** the status line still reports how many files were stored and includes the analysis failure

### Requirement: Library view renders analysis progress from the bridge

The Library view SHALL listen for analysis progress on the preload bridge. It SHALL show the progress sentence `N / M analysed` on the Library status line. A newer progress report SHALL replace the previous progress sentence. The import result and any analysis failure SHALL remain on that status line. Progress SHALL update while a file's slideover is open, and SHALL stay visible on the library status line.

#### Scenario: A progress report updates the status line

- **WHEN** the bridge reports that 1 of 2 queued files has finished and the status line already says how many files were stored
- **THEN** the status line still reports how many files were stored and includes `1 / 2 analysed`

#### Scenario: The next report replaces the count

- **WHEN** the status line includes `1 / 2 analysed` and the bridge then reports that 2 of 2 queued files have finished
- **THEN** the status line includes `2 / 2 analysed` and does not include `1 / 2 analysed`

#### Scenario: A failure stays beside the count

- **WHEN** the status line includes a progress sentence and an analysis failure is reported
- **THEN** the status line still includes the progress sentence and includes the analysis failure

#### Scenario: The count stays visible with a file open

- **WHEN** the bridge reports progress while a file's slideover is open
- **THEN** the library status line shows the latest `N / M analysed` sentence

### Requirement: The metadata slideover leaves the library usable

The slideover SHALL open from the right when a file is open. It SHALL NOT block the library table, the search field, or *Import folder*. Choosing another library row or search hit SHALL show that file in the same slideover. Closing the slideover SHALL clear the open file and SHALL leave the listed rows unchanged.

#### Scenario: Another row replaces the open file

- **WHEN** a file is open and the user selects a different library row
- **THEN** the slideover shows the newly selected file's name and the library table remains shown

#### Scenario: The search field works while a file is open

- **WHEN** a file is open and the user submits a query
- **THEN** the library table shows that query's hits and the slideover stays open
