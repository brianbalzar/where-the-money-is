"""Pipeline configuration. Change METROS to build a subset (e.g. ["19100"] for DFW only)."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw"
INTERIM = ROOT / "data" / "interim"
OUT = ROOT / "public" / "data"

# Which metros to build. "top" = the TOP_N largest metropolitan CBSAs by population.
# Or a list of CBSA codes, e.g. ["19100"] (Dallas–Fort Worth–Arlington).
METROS: str | list[str] = "top"
TOP_N = 100

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
    "25540": "Hartford",
    "46520": "Honolulu",
    "14860": "Bridgeport–Stamford",
    "35840": "North Port–Sarasota",
    "28880": "Poughkeepsie–Newburgh",
    "10580": "Albany",
    "12540": "Bakersfield",
    "32580": "McAllen",
    "22220": "Northwest Arkansas",
    "10900": "Allentown–Bethlehem",
    "19430": "Dayton",
    "39340": "Provo–Orem",
    "19780": "Des Moines",
    "19660": "Daytona Beach",
    "36260": "Ogden",
    "37340": "Palm Bay–Melbourne",
    "12260": "Augusta",
    "20500": "Durham–Chapel Hill",
    "44060": "Spokane",
    "35380": "New Orleans",
    "24860": "Greenville, SC",
    "17900": "Columbia, SC",
    "16700": "Charleston, SC",
    "27140": "Jackson, MS",
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
    "25540": {"name": "Downtown Hartford", "lat": 41.7658, "lon": -72.6734, "zip": "06103"},
    "46060": {"name": "Downtown Tucson", "lat": 32.2226, "lon": -110.9747, "zip": "85701"},
    "46140": {"name": "Downtown Tulsa", "lat": 36.1540, "lon": -95.9928, "zip": "74103"},
    "40380": {"name": "Downtown Rochester", "lat": 43.1566, "lon": -77.6088, "zip": "14604"},
    "24860": {"name": "Downtown Greenville", "lat": 34.8526, "lon": -82.3940, "zip": "29601"},
    "36540": {"name": "Downtown Omaha", "lat": 41.2587, "lon": -95.9378, "zip": "68102"},
    "46520": {"name": "Downtown Honolulu", "lat": 21.3099, "lon": -157.8581, "zip": "96813"},
    "14860": {"name": "Downtown Stamford", "lat": 41.0534, "lon": -73.5387, "zip": "06901"},
    "35380": {"name": "New Orleans CBD", "lat": 29.9511, "lon": -90.0715, "zip": "70112"},
    "28940": {"name": "Downtown Knoxville", "lat": 35.9606, "lon": -83.9207, "zip": "37902"},
    "35840": {"name": "Downtown Sarasota", "lat": 27.3364, "lon": -82.5307, "zip": "34236"},
    "12540": {"name": "Downtown Bakersfield", "lat": 35.3733, "lon": -119.0187, "zip": "93301"},
    "10740": {"name": "Downtown Albuquerque", "lat": 35.0844, "lon": -106.6504, "zip": "87102"},
    "32580": {"name": "Downtown McAllen", "lat": 26.2034, "lon": -98.2300, "zip": "78501"},
    "10580": {"name": "Downtown Albany", "lat": 42.6526, "lon": -73.7562, "zip": "12207"},
    "16700": {"name": "Downtown Charleston", "lat": 32.7765, "lon": -79.9311, "zip": "29401"},
    "12940": {"name": "Downtown Baton Rouge", "lat": 30.4515, "lon": -91.1871, "zip": "70802"},
    "49340": {"name": "Downtown Worcester", "lat": 42.2626, "lon": -71.8023, "zip": "01608"},
    "10900": {"name": "Downtown Allentown", "lat": 40.6023, "lon": -75.4714, "zip": "18101"},
    "21340": {"name": "Downtown El Paso", "lat": 31.7587, "lon": -106.4869, "zip": "79901"},
    "17900": {"name": "Downtown Columbia", "lat": 34.0007, "lon": -81.0348, "zip": "29201"},
    "15980": {"name": "Downtown Fort Myers", "lat": 26.6406, "lon": -81.8723, "zip": "33901"},
    "29460": {"name": "Downtown Lakeland", "lat": 28.0395, "lon": -81.9498, "zip": "33801"},
    "14260": {"name": "Downtown Boise", "lat": 43.6150, "lon": -116.2023, "zip": "83702"},
    "37100": {"name": "Downtown Oxnard", "lat": 34.1975, "lon": -119.1771, "zip": "93030"},
    "19430": {"name": "Downtown Dayton", "lat": 39.7589, "lon": -84.1916, "zip": "45402"},
    "44700": {"name": "Downtown Stockton", "lat": 37.9577, "lon": -121.2908, "zip": "95202"},
    "24660": {"name": "Downtown Greensboro", "lat": 36.0726, "lon": -79.7920, "zip": "27401"},
    "17820": {"name": "Downtown Colorado Springs", "lat": 38.8339, "lon": -104.8214, "zip": "80903"},
    "30780": {"name": "Downtown Little Rock", "lat": 34.7465, "lon": -92.2896, "zip": "72201"},
    "39340": {"name": "Downtown Provo", "lat": 40.2338, "lon": -111.6585, "zip": "84601"},
    "19780": {"name": "Downtown Des Moines", "lat": 41.5868, "lon": -93.6250, "zip": "50309"},
    "19660": {"name": "Downtown Daytona Beach", "lat": 29.2108, "lon": -81.0228, "zip": "32114"},
    "28880": {"name": "Downtown Poughkeepsie", "lat": 41.7004, "lon": -73.9210, "zip": "12601"},
    "49180": {"name": "Downtown Winston-Salem", "lat": 36.0999, "lon": -80.2442, "zip": "27101"},
    "31540": {"name": "Capitol Square, Madison", "lat": 43.0747, "lon": -89.3842, "zip": "53703"},
    "10420": {"name": "Downtown Akron", "lat": 41.0814, "lon": -81.5190, "zip": "44308"},
    "36260": {"name": "Downtown Ogden", "lat": 41.2230, "lon": -111.9738, "zip": "84401"},
    "37340": {"name": "Downtown Melbourne", "lat": 28.0781, "lon": -80.6081, "zip": "32901"},
    "48620": {"name": "Downtown Wichita", "lat": 37.6872, "lon": -97.3301, "zip": "67202"},
    "45060": {"name": "Downtown Syracuse", "lat": 43.0481, "lon": -76.1474, "zip": "13202"},
    "12260": {"name": "Downtown Augusta", "lat": 33.4735, "lon": -81.9748, "zip": "30901"},
    "20500": {"name": "Downtown Durham", "lat": 35.9940, "lon": -78.8986, "zip": "27701"},
    "22220": {"name": "Downtown Fayetteville", "lat": 36.0626, "lon": -94.1574, "zip": "72701"},
    "25420": {"name": "Downtown Harrisburg", "lat": 40.2596, "lon": -76.8824, "zip": "17101"},
    "27140": {"name": "Downtown Jackson", "lat": 32.2988, "lon": -90.1848, "zip": "39201"},
    "44060": {"name": "Downtown Spokane", "lat": 47.6588, "lon": -117.4260, "zip": "99201"},
    "45780": {"name": "Downtown Toledo", "lat": 41.6528, "lon": -83.5379, "zip": "43604"},
    "16860": {"name": "Downtown Chattanooga", "lat": 35.0456, "lon": -85.3097, "zip": "37402"},
    "35300": {"name": "Downtown New Haven", "lat": 41.3083, "lon": -72.9279, "zip": "06510"},
    "39900": {"name": "Downtown Reno", "lat": 39.5296, "lon": -119.8138, "zip": "89501"},
}
