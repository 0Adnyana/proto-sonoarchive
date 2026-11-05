import base64
import json

import pytest

from sonoarchive.probe import ProbeError, read_probe


def _document() -> dict:
    weight = b"\x00\x00\x80\x3f" * 4
    bias = b"\x00\x00\x00\x00" * 2
    return {
        "version": "paper-all-ucs/pair_all_ucs/seed_42",
        "embedding_dim": 2,
        "labels": ["ALRMBell", "FIRECrkl"],
        "weight": {
            "dtype": "float32",
            "shape": [2, 2],
            "data": base64.b64encode(weight).decode("ascii"),
        },
        "bias": {
            "dtype": "float32",
            "shape": [2],
            "data": base64.b64encode(bias).decode("ascii"),
        },
    }


def test_read_probe(tmp_path) -> None:
    path = tmp_path / "probe.json"
    path.write_text(json.dumps(_document()), encoding="utf-8")
    loaded = read_probe(path)
    assert loaded["version"] == "paper-all-ucs/pair_all_ucs/seed_42"
    assert loaded["labels"] == ["ALRMBell", "FIRECrkl"]
    assert loaded["embedding_dim"] == 2
    assert loaded["weight"] == b"\x00\x00\x80\x3f" * 4
    assert loaded["bias"] == b"\x00\x00\x00\x00" * 2


def test_read_probe_rejects_a_bad_shape(tmp_path) -> None:
    document = _document()
    document["weight"]["shape"] = [2, 4]
    document["weight"]["data"] = base64.b64encode(b"\x00" * 32).decode("ascii")
    path = tmp_path / "probe.json"
    path.write_text(json.dumps(document), encoding="utf-8")
    with pytest.raises(ProbeError):
        read_probe(path)
