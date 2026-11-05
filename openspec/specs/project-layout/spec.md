# project-layout Specification

## Purpose

TBD

## Requirements

### Requirement: Process directories exist

The repository SHALL contain separate source directories for the Electron main process, preload script, renderer, inference worker, and shared IPC types, plus a Python package directory.

#### Scenario: Desktop source tree

- **WHEN** a developer lists the repository after the scaffold is applied
- **THEN** `src/main`, `src/preload`, `src/renderer`, `src/worker`, and `src/shared` each exist and contain the entry module for that process

#### Scenario: Python package tree

- **WHEN** a developer lists the Python project
- **THEN** `python/pyproject.toml` exists and the importable package lives at `python/src/sonoarchive`

### Requirement: Model and fixture directories exist

The repository SHALL contain `models/` and `fixtures/`. Offline model commands live in the Python package, not in a top-level `scripts/` directory. Checkpoint files (`.onnx`, `.pt`, `.pth`) stay untracked.

#### Scenario: Asset directories are present

- **WHEN** a developer clones the repository
- **THEN** `models/` and `fixtures/` exist and there is no top-level `scripts/` directory

### Requirement: Generated and local files are ignored

The repository SHALL ignore Node installs, Electron build output, Python virtualenvs, bytecode, pytest caches, SQLite databases, and local model weight files.

#### Scenario: Install artifacts are not source

- **WHEN** a developer installs Node dependencies and creates `python/.venv`
- **THEN** `.gitignore` matches `node_modules/` and `python/.venv/` so those paths are not committed
