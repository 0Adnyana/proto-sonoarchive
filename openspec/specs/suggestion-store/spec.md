# suggestion-store Specification

## Purpose

TBD

## Requirements

### Requirement: Top-5 uses the probe's linear layer

The probe's linear layer SHALL score an embedding as the softmax of `weight @ embedding + bias`. The weight and bias SHALL be float32 little-endian arrays. For a file analysed as one waveform, each stored CatID score SHALL be that softmax. For a file analysed as windows, each window SHALL be scored that way, those score vectors SHALL be averaged, and each stored CatID score SHALL be that average. The five highest stored scores SHALL be kept, highest first, and equal scores SHALL keep the earlier CatID in the probe label list. The stored probe version SHALL be the version in that probe. The stored embedding for a windowed file SHALL be the mean of the window embeddings and SHALL be one float32 vector of length 2048.

#### Scenario: Rank 1 is the highest score

- **WHEN** an embedding is scored with the probe
- **THEN** rank 1 is the CatID with the highest softmax score and the recorded probe version equals the probe's version

#### Scenario: An equal score keeps the earlier label

- **WHEN** two CatIDs receive the same softmax score
- **THEN** the CatID that appears earlier in the probe label list is ranked ahead of the other

#### Scenario: Window scores are averaged before the top 5

- **WHEN** a file is scored as more than one window
- **THEN** each stored score is the mean of that CatID's per-window softmax scores, and rank 1 is the CatID with the highest mean

#### Scenario: An equal mean keeps the earlier label

- **WHEN** two CatIDs have the same mean score across windows
- **THEN** the CatID that appears earlier in the probe label list is ranked ahead of the other

#### Scenario: The stored embedding is the window mean

- **WHEN** a windowed file is written
- **THEN** the database contains one 2048-d embedding equal to the mean of the window embeddings, and the file status is *untagged*

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
