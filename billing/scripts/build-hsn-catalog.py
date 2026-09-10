#!/usr/bin/env python3
"""Build a compact HSN/SAC + GST-rate catalog from the official GSTN workbook.

The GSTN file (tutorial.gst.gov.in HSN_SAC.xlsx) has codes and descriptions only.
Rates are attached from a GST 2.0 (w.e.f. 22 Sep 2025) prefix map: longest matching
heading wins, then a description hint, then the chapter default (usually 18%).
Slabs are snapped to the billing form: 0, 3, 5, 12, 18, 28, 40.

Rates are typical — one HSN can have conditions (value slabs, packaging). Confirm
before issuing a tax invoice.
"""

from __future__ import annotations

import gzip
import json
import re
import sys
from pathlib import Path

from openpyxl import load_workbook

ROOT = Path(__file__).resolve().parents[1]
XLSX = ROOT / "data" / "HSN_SAC.xlsx"
OUT = ROOT / "data" / "hsn-catalog.json.gz"
VERSION = "gstn-hsn-sac-2026-09+gst2.0-v2"

# Longest prefix wins. Values are IGST / total GST %.
RATES: dict[str, int] = {
    # --- goods chapters (2-digit) ---
    "01": 0,
    "02": 0,
    "03": 0,
    "04": 5,
    "05": 5,
    "06": 0,
    "07": 0,
    "08": 5,
    "09": 5,
    "10": 0,
    "11": 5,
    "12": 5,
    "13": 5,
    "14": 5,
    "15": 5,
    "16": 5,
    "17": 5,
    "18": 18,
    "19": 5,
    "20": 5,
    "21": 5,
    "22": 18,
    "23": 5,
    "24": 40,
    "25": 18,
    "26": 18,
    "27": 18,
    "28": 18,
    "29": 18,
    "30": 5,
    "31": 5,
    "32": 18,
    "33": 18,
    "34": 5,
    "35": 18,
    "36": 18,
    "37": 18,
    "38": 18,
    "39": 18,
    "40": 18,
    "41": 5,
    "42": 18,
    "43": 18,
    "44": 18,
    "45": 18,
    "46": 5,
    "47": 18,
    "48": 18,
    "49": 0,
    "50": 5,
    "51": 5,
    "52": 5,
    "53": 5,
    "54": 5,
    "55": 5,
    "56": 5,
    "57": 5,
    "58": 5,
    "59": 5,
    "60": 5,
    "61": 5,
    "62": 5,
    "63": 5,
    "64": 5,
    "65": 18,
    "66": 5,
    "67": 18,
    "68": 18,
    "69": 18,
    "70": 18,
    "71": 3,
    "72": 18,
    "73": 18,
    "74": 18,
    "75": 18,
    "76": 18,
    "78": 18,
    "79": 18,
    "80": 18,
    "81": 18,
    "82": 18,
    "83": 18,
    "84": 18,
    "85": 18,
    "86": 5,
    "87": 18,
    "88": 18,
    "89": 5,
    "90": 18,
    "91": 18,
    "92": 18,
    "93": 18,
    "94": 18,
    "95": 5,
    "96": 18,
    "97": 18,
    "98": 18,
    # --- common goods headings ---
    "0101": 5,  # horses
    "0401": 0,  # milk / cream
    "0403": 0,  # lassi, curd (unpackaged typical)
    "0406": 5,  # cheese
    "0405": 5,  # butter / ghee
    "0901": 5,
    "0902": 5,
    "1704": 18,  # sugar confectionery
    "1806": 18,  # chocolate
    "1905": 18,  # pastry / biscuits
    "2105": 18,  # ice cream
    "2106": 18,
    "2201": 5,  # waters
    "2202": 40,  # aerated / sweetened drinks
    "2203": 40,  # beer
    "2204": 18,  # wine (some 40)
    "2208": 18,
    "2501": 0,  # salt
    "2523": 18,  # cement
    "2710": 18,
    "3002": 5,
    "3003": 5,
    "3004": 5,
    "3006": 5,
    "3303": 18,  # perfumes
    "3304": 18,  # beauty / make-up
    "3305": 5,  # hair preparations (oil/shampoo typical)
    "3306": 5,  # oral / dental
    "3401": 5,  # soap
    "3402": 5,  # washing / cleaning
    "4011": 18,  # tyres
    "4401": 0,  # fuel wood
    "4801": 5,  # newsprint
    "4802": 18,
    "4818": 18,
    "4820": 18,  # registers / diaries
    "482020": 5,  # exercise books
    "4901": 0,
    "4902": 0,
    "4903": 0,
    "4905": 0,
    "7102": 3,  # diamonds (0.25 snapped)
    "7106": 3,
    "7108": 3,
    "7113": 3,
    "7114": 3,
    "7117": 3,
    "8418": 18,  # refrigerators
    "8415": 18,  # air conditioners
    "8440": 5,  # book-binding / sewing (non-industrial typical)
    "8452": 5,  # sewing machines
    "8471": 18,  # computers
    "8517": 18,  # phones
    "8528": 18,  # monitors / TVs
    "8703": 18,  # cars (luxury may be 40)
    "8704": 18,
    "8708": 18,
    "8711": 18,  # motorcycles
    "9001": 18,
    "9018": 5,  # medical instruments
    "9019": 5,
    "9021": 5,
    "9022": 5,
    "9403": 18,
    "9619": 5,  # sanitary towels
    # --- services (chapter 99) ---
    "99": 18,
    "9954": 18,  # construction
    "9963": 5,  # accommodation / food / beverage
    "9964": 5,  # passenger transport
    "9965": 5,  # freight transport
    "9966": 18,  # rental of transport
    "9967": 18,  # supporting transport
    "9968": 18,  # postal / courier
    "9969": 18,  # electricity / gas / water distribution
    "9971": 18,  # financial / insurance
    "9972": 18,  # real estate
    "9973": 18,  # leasing
    "9981": 18,  # R&D
    "9982": 18,  # legal / accounting
    "9983": 18,  # other professional / IT
    "9984": 18,  # telecom
    "9985": 18,  # support services
    "9986": 0,  # support to agriculture (often nil)
    "9987": 18,  # maintenance / repair
    "9988": 18,  # manufacturing services
    "9989": 18,  # publishing / printing
    "9991": 0,  # public administration
    "9992": 0,  # education
    "9993": 0,  # human health
    "9994": 18,  # sewage / waste
    "9995": 18,  # membership
    "9996": 18,  # rec / cultural / sporting
    "9997": 18,  # other services
    "9998": 18,  # domestic services
    "9999": 18,
}

DESC_RULES: list[tuple[re.Pattern[str], int]] = [
    (re.compile(r"\b(TOBACCO|CIGARETTE|CIGAR|BIDI|BEEDI|GUTKHA|PAN MASALA)\b"), 40),
    (re.compile(r"\b(AERATED|CAFFEINATED DRINK|CARBONATED)\b"), 40),
    (re.compile(r"\b(JEWELLERY|JEWELRY|GOLD|SILVER|PLATINUM|PRECIOUS METAL)\b"), 3),
    (re.compile(r"\b(MEDICAMENT|VACCINE|PHARMACEUTICAL|IMMUNOLOGICAL)\b"), 5),
    (re.compile(r"\b(FERTILISER|FERTILIZER)\b"), 5),
    (re.compile(r"\b(PRINTED BOOKS?|NEWSPAPER|JOURNAL|PERIODICAL|MAPS?|ATLASES)\b"), 0),
    (re.compile(r"\b(EXERCISE BOOK|NOTE[- ]?BOOKS?)\b"), 5),
    (re.compile(r"\b(HUMAN HEALTH|HOSPITAL|CLINICAL|MEDICAL CARE|DIAGNOSTIC)\b"), 0),
    (re.compile(r"\b(EDUCATION|SCHOOL|UNIVERSITY|COLLEGE|COACHING)\b"), 0),
    (re.compile(r"\b(FRESH MILK|PASTEURISED MILK|UHT MILK)\b"), 0),
    (re.compile(r"\b(RICE|WHEAT|MAIZE|JOWAR|BAJRA|CEREALS)\b"), 0),
    (re.compile(r"\bSALT\b"), 0),
]


def norm_code(value: object) -> str | None:
    if value is None:
        return None
    if isinstance(value, float) and value.is_integer():
        value = int(value)
    text = str(value).strip().upper().replace(" ", "")
    if text.endswith(".0"):
        text = text[:-2]
    text = "".join(ch for ch in text if ch.isalnum())
    return text or None


def rate_for(code: str, description: str, kind: str) -> int:
    for n in range(len(code), 3, -1):
        hit = RATES.get(code[:n])
        if hit is not None:
            return hit
    upper = description.upper()
    for pattern, gst in DESC_RULES:
        if pattern.search(upper):
            return gst
    if len(code) >= 2:
        hit = RATES.get(code[:2])
        if hit is not None:
            return hit
    return 18 if kind == "service" else 18


def rows_from_sheet(ws, code_idx: int, desc_idx: int, kind: str) -> list[dict]:
    out: list[dict] = []
    seen: set[str] = set()
    for i, row in enumerate(ws.iter_rows(values_only=True)):
        if i == 0:
            continue
        code = norm_code(row[code_idx] if row else None)
        desc = str(row[desc_idx] or "").strip() if row and len(row) > desc_idx else ""
        if not code or code in seen:
            continue
        seen.add(code)
        out.append(
            {
                "c": code,
                "d": desc[:400],
                "t": "s" if kind == "service" else "g",
                "r": rate_for(code, desc, kind),
            }
        )
    return out


def main() -> int:
    if not XLSX.exists():
        print(f"missing official workbook: {XLSX}", file=sys.stderr)
        return 1
    wb = load_workbook(XLSX, read_only=True, data_only=True)
    try:
        goods = rows_from_sheet(wb["HSN_MSTR"], 0, 1, "goods")
        services = rows_from_sheet(wb["SAC_MSTR"], 0, 1, "service")
    finally:
        wb.close()
    catalog = {
        "version": VERSION,
        "source": "GSTN HSN_SAC.xlsx (codes/descriptions) + GST 2.0 typical rates",
        "items": goods + services,
    }
    payload = json.dumps(catalog, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    OUT.write_bytes(gzip.compress(payload, compresslevel=9))
    checks = {
        "1006": 0,
        "0401": 0,
        "3004": 5,
        "4901": 0,
        "7113": 3,
        "8517": 18,
        "2202": 40,
        "9992": 0,
        "9983": 18,
        "9964": 5,
    }
    by_code = {row["c"]: row["r"] for row in catalog["items"]}
    for code, expected in checks.items():
        actual = by_code.get(code)
        if actual != expected:
            print(f"rate check failed {code}: got {actual} want {expected}", file=sys.stderr)
            return 1
    print(f"wrote {OUT} ({len(goods)} HSN, {len(services)} SAC, {OUT.stat().st_size} bytes)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
