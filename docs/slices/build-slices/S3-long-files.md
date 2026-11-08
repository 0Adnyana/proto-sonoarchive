# S3 · Long files and background analysis

**Goal:** import long files and keep tagging while they analyse in the background. **Builds on:** S1 (S2 for the tagging part of the test).

## Scope

- Files over 10 s are split into 10 s windows with 50% overlap.
- Window scores are averaged for the top-5; window embeddings are averaged into the one stored embedding.
- Analysis runs as a background queue in the worker; the Library shows a progress line (e.g. 12 / 40 analysed).
- The UI stays responsive while the queue runs.

**Not in this slice:** prioritising the selected file, different window sizes.

## End-to-end test

1. Import F-long together with F-short.
2. The progress line counts up until every file is analysed.
3. While the 10-minute file is still analysing, tag and save a short file without delay.
4. The 1-minute file uses 11 windows and the 10-minute file 119 (window starts every 5 s).
5. Both long files' top-5 match a Python reference computed with the same windowing; stored embeddings equal the window average.

## Done when

- [ ] Steps 1–5 pass
- [ ] Closing the app mid-queue and reopening it resumes analysis of the remaining files
