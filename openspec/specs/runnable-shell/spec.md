# runnable-shell Specification

## Purpose

TBD

## Requirements

### Requirement: Desktop shell opens three empty screens

The desktop app SHALL open one window with three screens named Library, Tag, and Search. Each screen SHALL be selectable from a tab. The Library screen SHALL show the import control and the files stored by this app. The Tag and Search screens SHALL show no imported files.

#### Scenario: Renderer lists the three screens

- **WHEN** the renderer HTML is loaded
- **THEN** it contains a tab and a panel for Library, a tab and a panel for Tag, and a tab and a panel for Search

#### Scenario: Selecting a tab shows that screen

- **WHEN** the user selects the Tag tab
- **THEN** the Tag panel is visible and the Library and Search panels are hidden

#### Scenario: Library can list files while the other screens stay empty

- **WHEN** at least one file has been imported
- **THEN** the Library panel shows that file and the Tag and Search panels still show no imported files

### Requirement: Main process can reach the worker

The main process SHALL start the inference worker as a separate process and complete a ping that returns success, without loading a model.

#### Scenario: Worker answers a ping

- **WHEN** the main process sends the shared ping message to the worker
- **THEN** the worker responds with a success payload and does not load ONNX Runtime or a model file

### Requirement: Renderer cannot use Node directly

The preload script SHALL be the only bridge from the renderer to the main process. The window SHALL run with context isolation enabled and Node integration disabled. The bridge SHALL expose ping, folder import, library listing, and library updates.

#### Scenario: Preload exposes the library bridge

- **WHEN** the renderer reads the bridge on `window`
- **THEN** it can call ping, import a folder, and list the library, and it cannot require Node modules

### Requirement: Python package imports as a stub

The `sonoarchive` Python package SHALL import without machine-learning libraries installed. Calling the retrain entry point SHALL fail with `NotImplementedError`.

#### Scenario: Import succeeds

- **WHEN** the package is installed editable in a virtualenv and tests import `sonoarchive`
- **THEN** the import succeeds

#### Scenario: Retrain is not implemented

- **WHEN** code calls the retrain entry point
- **THEN** it raises `NotImplementedError`
