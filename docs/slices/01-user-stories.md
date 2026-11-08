# User stories

18 stories cover the MVP for two roles: the **sound designer** who tags files, and the **researcher** who retrains and evaluates the model. Each one maps to a part of the spec ([00-mvp-spec.md](00-mvp-spec.md)); acceptance criteria say when it is done.

## Import & analysis

| ID | Story | Acceptance criteria |
| --- | --- | --- |
| US-01 | As a sound designer, I want to import a folder, so that all its audio files appear in the Library. | *Import folder* opens a folder picker. Every WAV, MP3 and FLAC file is listed with file name, format, duration and status *untagged*. Other file types are ignored. |
| US-02 | As a sound designer, I want suggestions computed in the background, so that I can start tagging without waiting for the whole folder. | A status line shows analysis progress. The window stays responsive while files are analysed. Each file gets a stored embedding and top-5 CatIDs. Files over 10 s are split into 10 s windows with 50% overlap and their scores averaged. |
| US-03 | As a sound designer, I want tagging to work without Python installed, so that the app runs as a normal desktop app. | Import, analysis, tagging, saving and search all run inside Electron through ONNX Runtime. Python is only started when retraining. |

## Tagging

| ID | Story | Acceptance criteria |
| --- | --- | --- |
| US-04 | As a sound designer, I want to hear a file and see its top 5 suggestions, so that I can judge which label fits. | Selecting a row in Library opens the file in Tag. *Play/Stop* plays the file. A radio list shows 5 suggestions, highest score first, each with CatID, Category › SubCategory and score. |
| US-05 | As a sound designer, I want to pick any UCS label when none of the 5 fits, so that I am never forced into a wrong tag. | *Other…* dropdown lists all 753 UCS v8.2.1 CatIDs. Picking one replaces the radio choice. |
| US-06 | As a sound designer, I want to type FXName, CreatorID and SourceID, so that the file carries the full UCS description. | Three text inputs. *Save* stays disabled until a CatID is chosen and FXName is not empty. |
| US-07 | As a sound designer, I want to move straight to the next file, so that I can tag a folder in one sitting. | *Next file* opens the next untagged file in Library order. |

## Metadata & rename

| ID | Story | Acceptance criteria |
| --- | --- | --- |
| US-08 | As a sound designer, I want Save to write the tags into the file, so that the labels travel with the audio. | WAV: one tag per field in the iXML USER block, FXName also in the bext Description. MP3: one ID3v2.4 TXXX frame per field. FLAC: one Vorbis comment per field. Fields: CatID, Category, SubCategory, FXName, CreatorID, SourceID; Category and SubCategory come from the CatID. |
| US-09 | As a sound designer, I want Save to leave my audio intact, so that tagging never damages a file. | The writer saves to a temp copy and replaces the original only after the copy re-reads cleanly. Audio data and other chunks or tags are unchanged. |
| US-10 | As a sound designer, I want the tags to show up in my library tool, so that I can search them where I already work. | A saved WAV shows CatID, Category, SubCategory, and FXName in Soundly. A later slice checks MP3 and FLAC in Soundly and SoundQ, and checks the field names against a Soundminer-tagged reference file. |
| US-11 | As a sound designer, I want the option to rename the file to the UCS pattern, so that the filename matches its tags. | *Rename to UCS filename* checkbox with a preview of the new name. When ticked, Save renames the file to CatID_FXName_CreatorID_SourceID and updates its path in the database. |
| US-12 | As a researcher, I want each save to record which suggestion was chosen, so that I can measure how useful the suggestions are. | The label row stores the chosen rank (1–5, or manual) and a timestamp; the file's status becomes *tagged*. |

## Search

Supporting features; not evaluated.

| ID | Story | Acceptance criteria |
| --- | --- | --- |
| US-13 | As a sound designer, I want to search my tagged files by text, so that I can find a sound by its name or category. | Text input + *Search* returns a results table with file, CatID and FXName. |
| US-14 | As a sound designer, I want to find files that sound like the one I selected, so that I can find alternatives quickly. | *Find similar to selected file* runs a cosine distance query in sqlite-vec on the stored embeddings and lists file, CatID, FXName and similarity, closest first. |

## Retraining

| ID | Story | Acceptance criteria |
| --- | --- | --- |
| US-15 | As a researcher, I want to retrain the probe with a button, so that my confirmed labels improve future suggestions. | *Retrain probe* on Library starts the Python backend, which refits the linear probe on EnvSound-UCS and FoleySet plus all confirmed labels. The encoder is never retrained and no audio is re-embedded. A status line shows running, done with date, or error. |
| US-16 | As a researcher, I want each probe versioned, so that I know which probe produced which suggestion. | The probe file stores its label list and a version. Every stored suggestion records the probe version. The app reloads the new probe after a successful retrain. |

## Evaluation

| ID | Story | Acceptance criteria |
| --- | --- | --- |
| US-17 | As a researcher, I want test-set scores for the probe, so that I can report how accurate the tagger is. | Macro F1, top-1 accuracy and top-5 accuracy at CatID level on the published EnvSound-UCS and FoleySet test splits. |
| US-18 | As a researcher, I want to simulate a user correcting suggestions, so that I can show how much the top 5 saves. | Test files are replayed through the tag flow with the true CatID as the user's choice. Reports the share where the true CatID is suggestion 1, in 2–5, or needs a manual pick; optionally repeated after each batch retrain. |
