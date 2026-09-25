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

# Central business district (main downtown) per metro. For multi-city metros this is the
# dominant CBD (Dallas for DFW, Minneapolis for MSP, Norfolk for Virginia Beach-Norfolk).
# `zip` is a downtown ZIP the point must fall inside; build.py checks it to catch typos.
CBD: dict[str, dict] = {
    "35620": {"name": "Midtown Manhattan", "lat": 40.7549, "lon": -73.9840, "zip": "10036"},
    "31080": {"name": "Downtown Los Angeles", "lat": 34.0500, "lon": -118.2520, "zip": "90071"},
    "16980": {"name": "The Loop", "lat": 41.8818, "lon": -87.6298, "zip": "60603"},
    "19100": {"name": "Downtown Dallas", "lat": 32.7801, "lon": -96.8005, "zip": "75201"},
    "26420": {"name": "Downtown Houston", "lat": 29.7589, "lon": -95.3677, "zip": "77002"},
    "12060": {"name": "Downtown Atlanta", "lat": 33.7550, "lon": -84.3900, "zip": "30303"},
    "47900": {"name": "Downtown DC", "lat": 38.9007, "lon": -77.0319, "zip": "20005"},
    "33100": {"name": "Downtown Miami", "lat": 25.7700, "lon": -80.1920, "zip": "33131"},
    "37980": {"name": "Center City Philadelphia", "lat": 39.9526, "lon": -75.1652, "zip": "19107"},
    "38060": {"name": "Downtown Phoenix", "lat": 33.4484, "lon": -112.0740, "zip": "85004"},
    "14460": {"name": "Downtown Boston", "lat": 42.3555, "lon": -71.0565, "zip": "02110"},
    "40140": {"name": "Downtown Riverside", "lat": 33.9806, "lon": -117.3755, "zip": "92501"},
    "41860": {"name": "SF Financial District", "lat": 37.7946, "lon": -122.3999, "zip": "94111"},
    "19820": {"name": "Downtown Detroit", "lat": 42.3314, "lon": -83.0458, "zip": "48226"},
    "42660": {"name": "Downtown Seattle", "lat": 47.6062, "lon": -122.3321, "zip": "98104"},
    "33460": {"name": "Downtown Minneapolis", "lat": 44.9778, "lon": -93.2650, "zip": "55402"},
    "45300": {"name": "Downtown Tampa", "lat": 27.9506, "lon": -82.4572, "zip": "33602"},
    "41740": {"name": "Downtown San Diego", "lat": 32.7157, "lon": -117.1611, "zip": "92101"},
    "19740": {"name": "Downtown Denver", "lat": 39.7486, "lon": -104.9953, "zip": "80202"},
    "36740": {"name": "Downtown Orlando", "lat": 28.5421, "lon": -81.3790, "zip": "32801"},
    "16740": {"name": "Uptown Charlotte", "lat": 35.2271, "lon": -80.8431, "zip": "28202"},
    "12580": {"name": "Downtown Baltimore", "lat": 39.2904, "lon": -76.6122, "zip": "21202"},
    "41180": {"name": "Downtown St. Louis", "lat": 38.6270, "lon": -90.1994, "zip": "63101"},
    "41700": {"name": "Downtown San Antonio", "lat": 29.4241, "lon": -98.4936, "zip": "78205"},
    "12420": {"name": "Downtown Austin", "lat": 30.2672, "lon": -97.7431, "zip": "78701"},
    "38900": {"name": "Downtown Portland", "lat": 45.5152, "lon": -122.6784, "zip": "97204"},
    "40900": {"name": "Downtown Sacramento", "lat": 38.5816, "lon": -121.4944, "zip": "95814"},
    "38300": {"name": "Downtown Pittsburgh", "lat": 40.4406, "lon": -79.9959, "zip": "15222"},
    "29820": {"name": "Downtown Las Vegas", "lat": 36.1699, "lon": -115.1398, "zip": "89101"},
    "17140": {"name": "Downtown Cincinnati", "lat": 39.1031, "lon": -84.5120, "zip": "45202"},
    "28140": {"name": "Downtown Kansas City", "lat": 39.0997, "lon": -94.5786, "zip": "64106"},
    "18140": {"name": "Downtown Columbus", "lat": 39.9612, "lon": -82.9988, "zip": "43215"},
    "26900": {"name": "Downtown Indianapolis", "lat": 39.7684, "lon": -86.1581, "zip": "46204"},
    "34980": {"name": "Downtown Nashville", "lat": 36.1627, "lon": -86.7816, "zip": "37219"},
    "17410": {"name": "Downtown Cleveland", "lat": 41.4993, "lon": -81.6944, "zip": "44114"},
    "41940": {"name": "Downtown San Jose", "lat": 37.3337, "lon": -121.8907, "zip": "95113"},
    "47260": {"name": "Downtown Norfolk", "lat": 36.8468, "lon": -76.2852, "zip": "23510"},
    "27260": {"name": "Downtown Jacksonville", "lat": 30.3322, "lon": -81.6557, "zip": "32202"},
    "39300": {"name": "Downtown Providence", "lat": 41.8240, "lon": -71.4128, "zip": "02903"},
    "39580": {"name": "Downtown Raleigh", "lat": 35.7796, "lon": -78.6382, "zip": "27601"},
    "33340": {"name": "Downtown Milwaukee", "lat": 43.0389, "lon": -87.9065, "zip": "53202"},
    "36420": {"name": "Downtown Oklahoma City", "lat": 35.4676, "lon": -97.5164, "zip": "73102"},
    "31140": {"name": "Downtown Louisville", "lat": 38.2527, "lon": -85.7585, "zip": "40202"},
    "40060": {"name": "Downtown Richmond", "lat": 37.5407, "lon": -77.4360, "zip": "23219"},
    "32820": {"name": "Downtown Memphis", "lat": 35.1495, "lon": -90.0490, "zip": "38103"},
    "41620": {"name": "Downtown Salt Lake City", "lat": 40.7608, "lon": -111.8910, "zip": "84111"},
    "23420": {"name": "Downtown Fresno", "lat": 36.7378, "lon": -119.7871, "zip": "93721"},
    "13820": {"name": "Downtown Birmingham", "lat": 33.5186, "lon": -86.8104, "zip": "35203"},
    "24340": {"name": "Downtown Grand Rapids", "lat": 42.9634, "lon": -85.6681, "zip": "49503"},
    "15380": {"name": "Downtown Buffalo", "lat": 42.8864, "lon": -78.8784, "zip": "14202"},
}
