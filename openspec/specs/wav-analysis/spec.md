# wav-analysis Specification

## Purpose

TBD

## Requirements

### Requirement: The worker analyses a short WAV

The inference worker SHALL decode a stored WAV whose duration is 10 seconds or less to 32 kHz mono with the bundled ffmpeg, run that waveform through the CNN14 ONNX model, and score the app probe. The app SHALL NOT start Python or a system ffmpeg to do this. The decoded samples SHALL NOT be stored. A successful analysis SHALL write one 2048-d embedding and five suggestion rows through the suggestion store.

#### Scenario: A short file produces an embedding and five CatIDs

- **WHEN** a stored WAV has a duration of 10 seconds or less and the CNN14 model and the probe file are available
- **THEN** the store contains one 2048-d embedding and five CatIDs with scores for that file

#### Scenario: Analysis uses the bundled binary

- **WHEN** a short WAV is analysed on a machine that has no Python and no ffmpeg on `PATH`
- **THEN** analysis still completes using the ffmpeg binary shipped with the app

#### Scenario: A file of exactly 10 seconds is analysed whole

- **WHEN** a stored WAV has a duration of 10 seconds and the model and the probe are available
- **THEN** the file is analysed as one waveform and the store contains one embedding and five suggestions

### Requirement: Files longer than 10 seconds are not analysed

The app SHALL NOT run CNN14 for a stored WAV whose duration is greater than 10 seconds. That file SHALL have no suggestions. Re-importing a path as a file longer than 10 seconds SHALL clear any embedding and suggestions already stored for that path.

#### Scenario: A long file has no CatID

- **WHEN** a stored WAV has a duration greater than 10 seconds
- **THEN** the app does not analyse it and the library row has an empty top-1 CatID and no suggestions

#### Scenario: A path that becomes longer loses its suggestions

- **WHEN** a path that already has suggestions is imported again with a duration greater than 10 seconds
- **THEN** the file remains stored with status *untagged* and its embedding and suggestions are gone

### Requirement: Short files are analysed after import and at startup

The app SHALL analyse each stored file of 10 seconds or less that has no suggestions for the current probe version. It SHALL do this after an import and when the app opens. Files SHALL be analysed one at a time.

#### Scenario: A new short file is analysed after import

- **WHEN** a WAV of 10 seconds or less is stored and the model and the probe are available
- **THEN** that file gains an embedding and five suggestions without a second import

#### Scenario: Opening the app finishes a short file that has no suggestions

- **WHEN** the app opens with a stored WAV of 10 seconds or less that has no suggestions for the current probe version
- **THEN** that file is analysed and then listed with a top-1 CatID

### Requirement: A failed analysis keeps the file

When the CNN14 model or the probe file is missing, or the analysis decode fails, the file SHALL remain stored with status *untagged*. The failure SHALL be reported. No new suggestions SHALL be written for that file.

#### Scenario: A missing model leaves the row untagged

- **WHEN** analysis runs and the CNN14 model or the probe file is missing
- **THEN** the file remains in the library with status *untagged* and no new suggestions, and the failure is reported

### Requirement: Analysis leaves the window usable

Analysis SHALL run in the worker. The user SHALL be able to switch among Library, Tag, and Search while analysis is running.

#### Scenario: Tabs still switch during analysis

- **WHEN** analysis is running
- **THEN** the user can open Tag and Search and return to Library
