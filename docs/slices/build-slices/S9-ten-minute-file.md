# S9 · Ten-minute file

**Goal:** check windowing and responsiveness on a 10-minute file. **Builds on:** S3. **Later check:** F-long has no file this long. The EnvSound-UCS test split on disk tops out at 30 s (`365091.wav` and `41183.wav`), so this waits until a 10-minute file is added.

## Scope

- One file of 10 minutes (600 s) is analysed with the same 10 s windows and 50% overlap as S3.
- That file uses 119 windows (a window starts every 5 s, and only a window that fits completely is kept).
- While that file is still analysing, tagging and saving a short file stays immediate.

**Not in this slice:** a different window size, prioritising the selected file.

## End-to-end test

1. Import the 10-minute file together with F-short.
2. While it is still analysing, tag and save a short file without delay.
3. The file uses 119 windows.
4. Its top-5 matches a Python reference computed with the same windowing; the stored embedding equals the window average.

## Done when

- [ ] A 10-minute file is in F-long
- [ ] Steps 1–4 pass
