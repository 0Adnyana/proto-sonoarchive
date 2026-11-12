# search Specification

## Purpose

TBD

## Requirements

### Requirement: The library has a search field

The library SHALL show one text field with the accessible name Query. The user SHALL submit that field with Enter. Before a query is submitted, and after results are cleared, the library table SHALL list the stored files and SHALL use the columns File name, Format, Duration (seconds), Status, and CatID. Submitting a query that is empty or only spaces SHALL leave that stored-file list in place. Submitting a non-empty query SHALL list each text-search hit in the library table, in the order returned, and SHALL add the columns FXName and Similarity. For a text-search hit the Similarity cell SHALL be empty. A hit's File name, Format, Duration, and Status SHALL come from the stored library row with the same path. *Find similar to selected file* SHALL be a control in the metadata slideover and SHALL NOT be shown while that slideover is closed.

#### Scenario: The library starts as the stored files

- **WHEN** the user views the library before running a query
- **THEN** the table lists the stored files under File name, Format, Duration (seconds), Status, and CatID, and it has no Similarity column

#### Scenario: Find similar is absent with nothing open

- **WHEN** no file is open
- **THEN** *Find similar to selected file* is not shown

#### Scenario: An empty query keeps the stored files

- **WHEN** the user submits an empty field, or a field of only spaces
- **THEN** the table still lists the stored files

#### Scenario: A text query lists hits in the library table

- **WHEN** the user submits a non-empty query
- **THEN** the table's rows are the text-search hits, in the returned order, with the FXName and Similarity columns, and each Similarity cell is empty

### Requirement: Text search matches tagged fields

*Search* SHALL return each stored file whose file name contains the query as a case-insensitive substring. *Search* SHALL also return each tagged file whose CatID, Category, SubCategory, or FXName contains the query as a case-insensitive substring. Category and SubCategory SHALL be the UCS values for that label's CatID. *Search* SHALL also return each untagged file whose rank-1 suggestion CatID, or the UCS Category or SubCategory for that CatID, contains the query as a case-insensitive substring. A tagged file SHALL NOT be returned because a suggestion contains the query. The characters `%`, `_`, and `\` in the query SHALL match themselves. A row whose file name contains the query SHALL be listed before a row that matches only on CatID, Category, SubCategory, or FXName. Inside each of those groups, results SHALL be ordered by file name, then path. Each tagged row SHALL show that file's name, its label CatID, and its FXName. Each untagged row SHALL show that file's name, its rank-1 suggestion CatID or an empty CatID when it has no rank-1 suggestion, and an empty FXName. The Similarity cell SHALL be empty. The text-search operation SHALL return no rows for an empty query, including a query of only spaces. The library SHALL NOT submit that empty query in place of the stored file list.

#### Scenario: A word from FXName returns that file

- **WHEN** tagged files have distinct FXNames and the user searches for a word that appears in one FXName and in no file name, other label field, or rank-1 suggestion field
- **THEN** that file is the only row, with its CatID and FXName, and its Similarity cell is empty

#### Scenario: A category name returns tagged and untagged files in that category

- **WHEN** the user searches for a Category name that appears in no file name
- **THEN** every tagged file whose label CatID is in that category is returned, every untagged file whose rank-1 CatID is in that category is returned, and no other file is returned

#### Scenario: An untagged rank-1 CatID returns that file

- **WHEN** an untagged file's rank-1 CatID contains the query and no other searched field matches
- **THEN** that file is the only row, with that CatID, an empty FXName, and an empty Similarity cell

#### Scenario: A file name returns that file

- **WHEN** the query appears in one stored file's name and in no other file's name, label field, or rank-1 suggestion field
- **THEN** that file is the only row, with its label CatID and FXName when it is tagged, its rank-1 CatID and an empty FXName when it is untagged, or an empty CatID and an empty FXName when it has no rank-1 suggestion, and its Similarity cell is empty

#### Scenario: A file-name match is listed first

- **WHEN** one file's name contains the query and another file matches only on a label field or a rank-1 suggestion field
- **THEN** the file whose name contains the query is the first row

#### Scenario: A lower-rank suggestion is left out

- **WHEN** the query appears in an untagged file's rank 2 CatID and in no file name, rank-1 suggestion field, or label field
- **THEN** the table shows no file name

#### Scenario: Tagged and untagged matches share one list

- **WHEN** one tagged file and one untagged file both match on the same kind of field and the untagged file's name sorts first
- **THEN** the untagged file is the first row and the tagged file is the second row

#### Scenario: An empty query returns nothing

- **WHEN** text search is invoked with an empty query, or a query of only spaces
- **THEN** the operation returns no rows

### Requirement: Find similar uses cosine distance

*Find similar to selected file* SHALL run a cosine-distance query in sqlite-vec over the stored embeddings and SHALL list matches closest first. The selected file SHALL be the file open in the metadata slideover, and that file SHALL be excluded. A file with no stored embedding SHALL NOT be returned. Each row SHALL show the file name, the label CatID when the file is tagged and otherwise the rank-1 suggestion CatID, the label FXName when the file is tagged and otherwise an empty FXName, and the cosine similarity. Those rows SHALL replace the library table until the user clears the results or submits a text query. On the stored F-short embeddings the query SHALL return within 1 second.

#### Scenario: The twin is in the top 3

- **WHEN** the user finds similar for one file of an F-short pair that shares a subcategory
- **THEN** the other file of that pair is among the first three rows and the selected file is not a row

#### Scenario: A nearer embedding is listed first

- **WHEN** other stored files include one whose embedding is nearer in cosine distance than the rest
- **THEN** that nearer file is the first row and the selected file is not a row

#### Scenario: F-short returns within a second

- **WHEN** find similar runs against the stored F-short embeddings
- **THEN** the rows are returned within 1 second

#### Scenario: Find similar replaces the library rows

- **WHEN** the user activates *Find similar to selected file* for the open file
- **THEN** the library table lists those hits, including a Similarity column, and the open file is not a row

### Requirement: Clearing results restores the library

While the table is showing text-search hits or find-similar hits, the library SHALL show a control that clears those results. Activating it SHALL list the stored files again, SHALL remove the FXName and Similarity columns, and SHALL leave the open slideover as it is.

#### Scenario: Clear returns the stored files

- **WHEN** hits are listed and the user clears the results
- **THEN** the table lists the stored files and has no Similarity column

#### Scenario: Clear leaves the open file open

- **WHEN** a file is open in the slideover and the user clears the results
- **THEN** the slideover still shows that file's name

### Requirement: A result opens in the slideover

Clicking a hit SHALL open that file in the metadata slideover and SHALL show its file name. The library table SHALL stay in the document.

#### Scenario: A click opens the file beside the list

- **WHEN** the user clicks a hit
- **THEN** the slideover shows that file's name and the library table is still shown

### Requirement: A failed query is reported on the library

When a text query or a find-similar query fails, the library status line SHALL include the failure message and the table SHALL show no file name. The failure message SHALL NOT remove an import result or a progress sentence already on that status line.

#### Scenario: The bridge rejects the query

- **WHEN** text search fails
- **THEN** the status line includes the failure message and the table shows no file name

#### Scenario: A failure keeps the import result

- **WHEN** the status line already reports how many files were stored and text search then fails
- **THEN** the status line still reports how many files were stored and includes the failure message
