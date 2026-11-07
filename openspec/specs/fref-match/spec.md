# fref-match Specification

## Purpose

TBD

## Requirements

### Requirement: Stored top-5 matches F-ref

For each F-short file, the suggestions stored by the app SHALL match `fixtures/F-ref/top5.json` in CatID order, with each score within 0.001 of the reference score.

#### Scenario: Top-5 matches the reference order and scores

- **WHEN** the stored suggestions for an F-short file are compared with `fixtures/F-ref/top5.json`
- **THEN** the CatIDs are in the same order and each score differs by at most 0.001

### Requirement: Stored embeddings match F-ref

For each F-short file, the embedding stored by the app SHALL have cosine similarity of at least 0.999 with the matching vector in `fixtures/F-ref/embeddings.npz`.

#### Scenario: The embedding matches the PyTorch vector

- **WHEN** the stored embedding for an F-short file is compared with `fixtures/F-ref/embeddings.npz`
- **THEN** the cosine similarity is at least 0.999

### Requirement: The comparison uses the app's stored rows

The comparison SHALL read suggestions and embeddings written by the worker and the database. The app SHALL NOT start Python to produce the rows under test. `python -m sonoarchive.parity` SHALL remain the ONNX-versus-PyTorch check.

#### Scenario: A present model is judged on stored rows

- **WHEN** the CNN14 ONNX file is present and F-short has been analysed by the app
- **THEN** the comparison reads the database rows for those files and applies the top-5 and cosine requirements
