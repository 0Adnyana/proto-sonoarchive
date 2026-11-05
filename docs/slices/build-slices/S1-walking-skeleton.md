# S1 · Walking skeleton

**Goal:** import a folder of short WAVs and see each file's top-5 CatIDs, computed inside Electron. **Builds on:** nothing.

## Scope

- **Offline (Python).** From `python/`, after `pip install -e '.[offline]'`:
  - `python -m sonoarchive.export_cnn14` exports CNN14 to ONNX.
  - `python -m sonoarchive.export_probe` writes the app probe file (weights, bias, the 753 UCS v8.2.1 CatIDs, version).
  - `python -m sonoarchive.fref` writes F-ref with the PyTorch pipeline.
  - The category list is `fixtures/UCS v8.2.1 Full List.xlsx`.
- App shell with three tabs (Library, Tag, Search); only Library works.
- *Import folder* for WAV files; decode with bundled ffmpeg to 32 kHz mono.
- Worker with ONNX Runtime: whole file → CNN14 → 2048-d embedding → probe → top-5.
- SQLite through better-sqlite3 + sqlite-vec: `files`, `embeddings` (float32 vec0), `suggestions` (with probe version), `ucs` (753 UCS v8.2.1 rows loaded).
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
- [ ] The ONNX parity check (step 4) runs as `python -m sonoarchive.parity`, so it can be rerun after any model change
