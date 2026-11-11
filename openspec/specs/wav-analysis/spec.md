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

### Requirement: A file longer than 10 seconds is analysed in windows

The inference worker SHALL analyse a stored WAV whose duration is greater than 10 seconds. It SHALL decode that file to 32 kHz mono with the bundled ffmpeg and SHALL split the waveform into 10-second windows with a hop of 5 seconds. A window SHALL be kept only when it fits completely in the waveform. Each kept window SHALL be run through CNN14 and the probe. The stored embedding SHALL be the mean of the window embeddings. The stored top-5 SHALL be taken from the mean of the per-window softmax scores. The app SHALL NOT start Python or a system ffmpeg to do this. The decoded samples SHALL NOT be stored. A 30-second file SHALL use 5 windows.

#### Scenario: A 30-second file uses five windows

- **WHEN** a stored WAV is 30 seconds long and the CNN14 model and the probe file are available
- **THEN** analysis uses 5 complete windows, each 10 seconds long, starting every 5 seconds, and the store contains one embedding and five suggestions for that file

#### Scenario: A tail shorter than one window is left out

- **WHEN** a stored WAV is longer than 10 seconds and the samples after the last complete window are shorter than 10 seconds
- **THEN** those trailing samples are not a window of their own

#### Scenario: The top-5 matches the windowed Python reference

- **WHEN** `fixtures/F-long/365091.wav` and `fixtures/F-long/41183.wav` are analysed with the bundled CNN14 model and the app probe
- **THEN** each file's top-5 CatIDs and scores match the Python reference computed with the same windowing, and the stored embedding matches the mean of that reference's window embeddings

### Requirement: Long files join the same background queue

The app SHALL analyse each stored file longer than 10 seconds that has no suggestions for the current probe version. It SHALL do this after an import and when the app opens, in the same one-file-at-a-time worker queue as short files. Closing the app before that file is stored SHALL leave it pending, and opening the app SHALL analyse it.

#### Scenario: A new long file is analysed after import

- **WHEN** a WAV longer than 10 seconds is stored and the model and the probe are available
- **THEN** that file gains an embedding and five suggestions without a second import

#### Scenario: Opening the app finishes a long file that has no suggestions

- **WHEN** the app opens with a stored WAV longer than 10 seconds that has no suggestions for the current probe version
- **THEN** that file is analysed and then listed with a top-1 CatID

#### Scenario: Quit and reopen continues the remaining files

- **WHEN** the app closes while one imported file has suggestions and another imported file still has none for the current probe version, and the app then opens
- **THEN** the finished file is not analysed again and the remaining file is analysed

### Requirement: Tagging stays available while the queue runs

A file that already has suggestions SHALL stay openable on Tag while the worker queue is still analysing other files. Saving a label for that file SHALL NOT wait for the queue to finish.

#### Scenario: A finished file can be tagged during the queue

- **WHEN** one stored file has suggestions and another stored file is still queued
- **THEN** the user can open the finished file on Tag and save a label while the queue continues

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
