# S1 · Walking skeleton

**Goal:** import a folder of short WAVs and see each file's top-5 CatIDs, computed inside Electron. **Builds on:** nothing.

## Scope

- **Offline (Python):** export CNN14 to ONNX; export the existing probe to the app's probe file (weights, bias, 453-label list, version); generate F-ref with the PyTorch pipeline.
- App shell with three tabs (Library, Tag, Search); only Library works.
- *Import folder* for WAV files; decode with bundled ffmpeg to 32 kHz mono.
- Worker with ONNX Runtime: whole file → CNN14 → 2048-d embedding → probe → top-5.
- SQLite through better-sqlite3 + sqlite-vec: `files`, `embeddings` (float32 vec0), `suggestions` (with probe version), `ucs` (453 rows loaded).
- Library table: file name, format, duration, status, top-1 CatID.

**Not in this slice:** tagging, MP3/FLAC, files over 10 s, search, retraining.

## End-to-end test

1. On a machine without Python, import F-short.
2. All 20 files appear with duration and status *untagged*.
3. Each file's top-5 CatIDs match F-ref in the same order; scores within 0.001.
4. Each stored embedding has cosine similarity ≥ 0.999 with the PyTorch embedding.
5. Quit and reopen the app: files and suggestions are still there.

## Done when

- [ ] Steps 1–5 pass
- [ ] The ONNX parity check (step 4) runs as a script, so it can be rerun after any model change
