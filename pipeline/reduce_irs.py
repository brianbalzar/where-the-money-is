"""Shrink the IRS SOI ZIP files (~150 MB each) to the columns we use.

Output: data/interim/irs_zip.csv.gz with one row per (year, zip, agi_stub):
    year, zip, stub, n1, a00100, a00300, a00600, a01000
Amounts are in thousands of dollars, as published. ZIP 00000 rows are
state totals (used for the US benchmark); 99999 (pooled small ZIPs) is dropped.

Needs only pandas, so it can run anywhere. Usage: python pipeline/reduce_irs.py
"""
import re
import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
from config import FIRST_YEAR, INTERIM, RAW  # noqa: E402

KEEP = ["zipcode", "agi_stub", "n1", "a00100", "a00300", "a00600", "a01000"]


def reduce_year(path: Path, year: int) -> pd.DataFrame:
    head = pd.read_csv(path, nrows=0, encoding="latin-1")
    cols = {c: c.strip().lower() for c in head.columns}
    use = [c for c in head.columns if cols[c] in KEEP]
    df = pd.read_csv(path, usecols=use, dtype=str, encoding="latin-1").rename(columns=cols)
    missing = set(KEEP) - set(df.columns)
    if missing:
        raise SystemExit(f"{path.name}: missing columns {sorted(missing)}")
    df["zip"] = df.pop("zipcode").str.strip().str.zfill(5)
    # Keep 00000 (each state's total, which includes suppressed ZIPs) for the US
    # benchmark; drop 99999 (pooled small/unlocated ZIPs, already inside 00000).
    df = df[df["zip"] != "99999"]
    for c in KEEP[1:]:
        df[c] = pd.to_numeric(df[c].str.strip(), errors="coerce")
    df = df.rename(columns={"agi_stub": "stub"})
    df.insert(0, "year", year)
    return df[["year", "zip", "stub", "n1", "a00100", "a00300", "a00600", "a01000"]]


def main() -> None:
    files = sorted(RAW.glob("*zpallagi.csv"))
    parts = []
    for f in files:
        m = re.match(r"(\d{2})zpallagi\.csv$", f.name)
        if not m:
            continue
        year = 2000 + int(m.group(1))
        if year < FIRST_YEAR:
            continue
        d = reduce_year(f, year)
        print(f"{year}: {d['zip'].nunique():,} ZIPs, {len(d):,} rows, stubs {sorted(d['stub'].dropna().unique().astype(int))}")
        parts.append(d)
    if not parts:
        raise SystemExit(f"No *zpallagi.csv files in {RAW}")
    INTERIM.mkdir(parents=True, exist_ok=True)
    out = INTERIM / "irs_zip.csv.gz"
    pd.concat(parts).to_csv(out, index=False, compression="gzip")
    print(f"wrote {out} ({out.stat().st_size / 1e6:.1f} MB)")


if __name__ == "__main__":
    main()
