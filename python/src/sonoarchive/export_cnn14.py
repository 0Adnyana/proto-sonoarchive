"""Export the PANNs CNN14 checkpoint to ONNX.

    python -m sonoarchive.export_cnn14

Reads ``models/Cnn14_mAP=0.431.pth`` and writes ``models/Cnn14_mAP=0.431.onnx``.
The graph takes a float32 waveform named ``waveform`` with shape
``(batch, samples)`` and returns the 2048-d ``embedding``. Opset 17 matches
the export from PyTorch 2.14.
"""

import inspect
import sys

from sonoarchive.paths import CNN14_ONNX, CNN14_PTH, ROOT


def main() -> None:
    try:
        import torch

        from sonoarchive.cnn14 import SAMPLE_RATE, Cnn14Error, Embedding, load_cnn14
    except ImportError as ex:
        raise SystemExit(
            f"offline extra is not installed ({ex}). From python/: pip install -e '.[offline]'"
        ) from ex

    try:
        print(f"reading {CNN14_PTH.relative_to(ROOT)}", flush=True)
        model = load_cnn14(CNN14_PTH)
        wrapper = Embedding(model).eval()
        dummy = torch.zeros(1, SAMPLE_RATE)
        print(f"writing {CNN14_ONNX.relative_to(ROOT)}", flush=True)
        kwargs = {
            "input_names": ["waveform"],
            "output_names": ["embedding"],
            "dynamic_axes": {
                "waveform": {0: "batch", 1: "samples"},
                "embedding": {0: "batch"},
            },
            "opset_version": 17,
        }
        if "dynamo" in inspect.signature(torch.onnx.export).parameters:
            kwargs["dynamo"] = False
        with torch.inference_mode():
            torch.onnx.export(wrapper, dummy, str(CNN14_ONNX), **kwargs)
    except Cnn14Error as ex:
        raise SystemExit(str(ex)) from ex

    data = CNN14_ONNX.read_bytes()
    if b"waveform" not in data or b"embedding" not in data:
        raise SystemExit(f"{CNN14_ONNX} is missing the waveform input or the embedding output")
    print("exported CNN14 embedding", flush=True)


if __name__ == "__main__":
    try:
        main()
    except (OSError, RuntimeError) as ex:
        sys.exit(str(ex))
