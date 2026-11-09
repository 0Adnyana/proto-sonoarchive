"""Write F-long with the PyTorch CNN14 pipeline and the app probe.

    python -m sonoarchive.flong

Each file in F-long is loaded as 32 kHz mono and cut into complete 10 second
windows at a 5 second hop. Each window is embedded with CNN14. The stored
embedding is the mean of those embeddings. The top 5 is taken from the mean of
the per-window softmax scores, not from the mean embedding.
"""

import json
import sys

from sonoarchive.paths import (
    CNN14_PTH,
    F_LONG,
    F_LONG_EMBEDDINGS,
    F_LONG_TOP5,
    MANIFEST,
    PROBE_JSON,
    ROOT,
)


def main() -> None:
    try:
        import numpy as np
        import torch

        from sonoarchive.audio import complete_windows, load_mono
        from sonoarchive.cnn14 import Cnn14Error, load_cnn14
        from sonoarchive.probe import ProbeError, read_probe
    except ImportError as ex:
        raise SystemExit(
            f"offline extra is not installed ({ex}). From python/: pip install -e '.[offline]'"
        ) from ex

    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    long_manifest = json.loads((F_LONG / "manifest.json").read_text(encoding="utf-8"))
    names = [row["filename"] for row in long_manifest["files"]]
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

    weight = np.frombuffer(probe["weight"], dtype="<f4").reshape(
        len(probe["labels"]), probe["embedding_dim"]
    ).astype(np.float64)
    bias = np.frombuffer(probe["bias"], dtype="<f4").astype(np.float64)
    labels = probe["labels"]
    embeddings = {}
    reference = {}
    for index, name in enumerate(names, start=1):
        print(f"embedding {index}/{len(names)} {name}", flush=True)
        windows = complete_windows(load_mono(F_LONG / name))
        if len(windows) != 5:
            raise SystemExit(f"{name} has {len(windows)} windows, expected 5")
        vectors = []
        scores = []
        for window in windows:
            waveform = torch.from_numpy(window).unsqueeze(0)
            with torch.inference_mode():
                vector = model.embed(waveform).squeeze(0).cpu().numpy()
            vector = np.ascontiguousarray(vector, dtype=np.float32)
            if vector.shape != (probe["embedding_dim"],):
                raise SystemExit(f"{name} embedding shape is {vector.shape}")
            vectors.append(vector)
            scores.append(_softmax(weight @ vector.astype(np.float64) + bias))
        mean_embedding = np.ascontiguousarray(
            np.mean(np.stack([vector.astype(np.float64) for vector in vectors]), axis=0),
            dtype=np.float32,
        )
        mean_scores = np.mean(np.stack(scores), axis=0)
        embeddings[name] = mean_embedding
        reference[name] = {
            "probe_version": probe["version"],
            "top5": [
                {"CatID": labels[label], "score": float(mean_scores[label])}
                for label in _top5(mean_scores)
            ],
        }

    print(f"writing {F_LONG_EMBEDDINGS.relative_to(ROOT)}", flush=True)
    np.savez(F_LONG_EMBEDDINGS, **embeddings)
    print(f"writing {F_LONG_TOP5.relative_to(ROOT)}", flush=True)
    F_LONG_TOP5.write_text(json.dumps(reference, indent=2) + "\n", encoding="utf-8")


def _softmax(logits):
    import numpy as np

    shifted = np.exp(logits - logits.max())
    return shifted / shifted.sum()


def _top5(scores):
    return sorted(range(len(scores)), key=lambda index: (-float(scores[index]), index))[:5]


if __name__ == "__main__":
    try:
        main()
    except (OSError, RuntimeError, json.JSONDecodeError) as ex:
        sys.exit(str(ex))
