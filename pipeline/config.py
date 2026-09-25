"""Pipeline configuration. Change METROS to build a subset (e.g. ["19100"] for DFW only)."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw"
INTERIM = ROOT / "data" / "interim"
OUT = ROOT / "public" / "data"

# Which metros to build. "top" = the TOP_N largest metropolitan CBSAs by population.
# Or a list of CBSA codes, e.g. ["19100"] (Dallas–Fort Worth–Arlington).
METROS: str | list[str] = "top"
TOP_N = 50

FIRST_YEAR = 2011  # IRS ZIP files before 2011 use a different layout

# CPI-U, U.S. city average, all items, annual average (1982-84 = 100). Source: BLS series CUUR0000SA0.
# If data/raw/CPIAUCNS.csv (FRED monthly) is present, the pipeline checks these against it.
CPI_U = {
    2011: 224.939, 2012: 229.594, 2013: 232.957, 2014: 236.736, 2015: 237.017,
    2016: 240.007, 2017: 245.120, 2018: 251.107, 2019: 255.657, 2020: 258.811,
    2021: 270.970, 2022: 292.655, 2023: 304.702, 2024: 313.689,
}

# Legend binning
N_BINS = 6
OUTLIER_IQR_K = 3.0        # Tukey far-out fence: Q3 + 3 x IQR
OUTLIER_MAX_SHARE = 0.03   # never flag more than ~3% of a metro's ZIPs as outliers

# New-ZIP imputation (see build.impute_new_zips)
IMPUTE_MIN_POP = 1000     # only estimate ZCTAs with at least this many 2020 residents
IMPUTE_MIN_DROP = 0.25    # parent must lose at least 25% of its returns in one year (15% caught a campus)

# Geometry simplification tolerance in degrees (coverage-preserving, no slivers)
SIMPLIFY_TOL = 0.0012
COORD_DECIMALS = 5

# Hand-curated reference points. Metros without an entry get their principal
# cities (from the CBSA title) placed at the population center of that city's ZIPs.
LANDMARKS: dict[str, list[dict]] = {
    "19100": [
        {"name": "Downtown Dallas", "lat": 32.7801, "lon": -96.8005},
        {"name": "Downtown Fort Worth", "lat": 32.7555, "lon": -97.3308},
        {"name": "Plano", "lat": 33.0198, "lon": -96.6989},
        {"name": "Frisco", "lat": 33.1507, "lon": -96.8236},
        {"name": "Colleyville", "lat": 32.8870, "lon": -97.1497},
    ],
}

# Short display names where the automatic "first two principal cities" rule reads badly.
SHORT_NAMES: dict[str, str] = {
    "19100": "Dallas–Fort Worth",
    "35620": "New York",
    "31080": "Los Angeles",
    "16980": "Chicago",
    "47900": "Washington, DC",
    "37980": "Philadelphia",
    "14460": "Boston",
    "41860": "San Francisco–Oakland",
    "41940": "San Jose",
    "42660": "Seattle",
    "33100": "Miami",
    "40140": "Riverside–San Bernardino",
    "45300": "Tampa–St. Petersburg",
    "47260": "Virginia Beach–Norfolk",
    "26900": "Indianapolis",
    "39300": "Providence",
    "28140": "Kansas City",
    "38900": "Portland, OR",
    "41740": "San Diego",
    "33460": "Minneapolis–St. Paul",
}
