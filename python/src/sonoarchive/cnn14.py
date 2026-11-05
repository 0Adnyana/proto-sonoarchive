"""PANNs CNN14, frozen, returning the 2048-d embedding.

The architecture and the front end match Kong et al. (2020): 32 kHz mono
waveform, window 1024, hop 320, 64 mel bins. ``fc_audioset`` stays on the
module so the AudioSet checkpoint loads, and the exported graph drops it.
"""

from pathlib import Path

import torch
import torch.nn as nn
import torch.nn.functional as F
from torchlibrosa.stft import LogmelFilterBank, Spectrogram

SAMPLE_RATE = 32000
WINDOW_SIZE = 1024
HOP_SIZE = 320
MEL_BINS = 64
FMIN = 50
FMAX = 14000
CLASSES_NUM = 527
EMBEDDING_DIM = 2048


class Cnn14Error(Exception):
    """The CNN14 checkpoint could not be loaded."""


class ConvBlock(nn.Module):
    def __init__(self, in_channels: int, out_channels: int) -> None:
        super().__init__()
        self.conv1 = nn.Conv2d(
            in_channels, out_channels, kernel_size=(3, 3), stride=(1, 1), padding=(1, 1), bias=False
        )
        self.conv2 = nn.Conv2d(
            out_channels, out_channels, kernel_size=(3, 3), stride=(1, 1), padding=(1, 1), bias=False
        )
        self.bn1 = nn.BatchNorm2d(out_channels)
        self.bn2 = nn.BatchNorm2d(out_channels)

    def forward(self, x: torch.Tensor, pool_size: tuple[int, int]) -> torch.Tensor:
        x = F.relu_(self.bn1(self.conv1(x)))
        x = F.relu_(self.bn2(self.conv2(x)))
        return F.avg_pool2d(x, kernel_size=pool_size)


class Cnn14(nn.Module):
    def __init__(self) -> None:
        super().__init__()
        self.spectrogram_extractor = Spectrogram(
            n_fft=WINDOW_SIZE,
            hop_length=HOP_SIZE,
            win_length=WINDOW_SIZE,
            window="hann",
            center=True,
            pad_mode="reflect",
            freeze_parameters=True,
        )
        self.logmel_extractor = LogmelFilterBank(
            sr=SAMPLE_RATE,
            n_fft=WINDOW_SIZE,
            n_mels=MEL_BINS,
            fmin=FMIN,
            fmax=FMAX,
            ref=1.0,
            amin=1e-10,
            top_db=None,
            freeze_parameters=True,
        )
        self.bn0 = nn.BatchNorm2d(MEL_BINS)
        self.conv_block1 = ConvBlock(1, 64)
        self.conv_block2 = ConvBlock(64, 128)
        self.conv_block3 = ConvBlock(128, 256)
        self.conv_block4 = ConvBlock(256, 512)
        self.conv_block5 = ConvBlock(512, 1024)
        self.conv_block6 = ConvBlock(1024, 2048)
        self.fc1 = nn.Linear(EMBEDDING_DIM, EMBEDDING_DIM, bias=True)
        self.fc_audioset = nn.Linear(EMBEDDING_DIM, CLASSES_NUM, bias=True)

    def embed(self, waveform: torch.Tensor) -> torch.Tensor:
        """Return the 2048-d clip embedding. Dropout is off in eval mode."""
        x = self.spectrogram_extractor(waveform)
        x = self.logmel_extractor(x)
        x = x.transpose(1, 3)
        x = self.bn0(x)
        x = x.transpose(1, 3)
        x = self._block(self.conv_block1, x, (2, 2), 0.2)
        x = self._block(self.conv_block2, x, (2, 2), 0.2)
        x = self._block(self.conv_block3, x, (2, 2), 0.2)
        x = self._block(self.conv_block4, x, (2, 2), 0.2)
        x = self._block(self.conv_block5, x, (2, 2), 0.2)
        x = self._block(self.conv_block6, x, (1, 1), 0.2)
        x = torch.mean(x, dim=3)
        x = torch.max(x, dim=2).values + torch.mean(x, dim=2)
        if self.training:
            x = F.dropout(x, p=0.5, training=True)
        return F.relu_(self.fc1(x))

    def forward(self, waveform: torch.Tensor) -> dict[str, torch.Tensor]:
        hidden = self.embed(waveform)
        embedding = F.dropout(hidden, p=0.5, training=True) if self.training else hidden
        clipwise_output = torch.sigmoid(self.fc_audioset(hidden))
        return {"clipwise_output": clipwise_output, "embedding": embedding}

    def _block(self, block: ConvBlock, x: torch.Tensor, pool_size: tuple[int, int], dropout: float) -> torch.Tensor:
        x = block(x, pool_size)
        if self.training:
            x = F.dropout(x, p=dropout, training=True)
        return x


class Embedding(nn.Module):
    """ONNX export view: waveform in, 2048-d embedding out."""

    def __init__(self, model: Cnn14) -> None:
        super().__init__()
        self.model = model

    def forward(self, waveform: torch.Tensor) -> torch.Tensor:
        return self.model.embed(waveform)


def load_cnn14(path: Path) -> Cnn14:
    """Load the AudioSet CNN14 checkpoint."""
    import pickle

    path = Path(path)
    if not path.is_file():
        raise Cnn14Error(f"no CNN14 checkpoint at {path}")
    try:
        checkpoint = torch.load(path, map_location="cpu", weights_only=False)
    except (OSError, RuntimeError, pickle.UnpicklingError) as ex:
        raise Cnn14Error(f"could not read {path}: {ex}") from ex
    if isinstance(checkpoint, dict) and "model" in checkpoint:
        state = checkpoint["model"]
    else:
        state = checkpoint
    model = Cnn14()
    try:
        model.load_state_dict(state)
    except (RuntimeError, TypeError) as ex:
        raise Cnn14Error(f"{path} is not a CNN14 checkpoint") from ex
    model.eval()
    return model
