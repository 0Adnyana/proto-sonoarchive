# S7 · Retrain

**Goal:** press *Retrain probe* and get a new, versioned probe that has learnt from the confirmed labels. **Builds on:** S2.

## Scope

- **Offline (Python):** build `training.npz` (embeddings, CatID, split, clip id) for EnvSound-UCS and FoleySet with the same ONNX model, plus `manifest.json` with the encoder hash.
- **Backend (Python):** started by the app; checks the encoder hash; reads labels and embeddings from SQLite read-only; trains the linear probe from scratch with the Beck & Lerch recipe; reports progress as JSON lines on stdout.
- **Regression guard:** the new probe is kept only if its macro F1 on the fixed test split is not lower than the current probe's.
- **Export:** versioned probe file written to a temp file, then renamed; earlier versions kept.
- **App:** *Retrain probe* button on Library with a status line (running, done with date, or error); reloads the new probe and re-scores untagged files from stored embeddings.

**Not in this slice:** automatic retraining, retraining the encoder.

## End-to-end test

1. Tag 20 F-short files, then press *Retrain probe*: status shows running, then done with date.
2. The probe version goes up by one; untagged files' suggestions carry the new version; existing labels are unchanged.
3. Tagging and saving still work while the retrain runs.
4. With a `manifest.json` whose hash doesn't match: retrain stops with an error and the old probe stays active.
5. The run's metrics and version are logged.

## Done when

- [ ] Steps 1–5 pass
- [ ] A full retrain on the training set plus 20 labels finishes in under 10 minutes on the dev laptop
