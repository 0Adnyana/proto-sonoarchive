"""Export models/probe.pt to the app probe file and check it against F-ref.

    python -m sonoarchive.export_probe

Reads ``fixtures/manifest.json`` for the probe version. The CatID list must be
the UCS v8.2.1 list. Scores each vector in ``fixtures/F-ref/embeddings.npz``
and compares the top 5 with ``fixtures/F-ref/top5.json``.
"""

import base64
import io
import json
import pickle
import sys
import warnings
import zipfile
from pathlib import Path

import numpy as np

from sonoarchive.paths import EMBEDDINGS, MANIFEST, PROBE_JSON, PROBE_PT, ROOT, TOP5, UCS_LIST
from sonoarchive.probe import ProbeError, read_probe
from sonoarchive.ucs import UcsError, read_ucs

EMBEDDING_DIM = 2048
SCORE_TOLERANCE = 0.001


class ExportError(Exception):
    """The checkpoint could not be exported."""


class _Tensor:
    def __init__(self, data: bytes, size: tuple[int, ...]) -> None:
        self.data = data
        self.size = size


class _CheckpointUnpickler(pickle.Unpickler):
    def __init__(self, data: bytes, archive: zipfile.ZipFile) -> None:
        super().__init__(io.BytesIO(data))
        self._archive = archive

    def find_class(self, module: str, name: str):
        if name == "_rebuild_tensor_v2":

            def rebuild(storage, storage_offset, size, stride, requires_grad, backward_hooks, metadata=None):
                if storage_offset != 0:
                    raise ExportError("probe tensor has a non-zero storage offset")
                count = 1
                for dim in size:
                    count *= dim
                if len(storage) != count * 4:
                    raise ExportError("probe tensor storage does not match its shape")
                return _Tensor(storage, tuple(size))

            return rebuild
        if module == "torch" or module.startswith("torch."):
            return type(name, (), {})
        return super().find_class(module, name)

    def persistent_load(self, pid):
        if not isinstance(pid, tuple) or not pid or pid[0] != "storage":
            raise ExportError(f"unexpected probe storage record: {pid!r}")
        key = pid[2]
        return self._archive.read(f"probe/data/{key}")


def read_checkpoint(path: Path) -> dict:
    """Read a probe.pt saved by the linear-probe trainer."""
    print(f"reading {path.relative_to(ROOT)}", flush=True)
    if not path.is_file():
        raise ExportError(f"no probe checkpoint at {path}")
    try:
        archive = zipfile.ZipFile(path)
    except zipfile.BadZipFile as ex:
        raise ExportError(f"{path} is not a torch zip checkpoint") from ex
    with archive:
        if archive.read("probe/byteorder") != b"little":
            raise ExportError(f"{path} is not little-endian")
        blob = _CheckpointUnpickler(archive.read("probe/data.pkl"), archive).load()

    for key in ("state_dict", "cat_ids"):
        if key not in blob:
            raise ExportError(f"{path} is missing {key}")
    state = blob["state_dict"]
    try:
        weight = state["linear.weight"]
        bias = state["linear.bias"]
    except KeyError as ex:
        raise ExportError(f"{path} has no linear layer") from ex
    if not isinstance(weight, _Tensor) or not isinstance(bias, _Tensor):
        raise ExportError(f"{path} linear layer is not a dense float tensor")

    labels = [str(label) for label in blob["cat_ids"]]
    if weight.size != (len(labels), EMBEDDING_DIM) or bias.size != (len(labels),):
        raise ExportError(
            f"{path} has weight {weight.size} and bias {bias.size} for {len(labels)} labels"
        )
    if len(labels) != len(set(labels)) or any(not label for label in labels):
        raise ExportError(f"{path} CatID list is empty or has duplicates")
    catalog = {row["CatID"] for row in read_ucs(UCS_LIST)}
    if set(labels) != catalog:
        raise ExportError(
            f"{path} CatIDs do not match the UCS v8.2.1 list "
            f"({len(labels)} in the checkpoint, {len(catalog)} in the list)"
        )
    print(
        f"checkpoint: {len(labels)} UCS v8.2.1 labels, weight {weight.size}, bias {bias.size}",
        flush=True,
    )
    return {
        "labels": labels,
        "embedding_dim": EMBEDDING_DIM,
        "weight": weight.data,
        "bias": bias.data,
    }


def write_probe(path: Path, probe: dict, version: str) -> None:
    """Write the app probe file."""
    n_labels = len(probe["labels"])
    dim = probe["embedding_dim"]
    if len(probe["weight"]) != n_labels * dim * 4 or len(probe["bias"]) != n_labels * 4:
        raise ExportError("weight or bias byte length does not match the label list")
    document = {
        "version": version,
        "embedding_dim": dim,
        "labels": list(probe["labels"]),
        "weight": {
            "dtype": "float32",
            "shape": [n_labels, dim],
            "data": base64.b64encode(probe["weight"]).decode("ascii"),
        },
        "bias": {
            "dtype": "float32",
            "shape": [n_labels],
            "data": base64.b64encode(probe["bias"]).decode("ascii"),
        },
    }
    print(f"writing {path.relative_to(ROOT)} version {version}", flush=True)
    path.write_text(json.dumps(document, indent=2) + "\n", encoding="utf-8")


def read_npy(raw: bytes) -> np.ndarray:
    if not raw.startswith(b"\x93NUMPY"):
        raise ExportError("embedding is not a npy array")
    header_len = int.from_bytes(raw[8:10], "little")
    header = raw[10 : 10 + header_len].decode("latin1")
    if "'descr': '<f4'" not in header or "'fortran_order': False" not in header:
        raise ExportError(f"embedding header is not little-endian float32: {header.strip()}")
    array = np.frombuffer(raw[10 + header_len :], dtype="<f4")
    if array.shape != (EMBEDDING_DIM,):
        raise ExportError(f"embedding length is {array.shape[0]}, expected {EMBEDDING_DIM}")
    return array


def softmax(logits: np.ndarray) -> np.ndarray:
    shifted = np.exp(logits - logits.max())
    return shifted / shifted.sum()


def top5(probe: dict, embedding: np.ndarray) -> list[tuple[str, float]]:
    """Return the five highest-scoring CatIDs for one embedding."""
    weight = np.frombuffer(probe["weight"], dtype="<f4").reshape(
        len(probe["labels"]), probe["embedding_dim"]
    )
    bias = np.frombuffer(probe["bias"], dtype="<f4")
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", RuntimeWarning)
        scores = softmax(weight @ embedding + bias)
    order = np.argsort(-scores)[:5]
    return [(probe["labels"][int(i)], float(scores[int(i)])) for i in order]


def check_reference(probe: dict) -> None:
    print(f"checking {TOP5.relative_to(ROOT)}", flush=True)
    reference = json.loads(TOP5.read_text(encoding="utf-8"))
    with zipfile.ZipFile(EMBEDDINGS) as archive:
        names = sorted(name[: -len(".npy")] for name in archive.namelist())
        if set(names) != set(reference):
            raise ExportError("embeddings.npz and top5.json do not list the same files")
        worst = 0.0
        for index, name in enumerate(names, start=1):
            print(f"scoring {index}/{len(names)} {name}", flush=True)
            entry = reference[name]
            if entry["probe_version"] != probe["version"]:
                raise ExportError(f"{name} reference version is {entry['probe_version']}")
            got = top5(probe, read_npy(archive.read(f"{name}.npy")))
            expected = [(row["CatID"], float(row["score"])) for row in entry["top5"]]
            if [cat for cat, _ in got] != [cat for cat, _ in expected]:
                raise ExportError(f"{name} top-5 CatIDs {got} != {expected}")
            delta = max(abs(left - right) for (_, left), (_, right) in zip(got, expected))
            worst = max(worst, delta)
            if delta > SCORE_TOLERANCE:
                raise ExportError(f"{name} scores differ by {delta:.6f}")
    print(f"F-ref top-5 match for {len(names)} files; largest score gap {worst:.6f}", flush=True)


def main() -> None:
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    version = manifest["probe_version"]
    probe = read_checkpoint(PROBE_PT)
    write_probe(PROBE_JSON, probe, version)
    print(f"reading back {PROBE_JSON.relative_to(ROOT)}", flush=True)
    written = read_probe(PROBE_JSON)
    if written["labels"] != probe["labels"] or written["weight"] != probe["weight"]:
        raise ExportError("wrote a probe file that does not read back")
    if written["bias"] != probe["bias"] or written["version"] != version:
        raise ExportError("wrote a probe file that does not read back")
    check_reference(written)


if __name__ == "__main__":
    try:
        main()
    except (ExportError, ProbeError, UcsError, OSError, KeyError, json.JSONDecodeError) as ex:
        sys.exit(str(ex))
