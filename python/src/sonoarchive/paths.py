"""Repository paths for the offline commands."""

from pathlib import Path


def repository_root() -> Path:
    """Return the repository root that holds ``fixtures`` and ``python``."""
    here = Path(__file__).resolve()
    for parent in here.parents:
        if (parent / "fixtures" / "manifest.json").is_file() and (
            parent / "python" / "pyproject.toml"
        ).is_file():
            return parent
    raise RuntimeError("could not find the repository root from the package path")


ROOT = repository_root()
MODELS = ROOT / "models"
FIXTURES = ROOT / "fixtures"
CNN14_PTH = MODELS / "Cnn14_mAP=0.431.pth"
CNN14_ONNX = MODELS / "Cnn14_mAP=0.431.onnx"
PROBE_PT = MODELS / "probe.pt"
PROBE_JSON = MODELS / "probe.json"
MANIFEST = FIXTURES / "manifest.json"
F_SHORT = FIXTURES / "F-short"
F_LONG = FIXTURES / "F-long"
F_REF = FIXTURES / "F-ref"
F_LONG_EMBEDDINGS = F_LONG / "embeddings.npz"
F_LONG_TOP5 = F_LONG / "top5.json"
EMBEDDINGS = F_REF / "embeddings.npz"
TOP5 = F_REF / "top5.json"
UCS_LIST = FIXTURES / "UCS v8.2.1 Full List.xlsx"
