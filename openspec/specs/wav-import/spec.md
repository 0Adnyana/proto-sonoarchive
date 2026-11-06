# wav-import Specification

## Purpose

TBD

## Requirements

### Requirement: Import folder picks a directory

The Library screen SHALL offer an *Import folder* control that opens a directory picker. The main process SHALL own the picker. The renderer SHALL NOT receive Node file-system access.

#### Scenario: Choosing a folder starts an import

- **WHEN** the user confirms a directory in the folder picker
- **THEN** the app imports eligible files from that directory and does not import files from its subdirectories

#### Scenario: Cancelling the picker changes nothing

- **WHEN** the user dismisses the folder picker without choosing a directory
- **THEN** the stored library is unchanged

### Requirement: Only WAV files are imported

The import SHALL include files whose names end in `.wav`, regardless of case. The import SHALL ignore every other file.

#### Scenario: Mixed folder keeps WAV files

- **WHEN** the chosen folder contains WAV files and an MP3 file
- **THEN** only the WAV files are added to the library

### Requirement: Each WAV is decoded with bundled ffmpeg

Each imported WAV SHALL be decoded to the end with the bundled ffmpeg binary. The stored duration SHALL be that decoded length in seconds. The decoded samples SHALL NOT be stored. The app SHALL NOT start Python or a system ffmpeg to decode audio.

#### Scenario: Decode uses the bundled binary

- **WHEN** a WAV is imported on a machine that has no Python and no ffmpeg on `PATH`
- **THEN** decoding still completes using the ffmpeg binary shipped with the app

#### Scenario: A file that cannot be decoded is omitted

- **WHEN** a `.wav` file cannot be decoded
- **THEN** it is absent from the library and the status line names the failure

### Requirement: Each imported file is stored once as untagged

The app SHALL store one row per absolute path with the file name, format `wav`, duration in seconds, status *untagged*, and the source modified time. Importing the same path again SHALL update that row and SHALL NOT create a second row.

#### Scenario: First import records an untagged WAV

- **WHEN** a WAV is imported for the first time
- **THEN** the library contains one row for its path with format `wav`, a positive duration, and status *untagged*

#### Scenario: Importing the same path again keeps a single row

- **WHEN** a WAV that is already stored is imported again
- **THEN** the library still contains one row for that path and its status is *untagged*
