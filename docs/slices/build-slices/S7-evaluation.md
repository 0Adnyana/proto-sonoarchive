# S7 · Evaluation harness

**Goal:** one command produces the TA's evaluation numbers for any probe version. **Builds on:** S1 (needs the ONNX pipeline and a probe file). Not part of the app.

## Scope

- **Test-set metrics:** macro F1, top-1 accuracy and top-5 accuracy at CatID level on the published EnvSound-UCS and FoleySet test splits, using embeddings from the ONNX pipeline.
- **Correction simulation:** replay the test files as if a user tagged them, with the true CatID as the user's choice; report the share where it is suggestion 1, in 2–5, or needs a manual pick.
- Optional batch mode: add simulated labels in batches, retrain with the S6 backend, re-run the simulation after each batch.
- Output: one report file (table of metrics per split and probe version).

**Not in this slice:** search evaluation.

## End-to-end test

1. Run the command on the existing probe.
2. Its EnvSound-UCS macro F1 matches the probe's known score (0.496 for the original probe on the original test split) within 0.01.
3. The report lists macro F1, top-1 and top-5 for both test splits.
4. The simulation's three shares add up to 100%, and the suggestion-1 share equals top-1 accuracy.

## Done when

- [ ] Steps 1–4 pass
- [ ] Running it twice on the same probe gives identical numbers
