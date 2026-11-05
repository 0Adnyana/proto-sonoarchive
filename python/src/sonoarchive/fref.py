"""Write F-ref with the PyTorch CNN14 pipeline and the app probe.

    python -m sonoarchive.fref

Each file in F-short is loaded as 32 kHz mono, embedded with CNN14, and scored
with ``models/probe.json``. Writes ``fixtures/F-ref/embeddings.npz`` and
``fixtures/F-ref/top5.json``, then checks the top 5 against that probe.
"""

import json
import sys

from sonoarchive.paths import EMBEDDINGS, F_SHORT, MANIFEST, PROBE_JSON, ROOT, TOP5


def main() -> None:
    try:
        import numpy as np
        import torch

        from sonoarchive.audio import load_mono
        from sonoarchive.cnn14 import Cnn14Error, load_cnn14
        from sonoarchive.export_probe import ExportError, check_reference, top5
        from sonoarchive.paths import CNN14_PTH
        from sonoarchive.probe import ProbeError, read_probe
    except ImportError as ex:
        raise SystemExit(
            f"offline extra is not installed ({ex}). From python/: pip install -e '.[offline]'"
        ) from ex

    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    names = [row["filename"] for row in manifest["files"]]
    print(f"reading {CNN14_PTH.relative_to(ROOT)}", flush=True)
    try:
        model = load_cnn14(CNN14_PTH)
        probe = read_probe(PROBE_JSON)
    except (Cnn14Error, ProbeError) as ex:
        raise SystemExit(str(ex)) from ex
    if probe["version"] != manifest["probe_version"]:
        raise SystemExit(
            f"probe version {probe['version']} does not match the manifest "
            f"({manifest['probe_version']})"
        )

    embeddings = {}
    reference = {}
    for index, name in enumerate(names, start=1):
        print(f"embedding {index}/{len(names)} {name}", flush=True)
        waveform = torch.from_numpy(load_mono(F_SHORT / name)).unsqueeze(0)
        with torch.inference_mode():
            vector = model.embed(waveform).squeeze(0).cpu().numpy()
        vector = np.ascontiguousarray(vector, dtype=np.float32)
        if vector.shape != (probe["embedding_dim"],):
            raise SystemExit(f"{name} embedding shape is {vector.shape}")
        embeddings[name] = vector
        reference[name] = {
            "probe_version": probe["version"],
            "top5": [{"CatID": cat_id, "score": score} for cat_id, score in top5(probe, vector)],
        }

    print(f"writing {EMBEDDINGS.relative_to(ROOT)}", flush=True)
    np.savez(EMBEDDINGS, **embeddings)
    print(f"writing {TOP5.relative_to(ROOT)}", flush=True)
    TOP5.write_text(json.dumps(reference, indent=2) + "\n", encoding="utf-8")
    try:
        check_reference(probe)
    except ExportError as ex:
        raise SystemExit(str(ex)) from ex


if __name__ == "__main__":
    try:
        main()
    except (OSError, RuntimeError, json.JSONDecodeError) as ex:
        sys.exit(str(ex))
