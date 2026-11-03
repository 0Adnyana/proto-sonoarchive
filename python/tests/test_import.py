import pytest

import sonoarchive
from sonoarchive.retrain import retrain


def test_import() -> None:
    assert sonoarchive.__version__ == "0.0.0"


def test_retrain_is_not_implemented() -> None:
    with pytest.raises(NotImplementedError):
        retrain()
