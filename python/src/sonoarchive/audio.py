"""Load a clip the way the PyTorch CNN14 pipeline does: mono, 32 kHz."""

from pathlib import Path

SAMPLE_RATE = 32000


def load_mono(path: Path):
    """Return one float32 waveform at 32 kHz."""
    import librosa
    import numpy as np

    audio, _ = librosa.load(path, sr=SAMPLE_RATE, mono=True)
    return np.asarray(audio, dtype=np.float32)
