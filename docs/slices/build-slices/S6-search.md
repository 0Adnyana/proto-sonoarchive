# S6 · Search

**Goal:** find tagged files by text, and files that sound like a selected one. **Builds on:** S2 (text search needs tagged files).

## Scope

- Search screen: text input + *Search*; *Find similar to selected file*; results table (file, CatID, FXName, similarity).
- Text search over CatID, Category, SubCategory and FXName of tagged files.
- Find similar: cosine distance query in sqlite-vec on the stored embeddings, closest first, the selected file itself excluded.
- Clicking a result opens the file in Tag.

**Not in this slice:** filters, saved searches, ranking tweaks. Search is supporting and is not evaluated.

## End-to-end test

1. Tag 5 F-short files with distinct FXNames.
2. Search for a word from one FXName: that file is returned.
3. Search for a Category name: every tagged file in that category is returned, no others.
4. *Find similar* on one file of an F-short same-subcategory pair: its twin appears in the top 3.
5. Clicking a result opens it in Tag.

## Done when

- [ ] Steps 1–5 pass
- [ ] Find similar returns within 1 s for the F-short set
