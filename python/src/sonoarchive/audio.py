"""Load a clip the way the PyTorch CNN14 pipeline does: mono, 32 kHz."""

from pathlib import Path

SAMPLE_RATE = 32000
WINDOW_SAMPLES = 10 * SAMPLE_RATE
HOP_SAMPLES = 5 * SAMPLE_RATE


def load_mono(path: Path):
    """Return one float32 waveform at 32 kHz."""
    import librosa
    import numpy as np

    audio, _ = librosa.load(path, sr=SAMPLE_RATE, mono=True)
    return np.asarray(audio, dtype=np.float32)


def pad_to_one_second(waveform):
    """Append silence until the waveform is at least one second long.

    CNN14 was exported from a one-second buffer. Clips shorter than
    ``SAMPLE_RATE`` samples are zero-padded at the end. Longer clips are
    returned unchanged.
    """
    import numpy as np

    waveform = np.asarray(waveform, dtype=np.float32)
    missing = SAMPLE_RATE - waveform.shape[0]
    if missing <= 0:
        return waveform
    return np.pad(waveform, (0, missing))


def complete_windows(waveform):
    """Return complete 10 second windows at a 5 second hop.

    A buffer of one window or fewer is not sliced. A start is kept only when
    the window fits completely, so a short tail is dropped.
    """
    import numpy as np

    waveform = np.asarray(waveform, dtype=np.float32)
    count = waveform.shape[0]
    if count <= WINDOW_SAMPLES:
        return []
    return [
        waveform[start : start + WINDOW_SAMPLES]
        for start in range(0, count - WINDOW_SAMPLES + 1, HOP_SAMPLES)
    ]
