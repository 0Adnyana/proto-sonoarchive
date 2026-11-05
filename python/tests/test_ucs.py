import json

import pytest

from sonoarchive.paths import MANIFEST, PROBE_JSON, UCS_LIST
from sonoarchive.ucs import UCS_COUNT, read_ucs


def test_ucs_v821_list_has_one_row_per_catid() -> None:
    rows = read_ucs(UCS_LIST)
    cat_ids = [row["CatID"] for row in rows]
    assert len(rows) == UCS_COUNT
    assert len(set(cat_ids)) == UCS_COUNT
    assert rows[0]["CatID"] == "AIRBlow"
    assert rows[0]["Category"] == "AIR"
    assert rows[-1]["CatID"] == "WOODTonl"
    assert all(row["explanation"] and row["synonyms"] for row in rows)


def test_fixture_catids_are_in_the_ucs_list() -> None:
    catalog = {row["CatID"] for row in read_ucs(UCS_LIST)}
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    missing = sorted({row["CatID"] for row in manifest["files"]} - catalog)
    assert missing == []


def test_probe_labels_match_the_ucs_list() -> None:
    if not PROBE_JSON.is_file():
        pytest.skip("probe file is not in the checkout")
    document = json.loads(PROBE_JSON.read_text(encoding="utf-8"))
    catalog = {row["CatID"] for row in read_ucs(UCS_LIST)}
    assert set(document["labels"]) == catalog
    assert len(document["labels"]) == UCS_COUNT
