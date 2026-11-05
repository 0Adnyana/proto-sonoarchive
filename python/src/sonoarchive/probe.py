"""Load an app probe file.

The Electron worker does not load PyTorch. A probe file is one JSON document
with the version, the CatID for each output row, and the linear layer:

    logits = weight @ embedding + bias
    scores = softmax(logits)

``weight`` is float32, little-endian, row-major, shape ``(len(labels), embedding_dim)``.
``bias`` is float32, little-endian, shape ``(len(labels),)``. Both are base64.
"""

import base64
import json
from pathlib import Path


class ProbeError(Exception):
    """The probe file cannot be used."""


def read_probe(path: Path) -> dict:
    """Load an app probe file into labels and raw float32 bytes."""
    path = Path(path)
    try:
        document = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as ex:
        raise ProbeError(f"could not read {path}: {ex}") from ex
    try:
        version = str(document["version"])
        labels = [str(label) for label in document["labels"]]
        dim = int(document["embedding_dim"])
        weight = _decode_array(document["weight"], (len(labels), dim))
        bias = _decode_array(document["bias"], (len(labels),))
    except (KeyError, TypeError, ValueError) as ex:
        raise ProbeError(f"{path} is not an app probe file") from ex
    if not version or len(labels) != len(set(labels)):
        raise ProbeError(f"{path} has an empty version or duplicate CatIDs")
    return {
        "version": version,
        "labels": labels,
        "embedding_dim": dim,
        "weight": weight,
        "bias": bias,
    }


def _decode_array(field: dict, shape: tuple[int, ...]) -> bytes:
    if field.get("dtype") != "float32":
        raise ProbeError("probe arrays must be float32")
    if tuple(field.get("shape", ())) != shape:
        raise ProbeError(f"probe array shape {field.get('shape')} != {shape}")
    data = base64.b64decode(field["data"], validate=True)
    count = 1
    for dim in shape:
        count *= dim
    if len(data) != count * 4:
        raise ProbeError("probe array byte length does not match its shape")
    return data
