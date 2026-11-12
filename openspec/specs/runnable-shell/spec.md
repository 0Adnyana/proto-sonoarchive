# runnable-shell Specification

## Purpose

TBD

## Requirements

### Requirement: Desktop shell opens one library

The desktop app SHALL open one window whose screen is the library. That screen SHALL appear after the React renderer starts. The library SHALL show the import control and the files stored by this app. The window SHALL NOT contain a tab for Library, Tag, or Search. The metadata slideover SHALL show an imported file only after that file is opened. Before a search query, the library SHALL list the stored files. After a query, the library table SHALL list a file only as a row of the current results.

#### Scenario: Renderer shows the library and no screen tabs

- **WHEN** the React renderer has started
- **THEN** it shows the library and does not contain a tab for Library, Tag, or Search

#### Scenario: The HTML document is a mount point

- **WHEN** the renderer HTML is read before the script runs
- **THEN** it contains one mount node and does not contain a tab or a panel for Library, Tag, or Search

#### Scenario: Opening a file keeps the library on screen

- **WHEN** the user opens a stored file
- **THEN** the slideover shows that file and the library table remains shown

#### Scenario: Library lists files before a search

- **WHEN** at least one file has been imported and the user has not run a search
- **THEN** the library table shows that file and the slideover shows no imported file

### Requirement: Main process can reach the worker

The main process SHALL start the inference worker as a separate process and complete a ping that returns success. The worker MAY load ONNX Runtime, the CNN14 model, and the probe in order to analyse audio. The ping SHALL succeed when those files are missing.

#### Scenario: Worker answers a ping

- **WHEN** the main process sends the shared ping message to the worker
- **THEN** the worker responds with a success payload

#### Scenario: A missing model does not fail the ping

- **WHEN** the CNN14 model or the probe file is missing and the main process sends the shared ping message
- **THEN** the worker responds with a success payload

### Requirement: Renderer cannot use Node directly

The preload script SHALL be the only bridge from the renderer to the main process. The window SHALL run with context isolation enabled and Node integration disabled. The bridge SHALL expose ping, folder import, library listing, library updates, text search, and find similar.

#### Scenario: Preload exposes the library bridge

- **WHEN** the renderer reads the bridge on `window`
- **THEN** it can call ping, import a folder, list the library, search by text, and find similar files, and it cannot require Node modules

### Requirement: Python package imports as a stub

The `sonoarchive` Python package SHALL import without machine-learning libraries installed. Calling the retrain entry point SHALL fail with `NotImplementedError`.

#### Scenario: Import succeeds

- **WHEN** the package is installed editable in a virtualenv and tests import `sonoarchive`
- **THEN** the import succeeds

#### Scenario: Retrain is not implemented

- **WHEN** code calls the retrain entry point
- **THEN** it raises `NotImplementedError`
