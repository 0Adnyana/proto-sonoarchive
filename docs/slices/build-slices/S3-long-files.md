# S3 · Long files and background analysis

**Goal:** import long files and keep tagging while they analyse in the background. **Builds on:** S1 (S2 for the tagging part of the test).

## Scope

- Files over 10 s are split into 10 s windows with 50% overlap.
- Window scores are averaged for the top-5; window embeddings are averaged into the one stored embedding.
- Analysis runs as a background queue in the worker; the Library shows a progress line (e.g. 12 / 40 analysed).
- The UI stays responsive while the queue runs.

**Not in this slice:** prioritising the selected file, different window sizes, a 10-minute file (S9).

## End-to-end test

1. Import F-long together with F-short.
2. The progress line counts up until every file is analysed.
3. Each F-long file is 30 s and uses 5 windows (a window starts every 5 s, and only a window that fits completely is kept).
4. Both files' top-5 match a Python reference computed with the same windowing; stored embeddings equal the window average.

## Done when

- [x] Steps 1–4 pass
- [x] Closing the app mid-queue and reopening it resumes analysis of the remaining files
