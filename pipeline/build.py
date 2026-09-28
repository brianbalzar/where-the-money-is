"""Build the per-metro data files the site reads.

Inputs (data/raw, fetched by scripts/download-data.ps1) and data/interim/irs_zip.csv.gz
(from reduce_irs.py). Outputs to public/data:

    metros.json
    {cbsa}/data.json       values, bins, centers, finding
    {cbsa}/zctas.geojson   simplified 2020 ZCTA polygons (property: zcta)

Usage:  python pipeline/build.py            (metros per config.METROS)
        python pipeline/build.py 19100      (just these CBSA codes)
"""
from __future__ import annotations

import io
import json
import math
import sys
import zipfile
from datetime import date
from pathlib import Path

import geopandas as gpd
import numpy as np
import pandas as pd
import shapely

sys.path.insert(0, str(Path(__file__).resolve().parent))
import config as C  # noqa: E402
from reduce_irs import main as reduce_irs_main  # noqa: E402

R_MI = 3958.7613
COMPASS = ["north", "north-northeast", "northeast", "east-northeast", "east", "east-southeast",
           "southeast", "south-southeast", "south", "south-southwest", "southwest", "west-southwest",
           "west", "west-northwest", "northwest", "north-northwest"]


# ----------------------------------------------------------------------------- geometry helpers
def haversine_mi(lat1, lon1, lat2, lon2) -> float:
    r = math.pi / 180
    a = math.sin((lat2 - lat1) * r / 2) ** 2 + math.cos(lat1 * r) * math.cos(lat2 * r) * math.sin((lon2 - lon1) * r / 2) ** 2
    return 2 * R_MI * math.asin(min(1.0, math.sqrt(a)))


def bearing16(lat1, lon1, lat2, lon2) -> str:
    r = math.pi / 180
    y = math.sin((lon2 - lon1) * r) * math.cos(lat2 * r)
    x = math.cos(lat1 * r) * math.sin(lat2 * r) - math.sin(lat1 * r) * math.cos(lat2 * r) * math.cos((lon2 - lon1) * r)
    deg = (math.degrees(math.atan2(y, x)) + 360) % 360
    return COMPASS[round(deg / 22.5) % 16]


def weighted_center(lat: np.ndarray, lon: np.ndarray, w: np.ndarray) -> tuple[float, float]:
    """Weighted mean on the sphere (via 3-D unit vectors)."""
    w = np.clip(np.nan_to_num(w, nan=0.0), 0, None)
    if w.sum() <= 0:
        return float("nan"), float("nan")
    la, lo = np.radians(lat), np.radians(lon)
    x = (w * np.cos(la) * np.cos(lo)).sum()
    y = (w * np.cos(la) * np.sin(lo)).sum()
    z = (w * np.sin(la)).sum()
    return float(np.degrees(math.atan2(z, math.hypot(x, y)))), float(np.degrees(math.atan2(y, x)))


# ----------------------------------------------------------------------------- loaders
def load_delineation() -> pd.DataFrame:
    df = pd.read_excel(C.RAW / "list1_2023.xlsx", header=2, dtype=str)
    df = df.rename(columns=lambda c: str(c).strip())
    df = df[df["CBSA Code"].notna() & df["FIPS State Code"].notna()]
    df = df[df["Metropolitan/Micropolitan Statistical Area"].str.startswith("Metropolitan")]
    df["county"] = df["FIPS State Code"].str.zfill(2) + df["FIPS County Code"].str.zfill(3)
    return df[["CBSA Code", "CBSA Title", "county", "State Name"]].rename(columns={"CBSA Code": "cbsa", "CBSA Title": "title"})


def load_bg() -> pd.DataFrame:
    bg = pd.read_csv(C.RAW / "CenPop2020_Mean_BG.txt", dtype={"STATEFP": str, "COUNTYFP": str}, encoding="utf-8-sig")
    bg.columns = [c.strip().upper() for c in bg.columns]
    bg["county"] = bg["STATEFP"].str.zfill(2) + bg["COUNTYFP"].str.zfill(3)
    # Connecticut: the 2023 metro definitions use planning regions (09110-09190) instead of
    # the old counties the 2020 files carry. Re-assign CT block groups by location.
    cf = C.RAW / "cb_2023_us_county_500k.zip"
    ct = bg["STATEFP"].str.zfill(2) == "09"
    if ct.any():
        if not cf.exists():
            print("  ! cb_2023_us_county_500k.zip missing: Connecticut metros will be skipped")
        else:
            cty = gpd.read_file(f"zip://{cf}")
            cty = cty[cty["STATEFP"] == "09"][["GEOID", "geometry"]].to_crs(4326)
            p = gpd.GeoDataFrame(bg.loc[ct, ["LONGITUDE", "LATITUDE"]],
                                 geometry=gpd.points_from_xy(bg.loc[ct, "LONGITUDE"], bg.loc[ct, "LATITUDE"]), crs=4326)
            j = gpd.sjoin_nearest(p.to_crs(5070), cty.to_crs(5070), how="left")
            j = j[~j.index.duplicated()]
            bg.loc[ct, "county"] = j["GEOID"].values
            print(f"  Connecticut: {ct.sum():,} block groups re-assigned to {j['GEOID'].nunique()} planning regions")
    return bg[["county", "POPULATION", "LATITUDE", "LONGITUDE"]].rename(
        columns={"POPULATION": "pop", "LATITUDE": "lat", "LONGITUDE": "lon"})


def load_zcta() -> gpd.GeoDataFrame:
    z = gpd.read_file(f"zip://{C.RAW / 'cb_2020_us_zcta520_500k.zip'}")
    col = [c for c in z.columns if c.upper().startswith("ZCTA5CE")][0]
    return z[[col, "geometry"]].rename(columns={col: "zcta"}).to_crs(4326)


def load_gazetteer() -> pd.DataFrame:
    with zipfile.ZipFile(C.RAW / "2020_Gaz_zcta_national.zip") as zf:
        name = [n for n in zf.namelist() if n.endswith(".txt")][0]
        g = pd.read_csv(io.BytesIO(zf.read(name)), sep="\t", dtype={"GEOID": str})
    g.columns = [c.strip() for c in g.columns]
    return g[["GEOID", "INTPTLAT", "INTPTLONG", "ALAND_SQMI"]].rename(
        columns={"GEOID": "zcta", "INTPTLAT": "glat", "INTPTLONG": "glon", "ALAND_SQMI": "sqmi"})


def load_geonames() -> pd.DataFrame:
    with zipfile.ZipFile(C.RAW / "geonames_US.zip") as zf:
        g = pd.read_csv(io.BytesIO(zf.read("US.txt")), sep="\t", header=None, dtype={1: str},
                        names=["cc", "zip", "place", "state", "st", "a2", "a2c", "a3", "a3c", "lat", "lon", "acc"])
    return g[["zip", "place", "st", "lat", "lon"]]


def load_places() -> pd.DataFrame | None:
    p = C.RAW / "tab20_zcta520_place20_natl.txt"
    if not p.exists():
        return None
    df = pd.read_csv(p, sep="|", dtype=str, encoding="utf-8-sig")
    df.columns = [c.strip() for c in df.columns]
    zc = [c for c in df.columns if c.startswith("GEOID_ZCTA5")][0]
    nm = [c for c in df.columns if c.startswith("NAMELSAD_PLACE")][0]
    ar = [c for c in df.columns if c.startswith("AREALAND_PART")][0]
    arz = [c for c in df.columns if c.startswith("AREALAND_ZCTA5")][0]
    df = df[df[zc].notna() & df[nm].notna()].copy()
    df["part"] = pd.to_numeric(df[ar], errors="coerce")
    df["zarea"] = pd.to_numeric(df[arz], errors="coerce")
    df = df.sort_values("part", ascending=False).drop_duplicates(zc)
    df["name"] = (df[nm]
                  .str.replace(r"\s*\(balance\)", "", regex=True)
                  .str.replace(r"\s+(metropolitan|metro|unified|consolidated) government", "", regex=True)
                  .str.replace(r" (city|town|village|CDP|borough|municipality|township)$", "", regex=True)
                  .str.replace(r"^(Nashville)-Davidson$", r"\1", regex=True)
                  .str.replace(r"^Louisville/Jefferson County$", "Louisville", regex=True)
                  .str.replace(r"^Urban Honolulu$", "Honolulu", regex=True))
    # Only use the place name when the place covers a meaningful part of the ZCTA
    df = df[df["part"] >= 0.2 * df["zarea"]]
    return df[[zc, "name"]].rename(columns={zc: "zcta"})


def load_pop_ranks(deln: pd.DataFrame, bg_pop_by_cbsa: pd.Series) -> tuple[pd.Series, int]:
    p = C.RAW / "cbsa-est-alldata.csv"
    if p.exists():
        df = pd.read_csv(p, dtype=str, encoding="latin-1")
        df = df[df["LSAD"].str.contains("Metropolitan Statistical Area", na=False)]
        col = sorted([c for c in df.columns if c.startswith("POPESTIMATE") and c[11:].isdigit()])[-1]
        s = pd.to_numeric(df.set_index("CBSA")[col])
        s = s[s.index.isin(deln["cbsa"].unique())]
        return s, int(col[11:])
    print("  (no Census estimates file; ranking by 2020 census population)")
    return bg_pop_by_cbsa, 2020


def load_cpi() -> dict[int, float]:
    cpi = dict(C.CPI_U)
    p = C.RAW / "CPIAUCNS.csv"
    if p.exists():
        df = pd.read_csv(p)
        df.columns = ["date", "v"]
        df["v"] = pd.to_numeric(df["v"], errors="coerce")
        df["year"] = pd.to_datetime(df["date"]).dt.year
        ann = df.groupby("year")["v"].agg(["mean", "count"])
        for y, r in ann.iterrows():
            if r["count"] == 12:
                if y in cpi and abs(cpi[y] - r["mean"]) > 0.02:
                    print(f"  ! CPI {y}: config {cpi[y]} vs FRED {r['mean']:.3f} — using FRED")
                if y >= C.FIRST_YEAR:
                    cpi[int(y)] = round(float(r["mean"]), 3)
    return cpi


# ----------------------------------------------------------------------------- ZCTA points + counties
def zcta_pop2010(zcta: gpd.GeoDataFrame) -> pd.Series:
    """2010 population inside each 2020 ZCTA (2010 block-group centers of population)."""
    b = pd.read_csv(C.RAW / "CenPop2010_Mean_BG.txt", encoding="utf-8-sig")
    b.columns = [c.strip().upper() for c in b.columns]
    pts = gpd.GeoDataFrame(b[["POPULATION"]], geometry=gpd.points_from_xy(b["LONGITUDE"], b["LATITUDE"]), crs=4326)
    j = gpd.sjoin(pts, zcta[["zcta", "geometry"]], predicate="within", how="inner")
    return j.groupby("zcta")["POPULATION"].sum()


def zcta_points(zcta: gpd.GeoDataFrame, bg: pd.DataFrame, gaz: pd.DataFrame) -> pd.DataFrame:
    """Population-weighted point and majority county for every ZCTA."""
    pts = gpd.GeoDataFrame(bg, geometry=gpd.points_from_xy(bg["lon"], bg["lat"]), crs=4326)
    j = gpd.sjoin(pts, zcta[["zcta", "geometry"]], predicate="within", how="inner")
    j = j[j["pop"] > 0]
    rows = []
    for z, g in j.groupby("zcta"):
        la, lo = weighted_center(g["lat"].values, g["lon"].values, g["pop"].values.astype(float))
        county = g.groupby("county")["pop"].sum().idxmax()
        rows.append((z, la, lo, county, int(g["pop"].sum())))
    out = pd.DataFrame(rows, columns=["zcta", "lat", "lon", "county", "pop"])
    # ZCTAs holding no block-group center: gazetteer internal point + nearest block group's county
    rest = zcta[~zcta["zcta"].isin(out["zcta"])][["zcta"]].merge(gaz, on="zcta", how="left")
    if len(rest):
        rp = gpd.GeoDataFrame(rest, geometry=gpd.points_from_xy(rest["glon"], rest["glat"]), crs=4326).to_crs(5070)
        near = gpd.sjoin_nearest(rp, pts.to_crs(5070)[["county", "geometry"]], how="left").drop_duplicates("zcta")
        rest = pd.DataFrame({"zcta": near["zcta"], "lat": near["glat"], "lon": near["glon"], "county": near["county"], "pop": 0})
        out = pd.concat([out, rest], ignore_index=True)
    return out


def zip_to_zcta(irs_zips: set[str], zcta: gpd.GeoDataFrame, geon: pd.DataFrame) -> tuple[dict[str, str], set[str]]:
    """Map every IRS ZIP to a ZCTA. PO-box/unique ZIPs use their GeoNames point."""
    zset = set(zcta["zcta"])
    m = {z: z for z in irs_zips if z in zset}
    other = sorted(irs_zips - zset)
    po: set[str] = set()
    g = geon[geon["zip"].isin(other)].dropna(subset=["lat", "lon"])
    if len(g):
        gp = gpd.GeoDataFrame(g, geometry=gpd.points_from_xy(g["lon"], g["lat"]), crs=4326).to_crs(5070)
        zc = zcta.to_crs(5070)
        near = gpd.sjoin_nearest(gp, zc[["zcta", "geometry"]], how="left", max_distance=8000, distance_col="d")
        near = near.dropna(subset=["zcta"]).drop_duplicates("zip")
        for zp, zt in zip(near["zip"], near["zcta"]):
            m[zp] = zt
            po.add(zp)
    unmatched = [z for z in other if z not in m]
    print(f"  IRS ZIPs: {len(irs_zips):,}; direct ZCTA {len(irs_zips) - len(other):,}; "
          f"PO-box/unique reassigned {len(po):,}; unplaced {len(unmatched):,}")
    return m, po


# ----------------------------------------------------------------------------- bins
def nice_round(v: float) -> float:
    if v < 1000:
        return round(v / 50) * 50
    if v < 10_000:
        return round(v / 100) * 100
    if v < 100_000:
        return round(v / 1000) * 1000
    return round(v / 5000) * 5000


def merge_empty(breaks: list[float], vals: np.ndarray, outlier_min: float | None) -> list[float]:
    """Drop any edge that would leave a bin empty (including one at/below the minimum)."""
    lo = float(vals.min())
    b = [breaks[0]] + [e for e in breaks[1:] if e > lo]
    changed = True
    while changed and len(b) > 1:
        changed = False
        for i in range(len(b)):
            hi = b[i + 1] if i + 1 < len(b) else (outlier_min if outlier_min is not None else math.inf)
            cnt = int(((vals >= b[i]) & (vals < hi)).sum()) if i + 1 < len(b) else int(((vals >= b[i]) & (vals <= hi)).sum())
            if cnt == 0:
                del b[i if i > 0 else 1]
                changed = True
                break
    return b


def quantile_bins(vals: np.ndarray, places: dict[str, str], zips: list[str], outliers_on: bool = True,
                  rounder=nice_round) -> dict:
    vals = np.asarray(vals, float)
    q1, q3 = np.percentile(vals, [25, 75])
    fence = q3 + C.OUTLIER_IQR_K * (q3 - q1)
    order = np.argsort(-vals)
    n_out = int((vals > fence).sum())
    cap = int(math.floor(C.OUTLIER_MAX_SHARE * len(vals)))
    n_out = min(n_out, cap) if outliers_on else 0
    outlier_min = None
    outliers = []
    if n_out > 0:
        # threshold = the largest value that is NOT an outlier
        outlier_min = float(vals[order[n_out]])
        outliers = [{"zcta": zips[i], "place": places.get(zips[i], ""), "value": round(float(vals[i]), 1)} for i in order[:n_out]]
    core = vals[vals <= outlier_min] if outlier_min is not None else vals
    qs = np.quantile(core, np.linspace(0, 1, C.N_BINS + 1)[1:-1])
    floor = math.floor(core.min() / 100) * 100 if core.min() >= 1000 else math.floor(core.min())
    edges = sorted({rounder(q) for q in qs})
    breaks = merge_empty([float(floor)] + [float(e) for e in edges if e > floor], core, outlier_min)
    return {"breaks": breaks, "outlierMin": outlier_min, "outliers": outliers}


def share_bins(vals: np.ndarray) -> dict:
    vals = np.asarray(vals, float)
    top = math.ceil(vals.max() / 5) * 5
    raw = top / C.N_BINS
    step = next(s for s in [1, 2, 2.5, 5, 10, 15, 20] if s >= raw)
    breaks = [round(i * step, 1) for i in range(C.N_BINS)]
    breaks = merge_empty(breaks, vals, None)
    return {"breaks": breaks, "outlierMin": None, "outliers": []}


def bin_counts(vals: np.ndarray, b: dict) -> list[int]:
    br, om = b["breaks"], b["outlierMin"]
    out = []
    for i in range(len(br)):
        hi = br[i + 1] if i + 1 < len(br) else (om if om is not None else math.inf)
        m = (vals >= br[i]) & ((vals < hi) if i + 1 < len(br) else (vals <= hi))
        if i == 0:
            m = m | (vals < br[0])
        out.append(int(m.sum()))
    if om is not None:
        out.append(int((vals > om).sum()))
    return out


# ----------------------------------------------------------------------------- new-ZIP imputation
def impute_new_zips(a: pd.DataFrame, mz: pd.DataFrame, zcta: gpd.GeoDataFrame, years: list[int]) -> tuple[pd.DataFrame, dict]:
    """Estimate ZCTAs that are populated but never appear in the IRS file.

    USPS creates new ZIPs by splitting old ones. The IRS ZIP file does not list
    them; their filers go to the state's pooled 99999 row, and the parent ZIP
    shows a sudden one-year drop in returns. For each such child:

      pop_c(y)   child population, linear between the 2010 and 2020 censuses
                 (2010 = block-group centers of population inside the 2020 ZCTA),
                 extrapolated on the same slope after 2020
      E_c(y)     = pop_c(y) x parent returns per resident (post-drop average)
                   x metro returns-per-resident index (2020 = 1)
      from the drop year D on, the child gets E_c(y)
      before D, part of the child's filers were still counted in the parent.
                 That part, f = parent's drop / sum of its children's E(D-1), is
                 left in the parent; the child gets E_c(y) x (1 - f).
      per-return values (average income, capital income, $200K+ share) = parent's.

    This keeps the family total continuous through D, so the trail does not jump.
    """
    have = set(a.loc[a["ret"] > 0, "zcta"])
    pop20 = mz.set_index("zcta")["pop"].astype(float)
    pop10 = mz.set_index("zcta")["pop10"].astype(float)
    cand = [z for z in mz["zcta"] if z not in have and pop20.get(z, 0) >= C.IMPUTE_MIN_POP]
    if not cand:
        return a, {}

    def pop_at(z: str, y: int) -> float:
        return max(0.0, pop10[z] + (pop20[z] - pop10[z]) * (y - 2010) / 10)

    geo = zcta[zcta["zcta"].isin(mz["zcta"])].set_index("zcta").to_crs(5070)
    rets = a.pivot_table(index="zcta", columns="year", values="ret", aggfunc="sum")
    metro_ret = a.groupby("year")["ret"].sum()
    mp10, mp20 = pop10.sum(), pop20.sum()
    metro_rpc = {y: metro_ret.get(y, np.nan) / (mp10 + (mp20 - mp10) * (y - 2010) / 10) for y in years}
    idx = {y: metro_rpc[y] / metro_rpc[2020] if 2020 in metro_rpc else 1.0 for y in years}

    parents: dict[str, tuple[str, int, float]] = {}
    report = []
    for c in cand:
        if c not in geo.index:
            continue
        nb = geo[geo.geometry.intersects(geo.at[c, "geometry"].buffer(50))].index.difference([c])
        best = None
        for p in nb:
            if p not in rets.index or pop20.get(p, 0) <= 0:
                continue
            r = rets.loc[p]
            for i in range(1, len(years)):
                prev, cur = r.get(years[i - 1]), r.get(years[i])
                if pd.notna(prev) and pd.notna(cur) and prev >= 2000 and cur / prev <= 1 - C.IMPUTE_MIN_DROP:
                    drop = 1 - cur / prev
                    if best is None or drop > best[2]:
                        best = (p, years[i], drop)
        if best is None:
            report.append((c, int(pop20[c]), int(pop10[c]), "", "", "", "", "no parent drop found; left as no data"))
            continue
        parents[c] = best

    new_rows, est = [], {}
    by_parent: dict[str, list[str]] = {}
    for c, (p, d, _) in parents.items():
        by_parent.setdefault(p, []).append(c)
    for p, kids in by_parent.items():
        d = parents[kids[0]][1]
        pa = a[a["zcta"] == p].set_index("year")
        post = [y for y in years if y >= d and y in pa.index]
        rpr = float(np.mean([pa.at[y, "ret"] / pop_at(p, y) for y in post]))  # parent returns per resident
        E = {c: {y: pop_at(c, y) * rpr * idx[y] for y in years} for c in kids}
        lost = max(0.0, float(pa.at[d - 1, "ret"] - pa.at[d, "ret"])) if (d - 1) in pa.index else 0.0
        denom = sum(E[c][d - 1] for c in kids) if d - 1 in years else 0
        f = min(1.0, lost / denom) if denom > 0 else 0.0
        for c in kids:
            for y in years:
                if y not in pa.index or pa.at[y, "ret"] <= 0:
                    continue
                n = E[c][y] * (1.0 if y >= d else (1.0 - f))
                if n < 1:
                    continue
                q = pa.loc[y]
                k = n / q["ret"]
                new_rows.append({"zcta": c, "year": y, "ret": round(n), "agi": q["agi"] * k,
                                 "cap": q["cap"] * k, "n200": q["n200"] * k, "po": False})
            est[c] = {"from": p, "since": int(d)}
            report.append((c, int(pop20[c]), int(pop10[c]), p, d, round(parents[c][2], 3), round(f, 3), "estimated"))
    for row in report:
        print(f"   impute {row[0]} pop2020 {row[1]:>6} pop2010 {row[2]:>6} parent {row[3]} since {row[4]} "
              f"drop {row[5]} in-parent share {row[6]}: {row[7]}")
    _IMPUTE_LOG.extend(report)
    if new_rows:
        a = pd.concat([a, pd.DataFrame(new_rows)], ignore_index=True)
    return a, est


_IMPUTE_LOG: list[tuple] = []


# ----------------------------------------------------------------------------- main build
def short_name(cbsa: str, title: str) -> str:
    if cbsa in C.SHORT_NAMES:
        return C.SHORT_NAMES[cbsa]
    cities = title.split(",")[0].split("-")
    return "–".join(cities[:2])


_COUNTIES: gpd.GeoDataFrame | None = None


def write_counties(cbsa: str, deln_rows: pd.DataFrame) -> None:
    """Outline of each county in the metro (2023 boundaries, so Connecticut planning regions work)."""
    global _COUNTIES
    cf = C.RAW / "cb_2023_us_county_500k.zip"
    if not cf.exists():
        return
    if _COUNTIES is None:
        _COUNTIES = gpd.read_file(f"zip://{cf}")[["GEOID", "NAME", "NAMELSAD", "STUSPS", "geometry"]].to_crs(4326)
    c = _COUNTIES[_COUNTIES["GEOID"].isin(set(deln_rows["county"]))].copy().reset_index(drop=True)
    if c.empty:
        return
    c["geometry"] = shapely.set_precision(shapely.coverage_simplify(c.geometry.values, tolerance=C.SIMPLIFY_TOL * 1.5), 1e-4)
    multi_state = c["STUSPS"].nunique() > 1
    def label(r):
        n = r["NAMELSAD"].replace(" County", " Co.").replace(" Planning Region", " Region").replace(" Parish", " Par.")
        return f"{n}, {r['STUSPS']}" if multi_state else n
    c["name"] = c.apply(label, axis=1)
    gj = json.loads(c[["GEOID", "name", "geometry"]].rename(columns={"GEOID": "id"}).to_json(drop_id=True))
    for f in gj["features"]:
        f["geometry"] = _round_geom(f["geometry"])
    (C.OUT / cbsa / "counties.geojson").write_text(json.dumps(gj, separators=(",", ":")))


def check_cbd(cbsa: str, zcta: gpd.GeoDataFrame) -> dict | None:
    """Return the configured CBD, after checking it sits in (or within 0.5 mi of) its named ZIP."""
    c = C.CBD.get(cbsa)
    if not c:
        print(f"   ! no CBD configured for {cbsa}")
        return None
    g = zcta.set_index("zcta")
    if c["zip"] not in g.index:
        raise SystemExit(f"CBD {c['name']}: ZIP {c['zip']} is not a 2020 ZCTA")
    pt = gpd.GeoSeries([shapely.Point(c["lon"], c["lat"])], crs=4326).to_crs(5070).iloc[0]
    d_mi = g.loc[[c["zip"]]].to_crs(5070).geometry.iloc[0].distance(pt) / 1609.344
    if d_mi > 2:
        raise SystemExit(f"CBD {c['name']} is {d_mi:.1f} mi from ZIP {c['zip']} - check the coordinates")
    if d_mi > 0.5:
        print(f"   ! CBD {c['name']} is {d_mi:.1f} mi from ZIP {c['zip']}")
    return {"name": c["name"], "lat": c["lat"], "lon": c["lon"]}


def principal_cities(title: str) -> list[str]:
    out = []
    for c in title.split(",")[0].replace("--", "-").split("-"):
        c = c.split("/")[0].strip()
        if c and c not in out:
            out.append(c)
    return out


def _norm_place(n: str) -> str:
    n = n.lower().replace("saint ", "st. ").replace("st ", "st. ")
    return n.replace(" city", "").strip()


def auto_landmarks(title: str, mz: pd.DataFrame, name_map: dict[str, str], n: int = 5, min_sep_mi: float = 7.0) -> list[dict]:
    """Principal cities from the CBSA title, then the most populous other places in the metro,
    each placed at the population center of its ZCTAs and kept >= min_sep_mi apart."""
    m = mz.copy()
    m["place"] = m["zcta"].map(name_map).fillna("")
    m = m[(m["place"] != "") & (m["pop"] > 0)]
    by_place = {}
    for pl, g in m.groupby("place"):
        la, lo = weighted_center(g["lat"].values, g["lon"].values, g["pop"].values.astype(float))
        by_place[pl] = (int(g["pop"].sum()), la, lo)
    order = []
    for c in principal_cities(title):
        hit = [p for p in by_place if _norm_place(p) == _norm_place(c)]
        if hit:
            order.append(hit[0])
    order += [p for p, _ in sorted(by_place.items(), key=lambda kv: -kv[1][0]) if p not in order]
    out: list[dict] = []
    for pl in order:
        _, la, lo = by_place[pl]
        if all(haversine_mi(la, lo, o["lat"], o["lon"]) >= min_sep_mi for o in out):
            out.append({"name": pl, "lat": round(la, 4), "lon": round(lo, 4)})
        if len(out) >= n:
            break
    return out


def main(argv: list[str]) -> None:
    irs_path = C.INTERIM / "irs_zip.csv.gz"
    if not irs_path.exists():
        print("reducing IRS files…")
        reduce_irs_main()
    print("loading inputs…")
    irs = pd.read_csv(irs_path, dtype={"zip": str})
    years = sorted(irs["year"].unique().tolist())
    dollar_year = years[-1]
    cpi = load_cpi()
    missing_cpi = [y for y in years if y not in cpi]
    if missing_cpi:
        raise SystemExit(f"CPI missing for {missing_cpi}; add to config.CPI_U")
    deflate = {y: cpi[dollar_year] / cpi[y] for y in years}

    deln = load_delineation()
    bg = load_bg()
    zcta = load_zcta()
    gaz = load_gazetteer()
    geon = load_geonames()
    places = load_places()
    print(f"  years {years[0]}–{years[-1]}, {len(zcta):,} ZCTAs, {len(bg):,} block groups, {deln['cbsa'].nunique()} metros")

    print("ZCTA points…")
    zp = zcta_points(zcta, bg, gaz)
    zp["pop10"] = zp["zcta"].map(zcta_pop2010(zcta)).fillna(0)
    zp["sqmi"] = zp["zcta"].map(gaz.set_index("zcta")["sqmi"]).fillna(0)
    county_cbsa = deln.set_index("county")["cbsa"]
    zp["cbsa"] = zp["county"].map(county_cbsa)

    bg["cbsa"] = bg["county"].map(county_cbsa)
    ranks_pop, pop_year = load_pop_ranks(deln, bg.groupby("cbsa")["pop"].sum())
    # Metros with no ZCTAs assigned are skipped. (Connecticut's 2023 delineation uses planning
    # regions, which the 2020 block-group file does not carry, so Hartford drops out.)
    has_zcta = set(zp["cbsa"].dropna())
    skipped = [c for c in ranks_pop.sort_values(ascending=False).index[: C.TOP_N] if c not in has_zcta]
    if skipped:
        print(f"  skipping metros with no ZCTAs: {skipped}")
    ranked = ranks_pop[ranks_pop.index.isin(has_zcta)].sort_values(ascending=False)
    rank_of = {c: i + 1 for i, c in enumerate(ranked.index)}

    if len(argv) > 1:
        build_ids = argv[1:]
    elif C.METROS == "top":
        build_ids = list(ranked.index[: C.TOP_N])
    else:
        build_ids = list(C.METROS)
    # The metros.json list always contains the top N so the selector is complete
    list_ids = list(ranked.index[: C.TOP_N])
    for b in build_ids:
        if b not in list_ids:
            list_ids.append(b)

    # US benchmark from the state-total rows (ZIP 00000), same deflator as the metros
    st = irs[irs["zip"] == "00000"].copy()
    irs = irs[irs["zip"] != "00000"]
    if st.empty:
        raise SystemExit("No state-total (00000) rows: re-run pipeline/reduce_irs.py")
    top_stub = st.groupby("year")["stub"].transform("max")
    st["n200"] = np.where(st["stub"] == top_stub, st["n1"], 0)
    us_g = st.groupby("year").agg(ret=("n1", "sum"), agi=("a00100", "sum"), n200=("n200", "sum"))
    us = {
        "avgIncome": [round(float(us_g.at[y, "agi"]) * 1000 / float(us_g.at[y, "ret"]) * deflate[y], 0) for y in years],
        "share200k": [round(float(us_g.at[y, "n200"]) / float(us_g.at[y, "ret"]) * 100, 2) for y in years],
        "returns": [int(us_g.at[y, "ret"]) for y in years],
    }
    print(f"  US avg income per return: {us['avgIncome'][0]:,.0f} -> {us['avgIncome'][-1]:,.0f} ({dollar_year} $)")

    print("ZIP → ZCTA…")
    zip_map, po = zip_to_zcta(set(irs["zip"].unique()), zcta, geon)
    irs["zcta"] = irs["zip"].map(zip_map)
    irs = irs.dropna(subset=["zcta"])
    irs["po"] = irs["zip"].isin(po)

    # ZCTA-year aggregates (amounts $K → $)
    irs["cap"] = irs[["a00300", "a00600", "a01000"]].fillna(0).sum(axis=1)
    irs["n200"] = np.where(irs["stub"] == irs.groupby("year")["stub"].transform("max"), irs["n1"], 0)
    agg = irs.groupby(["zcta", "year"]).agg(ret=("n1", "sum"), agi=("a00100", "sum"), cap=("cap", "sum"),
                                              n200=("n200", "sum"), po=("po", "any")).reset_index()
    agg["agi"] *= 1000
    agg["cap"] *= 1000

    # place names
    name_map: dict[str, str] = {}
    gz = geon.drop_duplicates("zip").set_index("zip")
    for z in zp["zcta"]:
        if z in gz.index:
            name_map[z] = str(gz.at[z, "place"])
    if places is not None:
        for z, n in zip(places["zcta"], places["name"]):
            name_map[z] = n

    C.OUT.mkdir(parents=True, exist_ok=True)
    metros_out = []
    existing = {}
    mf = C.OUT / "metros.json"
    if mf.exists():
        existing = {m["id"]: m for m in json.loads(mf.read_text())["metros"]}

    for cbsa in list_ids:
        d = deln[deln["cbsa"] == cbsa]
        title = d["title"].iloc[0]
        states = title.split(", ")[-1].split("-")
        mz = zp[zp["cbsa"] == cbsa].copy()
        meta = {
            "id": cbsa, "name": title, "shortName": short_name(cbsa, title), "rank": rank_of.get(cbsa, 999),
            "pop": int(ranks_pop.get(cbsa, 0)), "popYear": pop_year,
            "principalCities": principal_cities(title), "states": states,
        }
        if cbsa not in build_ids:
            if cbsa in existing:
                metros_out.append({**existing[cbsa], **meta})
            continue
        print(f"[{meta['rank']:>2}] {title}: {len(mz)} ZCTAs")
        res = build_metro(cbsa, mz, zcta, agg, years, deflate, name_map)
        write_counties(cbsa, d)
        lms = C.LANDMARKS.get(cbsa) or auto_landmarks(title, mz, name_map)
        cbd = check_cbd(cbsa, zcta)
        if cbd:  # drop a landmark that is the same place as the CBD marker
            lms = [l for l in lms if haversine_mi(l["lat"], l["lon"], cbd["lat"], cbd["lon"]) > 1.5]
        metros_out.append({**meta, "bbox": res["bbox"], "landmarks": lms, "cbd": cbd,
                           "zipCount": res["zipCount"], "suppressedCount": res["suppressedCount"],
                           "summary": res["summary"]})

    metros_out = [m for m in metros_out if "bbox" in m]
    (C.OUT / "metros.json").write_text(json.dumps({
        "generated": date.today().isoformat(), "years": years, "dollarYear": dollar_year, "us": us,
        "metros": sorted(metros_out, key=lambda m: m["rank"]),
    }, separators=(",", ":")))
    print(f"wrote {len(metros_out)} metros to {C.OUT}")
    if _IMPUTE_LOG:
        rep = C.ROOT / "pipeline" / "imputation_report.csv"
        pd.DataFrame(_IMPUTE_LOG, columns=["zcta", "pop2020", "pop2010", "parent", "since", "parent_drop",
                                           "share_in_parent_before", "result"]).to_csv(rep, index=False)
        print(f"wrote {rep}")


def build_metro(cbsa, mz, zcta, agg, years, deflate, name_map) -> dict:
    out_dir = C.OUT / cbsa
    out_dir.mkdir(parents=True, exist_ok=True)
    zlist = sorted(mz["zcta"])
    a = agg[agg["zcta"].isin(zlist)].copy()
    a, est = impute_new_zips(a, mz, zcta, years)
    a["defl"] = a["year"].map(deflate)
    ny = len(years)
    yi = {y: i for i, y in enumerate(years)}

    zips: dict[str, dict] = {}
    for z in zlist:
        zips[z] = {"place": name_map.get(z, ""), "ret": [None] * ny, "income": [None] * ny,
                   "wealth": [None] * ny, "share200k": [None] * ny}
    for r in a.itertuples():
        row = zips[r.zcta]
        i = yi[r.year]
        if r.ret and r.ret > 0:
            row["ret"][i] = int(r.ret)
            row["income"][i] = round(r.agi / r.ret * r.defl, 0)
            row["wealth"][i] = round(r.cap / r.ret * r.defl, 0)
            row["share200k"][i] = round(r.n200 / r.ret * 100, 2)
        if r.po:
            row["po"] = True
    for z, e in est.items():
        zips[z]["est"] = e

    # ---- centers
    pts = mz.set_index("zcta")[["lat", "lon"]]
    centers = {"income": [], "pop": [], "aboveAvg": []}
    gap, metro_avg = [], {"income": [], "wealth": [], "share200k": []}
    for y in years:
        ay = a[(a["year"] == y) & (a["ret"] > 0)].set_index("zcta")
        la, lo = pts.loc[ay.index, "lat"].values, pts.loc[ay.index, "lon"].values
        tot_ret, tot_agi = ay["ret"].sum(), ay["agi"].sum()
        avg = tot_agi / tot_ret
        excess = ay["ret"] * (ay["agi"] / ay["ret"] - avg)
        for k, w in (("income", ay["agi"].values), ("pop", ay["ret"].values.astype(float)), ("aboveAvg", excess.clip(lower=0).values)):
            cla, clo = weighted_center(la, lo, w)
            centers[k].append({"year": int(y), "lat": round(cla, 5), "lon": round(clo, 5)})
        gap.append(round(haversine_mi(centers["income"][-1]["lat"], centers["income"][-1]["lon"],
                                      centers["pop"][-1]["lat"], centers["pop"][-1]["lon"]), 3))
        d = deflate[y]
        metro_avg["income"].append(round(avg * d, 0))
        metro_avg["wealth"].append(round(ay["cap"].sum() / tot_ret * d, 0))
        metro_avg["share200k"].append(round(ay["n200"].sum() / tot_ret * 100, 2))

    i0, i1 = centers["income"][0], centers["income"][-1]
    p0, p1 = centers["pop"][0], centers["pop"][-1]
    finding = {
        "firstYear": years[0], "lastYear": years[-1],
        "incMi": round(haversine_mi(i0["lat"], i0["lon"], i1["lat"], i1["lon"]), 2),
        "incBearing": bearing16(i0["lat"], i0["lon"], i1["lat"], i1["lon"]),
        "popMi": round(haversine_mi(p0["lat"], p0["lon"], p1["lat"], p1["lon"]), 2),
        "popBearing": bearing16(p0["lat"], p0["lon"], p1["lat"], p1["lon"]),
        "gap0": gap[0], "gap1": gap[-1],
    }

    # ---- bins on the latest year
    last = ny - 1
    bins, occupancy = {}, {}
    for m in ("income", "wealth", "share200k"):
        zs = [z for z in zlist if zips[z][m][last] is not None]
        v = np.array([zips[z][m][last] for z in zs], float)
        # Share $200K+ uses quantile bins too (no outlier bin): equal-width bins put ~70% of
        # DFW's ZIPs in the lightest class. Breaks round to whole percentage points.
        bins[m] = (quantile_bins(v, name_map, zs, outliers_on=False, rounder=lambda q: float(round(q)))
                   if m == "share200k" else quantile_bins(v, name_map, zs))
        occupancy[m] = bin_counts(v, bins[m])
        assert all(c > 0 for c in occupancy[m]), f"{cbsa} {m}: empty bin {occupancy[m]} breaks {bins[m]['breaks']}"
    print(f"   bins  income {occupancy['income']}  wealth {occupancy['wealth']}  share {occupancy['share200k']}")
    print(f"   {finding}")

    suppressed = [z for z in zlist if zips[z]["income"][last] is None]
    data = {
        "id": cbsa, "years": [int(y) for y in years], "dollarYear": int(years[-1]),
        "zips": zips, "metroAvg": metro_avg, "bins": bins, "centers": centers,
        "gapMi": gap, "finding": finding, "suppressedZips": suppressed,
    }
    (out_dir / "data.json").write_text(json.dumps(data, separators=(",", ":")))

    sqmi = mz.set_index("zcta")["sqmi"]
    # ---- geometry: coverage-preserving simplification (no slivers between neighbours)
    g = zcta[zcta["zcta"].isin(zlist)].copy().reset_index(drop=True)
    geoms = shapely.coverage_simplify(g.geometry.values, tolerance=C.SIMPLIFY_TOL)
    g["geometry"] = shapely.set_precision(geoms, 10 ** -C.COORD_DECIMALS)
    g = g[~g.geometry.is_empty]
    gj = json.loads(g[["zcta", "geometry"]].to_json(drop_id=True))
    for f in gj["features"]:
        f["geometry"] = _round_geom(f["geometry"])
        z = f["properties"]["zcta"]
        if z in est:
            f["properties"]["est"] = 1
        # filers per square mile of land (latest year) - the map fades sparse ZIPs
        ret = zips[z]["ret"][last] or 0
        area = float(sqmi.get(z, 0) or 0)
        f["properties"]["d"] = int(round(ret / area)) if area > 0 else 0
    (out_dir / "zctas.geojson").write_text(json.dumps(gj, separators=(",", ":")))
    size = (out_dir / "zctas.geojson").stat().st_size / 1e6
    print(f"   geojson {size:.2f} MB, data {(out_dir / 'data.json').stat().st_size / 1e6:.2f} MB")

    # Frame the map on the ZCTAs holding 99.5% of residents, nearest the population centre
    # first, so remote islands or empty desert (Honolulu County's Northwestern Islands,
    # Riverside's east end) don't zoom the whole metro out. Every ZCTA is still drawn.
    pc = weighted_center(mz["lat"].values, mz["lon"].values, mz["pop"].values.astype(float))
    order = mz.assign(d=[haversine_mi(pc[0], pc[1], a, o) for a, o in zip(mz["lat"], mz["lon"])]).sort_values("d")
    cum = order["pop"].cumsum() / max(1, order["pop"].sum())
    keep = set(order.loc[cum <= 0.995, "zcta"]) | set(order["zcta"].head(1))
    b = g[g["zcta"].isin(keep)].total_bounds
    # Per-year metro summary, used for cross-metro rankings in the sidebar.
    summary = {
        "avgIncome": metro_avg["income"],
        "share200k": metro_avg["share200k"],
        "returns": [int(sum(zips[z]["ret"][i] or 0 for z in zlist)) for i in range(ny)],
        "zipsReporting": [sum(1 for z in zlist if zips[z]["income"][i] is not None) for i in range(ny)],
        "zipsEstimated": [sum(1 for z in zlist if zips[z]["income"][i] is not None and "est" in zips[z]) for i in range(ny)],
        "gapMi": gap,
        # direction of the income center as seen from the population center
        "gapBearing": [bearing16(centers["pop"][i]["lat"], centers["pop"][i]["lon"],
                                 centers["income"][i]["lat"], centers["income"][i]["lon"]) for i in range(ny)],
    }
    return {"bbox": [round(float(x), 4) for x in b], "zipCount": len(zlist), "suppressedCount": len(suppressed),
            "summary": summary}


def _round_geom(geom: dict) -> dict:
    def r(c):
        return [r(x) for x in c] if isinstance(c[0], list) else [round(c[0], C.COORD_DECIMALS), round(c[1], C.COORD_DECIMALS)]
    geom["coordinates"] = r(geom["coordinates"])
    return geom


if __name__ == "__main__":
    main(sys.argv)
