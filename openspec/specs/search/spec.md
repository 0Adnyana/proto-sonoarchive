# search Specification

## Purpose

TBD

## Requirements

### Requirement: Search screen starts empty

The Search screen SHALL show a text input, a *Search* button, a *Find similar to selected file* button, and a results table whose columns are File, CatID, FXName, and Similarity. Before any query, that table SHALL show no file name. *Find similar to selected file* SHALL be disabled when no file is open.

#### Scenario: Search starts with no rows

- **WHEN** the user opens Search before running a query
- **THEN** the table shows the columns File, CatID, FXName, and Similarity, and it shows no file name

#### Scenario: Find similar is disabled with nothing open

- **WHEN** no file is open and the user views Search
- **THEN** *Find similar to selected file* is disabled

### Requirement: Text search matches tagged fields

*Search* SHALL return each stored file whose file name contains the query as a case-insensitive substring. *Search* SHALL also return each tagged file whose CatID, Category, SubCategory, or FXName contains the query as a case-insensitive substring. Category and SubCategory SHALL be the UCS values for that label's CatID. *Search* SHALL also return each untagged file whose rank-1 suggestion CatID, or the UCS Category or SubCategory for that CatID, contains the query as a case-insensitive substring. A tagged file SHALL NOT be returned because a suggestion contains the query. The characters `%`, `_`, and `\` in the query SHALL match themselves. A row whose file name contains the query SHALL be listed before a row that matches only on CatID, Category, SubCategory, or FXName. Inside each of those groups, results SHALL be ordered by file name, then path. Each tagged row SHALL show that file's name, its label CatID, and its FXName. Each untagged row SHALL show that file's name, its rank-1 suggestion CatID or an empty CatID when it has no rank-1 suggestion, and an empty FXName. The Similarity cell SHALL be empty. An empty query, including a query of only spaces, SHALL return no rows.

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

- **WHEN** the user searches with an empty input, or an input of only spaces
- **THEN** the table shows no file name

### Requirement: Find similar uses cosine distance

*Find similar to selected file* SHALL run a cosine-distance query in sqlite-vec over the stored embeddings and SHALL list matches closest first. The selected file SHALL be the file open on Tag, and that file SHALL be excluded. A file with no stored embedding SHALL NOT be returned. Each row SHALL show the file name, the label CatID when the file is tagged and otherwise the rank-1 suggestion CatID, the label FXName when the file is tagged and otherwise an empty FXName, and the cosine similarity. On the stored F-short embeddings the query SHALL return within 1 second.

#### Scenario: The twin is in the top 3

- **WHEN** the user finds similar for one file of an F-short pair that shares a subcategory
- **THEN** the other file of that pair is among the first three rows and the selected file is not a row

#### Scenario: A nearer embedding is listed first

- **WHEN** other stored files include one whose embedding is nearer in cosine distance than the rest
- **THEN** that nearer file is the first row and the selected file is not a row

#### Scenario: F-short returns within a second

- **WHEN** find similar runs against the stored F-short embeddings
- **THEN** the rows are returned within 1 second

### Requirement: A result opens on Tag

Clicking a result row SHALL open that file on the Tag screen and SHALL show its file name.

#### Scenario: A click leaves Search for Tag

- **WHEN** the user clicks a result row
- **THEN** the Tag screen shows that file's name

### Requirement: A failed query is reported on Search

When a query fails, Search SHALL show the failure message and SHALL show no file name.

#### Scenario: The bridge rejects the query

- **WHEN** *Search* fails
- **THEN** Search shows the failure message and shows no file name
