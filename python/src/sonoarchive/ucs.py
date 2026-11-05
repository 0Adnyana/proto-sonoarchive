"""Read the UCS v8.2.1 category list.

The workbook is the source for the ``ucs`` table: one row per CatID, with
Category, SubCategory, explanation, and synonyms. UCS v8.2.1 has 753 CatIDs.
"""

import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

_MAIN = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
_NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
_HEADER = {
    "A": "Category",
    "B": "SubCategory",
    "C": "CatID",
    "D": "CatShort",
    "E": "Explanations",
    "F": "Synonyms - Comma Separated",
}
UCS_COUNT = 753


class UcsError(Exception):
    """The UCS workbook cannot be used."""


def read_ucs(path: Path) -> list[dict[str, str]]:
    """Load UCS rows in workbook order."""
    path = Path(path)
    try:
        archive = zipfile.ZipFile(path)
    except (OSError, zipfile.BadZipFile) as ex:
        raise UcsError(f"could not read {path}: {ex}") from ex
    with archive:
        try:
            strings = _shared_strings(archive)
            sheet = ET.fromstring(archive.read("xl/worksheets/sheet1.xml"))
        except KeyError as ex:
            raise UcsError(f"{path} is not the UCS workbook") from ex
    rows = _rows(sheet, strings)
    header_at = next(
        (index for index, row in enumerate(rows) if row.get("C") == "CatID"),
        None,
    )
    if header_at is None:
        raise UcsError(f"{path} has no CatID header")
    header = rows[header_at]
    for column, name in _HEADER.items():
        if header.get(column) != name:
            raise UcsError(f"{path} column {column} is {header.get(column)!r}, expected {name}")
    records = []
    for row in rows[header_at + 1 :]:
        cat_id = row.get("C")
        if not cat_id:
            continue
        record = {
            "Category": row.get("A", ""),
            "SubCategory": row.get("B", ""),
            "CatID": cat_id,
            "CatShort": row.get("D", ""),
            "explanation": row.get("E", ""),
            "synonyms": row.get("F", ""),
        }
        if any(not value for value in record.values()):
            raise UcsError(f"{path} row for {cat_id} is missing a field")
        records.append(record)
    cat_ids = [row["CatID"] for row in records]
    if len(cat_ids) != len(set(cat_ids)):
        raise UcsError(f"{path} has duplicate CatIDs")
    if len(records) != UCS_COUNT:
        raise UcsError(f"{path} has {len(records)} CatIDs, expected {UCS_COUNT}")
    return records


def _shared_strings(archive: zipfile.ZipFile) -> list[str]:
    root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
    strings = []
    for item in root.findall("m:si", _NS):
        strings.append("".join(node.text or "" for node in item.iter(f"{_MAIN}t")))
    return strings


def _rows(sheet: ET.Element, strings: list[str]) -> list[dict[str, str]]:
    parsed = []
    for row in sheet.findall("m:sheetData/m:row", _NS):
        values: dict[str, str] = {}
        for cell in row.findall("m:c", _NS):
            column = "".join(ch for ch in cell.attrib.get("r", "") if ch.isalpha())
            value = _cell_text(cell, strings)
            if column and value:
                values[column] = value
        parsed.append(values)
    return parsed


def _cell_text(cell: ET.Element, strings: list[str]) -> str:
    node = cell.find("m:v", _NS)
    if node is None or node.text is None:
        return ""
    if cell.attrib.get("t") == "s":
        return strings[int(node.text)]
    return node.text
