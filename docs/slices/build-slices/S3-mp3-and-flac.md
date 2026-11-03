# S3 · MP3 and FLAC

**Goal:** run the same import-to-save loop for MP3 and FLAC files. **Builds on:** S2.

## Scope

- Import and decode MP3 and FLAC alongside WAV.
- MP3 writer: one ID3v2.4 TXXX frame per field, description = field name.
- FLAC writer: one Vorbis comment per field, upper-case field name as key.
- Both use the S2 mapping table and the temp-copy rule.

**Not in this slice:** other formats, rename, search.

## End-to-end test

1. Import F-formats (WAV, MP3 and FLAC copies of the same 5 sounds).
2. All 15 files are listed with the right format and duration.
3. FLAC copies get the same top-5 as their WAV originals; MP3 copies share at least 4 of the 5 CatIDs (lossy encoding may shift scores slightly).
4. Tag one MP3 and one FLAC; both show all six fields in Soundly and SoundQ.
5. Decoded audio is identical before and after Save for both files (hash of decoded samples).

## Done when

- [ ] Steps 1–5 pass
- [ ] Existing ID3 and Vorbis tags not written by the app (e.g. artist) survive a Save
