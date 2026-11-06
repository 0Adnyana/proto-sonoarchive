# renderer-ui Specification

## Purpose

TBD

## Requirements

### Requirement: Renderer is a React application

The desktop renderer SHALL mount one React root into a single mount node. The HTML document, before the script runs, SHALL NOT contain the Library, Tag, or Search markup. After the root renders, the document SHALL contain a tab and a panel for Library, Tag, and Search.

#### Scenario: Static document is only a mount point

- **WHEN** the renderer HTML is read before the script runs
- **THEN** it contains one mount node and no tab or panel for Library, Tag, or Search

#### Scenario: Started renderer lists the three screens

- **WHEN** the React renderer has started
- **THEN** the document contains a tab and a panel for Library, a tab and a panel for Tag, and a tab and a panel for Search

### Requirement: Shell and Library use the shared component set

The repository SHALL install shadcn for the renderer and SHALL include its button, tabs, and table components under the renderer source. The shell tabs, the *Import folder* control, and the library table SHALL be rendered with those components. The main process, preload, and worker SHALL NOT import React.

#### Scenario: Shared components exist in the renderer

- **WHEN** a developer lists the renderer component directory after install
- **THEN** the shadcn button, tabs, and table components are present

#### Scenario: Import and the file table are on Library only

- **WHEN** the Library screen is shown
- **THEN** it shows an *Import folder* control and a table whose headers are File name, Format, Duration (seconds), and Status, and Tag and Search show neither the control nor the table

### Requirement: Library view follows the preload bridge

The Library view SHALL load files through the preload bridge, SHALL start an import only through that bridge, and SHALL replace its rows when the bridge reports a library change. Cancelling the picker SHALL leave the rows and the status line unchanged. A bridge failure SHALL be shown on the status line. Tag and Search SHALL show no imported files.

#### Scenario: Stored files appear on start

- **WHEN** the view starts and the bridge lists one stored WAV
- **THEN** the table shows that file's name, format `wav`, duration in seconds, and status *untagged*

#### Scenario: A finished import reports how many files were stored

- **WHEN** an import finishes with stored files and one decode failure
- **THEN** the status line reports how many files were stored and names the file that failed

#### Scenario: Cancelling the picker changes nothing

- **WHEN** the user activates *Import folder* and the bridge returns no folder
- **THEN** the status line stays empty and the listed rows stay as they were

#### Scenario: Switching tabs keeps the stored rows

- **WHEN** the user opens Tag after files are listed and then returns to Library
- **THEN** the Library table shows the same rows and the Tag and Search panels show none of those file names

#### Scenario: A database failure is shown on the status line

- **WHEN** listing the library fails
- **THEN** the status line includes the failure message
