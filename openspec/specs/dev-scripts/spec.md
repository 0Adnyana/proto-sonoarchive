# dev-scripts Specification

## Purpose

TBD

## Requirements

### Requirement: Node commands typecheck, lint, and test the scaffold

The root package SHALL provide `dev`, `typecheck`, `lint`, and `test` scripts. `typecheck`, `lint`, and `test` SHALL exit successfully on the unmodified scaffold. `dev` SHALL start the Electron shell.

#### Scenario: Static checks pass

- **WHEN** a developer runs `npm run typecheck` and `npm run lint` after `npm install`
- **THEN** both commands exit with status 0

#### Scenario: Node tests pass without a display

- **WHEN** a developer runs `npm test`
- **THEN** the command exits with status 0 and does not require a graphical display

### Requirement: Python tests run from the package directory

The Python project SHALL be installable in editable mode with pytest, and `python -m pytest` SHALL exit successfully.

#### Scenario: Pytest passes

- **WHEN** a developer creates a virtualenv, installs the package with its dev extra, and runs `python -m pytest` inside `python/`
- **THEN** the command exits with status 0

### Requirement: README states how to run the scaffold

The repository root README SHALL list the Node install and `dev` / `typecheck` / `lint` / `test` commands and the Python virtualenv, install, and pytest commands.

#### Scenario: A new developer can find both command sets

- **WHEN** a developer opens the root README
- **THEN** it includes the Node scripts and the Python install and test commands
