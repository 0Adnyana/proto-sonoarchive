# suggestion-store Specification

## Purpose

TBD

## Requirements

### Requirement: Top-5 uses the probe's linear layer

Each CatID score SHALL be the softmax of `weight @ embedding + bias` from the probe. The weight and bias SHALL be float32 little-endian arrays. The five highest scores SHALL be kept, highest first, and equal scores SHALL keep the earlier CatID in the probe label list. The stored probe version SHALL be the version in that probe.

#### Scenario: Rank 1 is the highest score

- **WHEN** an embedding is scored with the probe
- **THEN** rank 1 is the CatID with the highest softmax score and the recorded probe version equals the probe's version

#### Scenario: An equal score keeps the earlier label

- **WHEN** two CatIDs receive the same softmax score
- **THEN** the CatID that appears earlier in the probe label list is ranked ahead of the other

### Requirement: An embedding and five suggestions can be stored

A successful write SHALL store one float32 embedding of length 2048 in a sqlite-vec vec0 table and SHALL store five suggestion rows for that file with rank, CatID, score, and probe version. The file status SHALL remain *untagged*. The decoded samples SHALL NOT be stored.

#### Scenario: A write stores one embedding and five rows

- **WHEN** a 2048-d embedding and its top-5 are written for a stored file
- **THEN** the database contains one 2048-d float32 embedding for that file and suggestion ranks 1 through 5, and the file status is *untagged*

### Requirement: Writing the same path again keeps a single file row

Writing an embedding and suggestions for a path that already has them SHALL replace that embedding and those five rows and SHALL NOT create a second file row.

#### Scenario: A second write keeps a single file row

- **WHEN** a file that already has suggestions is written again
- **THEN** the library still contains one row for that path and its stored suggestions are the new five rows

### Requirement: Clearing suggestions keeps the file

Clearing a path SHALL remove that path's embedding and suggestion rows and SHALL leave the file row in place with status *untagged*.

#### Scenario: A cleared path has no CatID

- **WHEN** suggestions for a stored file are cleared
- **THEN** the file remains in the library with status *untagged*, an empty top-1 CatID, and no suggestion rows

### Requirement: The library bridge returns the stored top-5

Each library row SHALL include the top-1 CatID and the suggestions in rank order. A file with no suggestions SHALL have an empty top-1 CatID and no suggestion entries.

#### Scenario: A listed file carries its five CatIDs

- **WHEN** the library is listed after a successful write
- **THEN** that row includes the rank-1 CatID and five suggestions in rank order from 1 to 5
