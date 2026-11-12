# S5 · Search

**Goal:** find tagged files by text, and files that sound like a selected one. **Builds on:** S2 (text search needs tagged files).

## Scope

- Library search field (accessible name Query) and _Search_: submit with Enter or the button; hits replace the library table (file name, format, duration, status, CatID, FXName, similarity).
- Text search over file name, CatID, Category, SubCategory and FXName of tagged files, plus untagged rank-1 suggestion fields.
- Find similar: a control on the open file in the metadata slideover; cosine distance query in sqlite-vec on the stored embeddings, closest first, the selected file itself excluded. Hits replace the library table until they are cleared.
- Clicking a hit opens the file in the metadata slideover.

**Not in this slice:** filters, saved searches, ranking tweaks. Search is supporting and is not evaluated.

## End-to-end test

1. Tag 5 F-short files with distinct FXNames.
2. Search for a word from one FXName: that file is returned.
3. Search for a Category name: every tagged file in that category is returned, no others.
4. _Find similar_ on one file of an F-short same-subcategory pair: its twin appears in the top 3.
5. Clicking a result opens it in the metadata slideover.

## Done when

- [x] Steps 1–5 pass
- [x] Find similar returns within 1 s for the F-short set
