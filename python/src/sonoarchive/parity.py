"""Check ONNX CNN14 embeddings against the PyTorch embeddings in F-ref.

    python -m sonoarchive.parity

Loads each F-short file the same way as ``fref`` (32 kHz mono), runs
``models/Cnn14_mAP=0.431.onnx``, and compares the vector with
``fixtures/F-ref/embeddings.npz``. Each cosine similarity must be at least
0.999. Rerun this after replacing the ONNX file.
"""

import sys
import zipfile

from sonoarchive.paths import CNN14_ONNX, EMBEDDINGS, F_SHORT, ROOT

COSINE_MIN = 0.999


def main() -> None:
    try:
        import numpy as np
        import onnxruntime as ort

        from sonoarchive.audio import load_mono
        from sonoarchive.export_probe import EMBEDDING_DIM, ExportError, read_npy
    except ImportError as ex:
        raise SystemExit(
            f"offline extra is not installed ({ex}). From python/: pip install -e '.[offline]'"
        ) from ex

    if not CNN14_ONNX.is_file():
        raise SystemExit(f"no ONNX model at {CNN14_ONNX}")
    print(f"reading {CNN14_ONNX.relative_to(ROOT)}", flush=True)
    session = ort.InferenceSession(str(CNN14_ONNX), providers=["CPUExecutionProvider"])
    print(f"checking {EMBEDDINGS.relative_to(ROOT)}", flush=True)
    with zipfile.ZipFile(EMBEDDINGS) as archive:
        names = sorted(name[: -len(".npy")] for name in archive.namelist())
        worst = 1.0
        for index, name in enumerate(names, start=1):
            print(f"comparing {index}/{len(names)} {name}", flush=True)
            try:
                reference = read_npy(archive.read(f"{name}.npy"))
            except ExportError as ex:
                raise SystemExit(str(ex)) from ex
            waveform = load_mono(F_SHORT / name)[None, :]
            got = session.run(["embedding"], {"waveform": waveform})[0].reshape(-1)
            if got.shape != (EMBEDDING_DIM,):
                raise SystemExit(f"{name} ONNX embedding shape is {got.shape}")
            similarity = _cosine(np.asarray(got, dtype=np.float64), reference.astype(np.float64))
            worst = min(worst, similarity)
            if similarity < COSINE_MIN:
                raise SystemExit(f"{name} cosine similarity {similarity:.6f} is below {COSINE_MIN}")
    print(f"ONNX matches F-ref for {len(names)} files; lowest cosine {worst:.6f}", flush=True)


def _cosine(left, right) -> float:
    denom = float((left @ left) ** 0.5 * (right @ right) ** 0.5)
    if denom == 0.0:
        return 0.0
    return float(left @ right / denom)


if __name__ == "__main__":
    try:
        main()
    except (OSError, RuntimeError, zipfile.BadZipFile) as ex:
        sys.exit(str(ex))
