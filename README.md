# Where the Money Is

**Centers of income in America's 100 largest metros.** Pick a metro and see every ZIP code shaded by average income, a wealth signal, or the share of high earners. The page also shows where the metro's *center of income* and *center of population* have moved each year since 2011, and how far apart they are.

Data: IRS Statistics of Income ZIP-code files (2011–2022), Census 2020 ZCTAs and block-group centers of population, and the OMB 2023 metro delineation. See the in-app **Methodology** page for definitions and limits.

## Repo layout

```
scripts/download-data.ps1   fetch raw sources into data/raw   (git-ignored, ~2 GB)
pipeline/reduce_irs.py      IRS CSVs -> data/interim/irs_zip.csv.gz (needs pandas only)
pipeline/build.py           everything else -> public/data/**   (committed)
pipeline/config.py          metro list, CPI, bins, landmarks, imputation thresholds
pipeline/imputation_report.csv   which new ZIPs were estimated, and why
src/                        Vite + React + TypeScript + MapLibre front end
design-handoff/             Claude Design handoff (tokens, options board)
```

## Run the site locally

```
npm install
npm run dev          # http://localhost:5173/?metro=19100
npm test             # unit, component (jsdom) and data-invariant tests on the real data files
```

## Rebuild the data

```
powershell -ExecutionPolicy Bypass -File scripts\download-data.ps1
python -m pip install -r pipeline/requirements.txt
python pipeline/reduce_irs.py
python pipeline/build.py            # all 100 metros (~1 min)
python pipeline/build.py 19100      # one metro
```

When the IRS publishes tax year 2023 (`23zpallagi.csv`), re-run all three steps. The latest year is read from the data, and the dollar base year follows it. Add the year's CPI-U annual average to `pipeline/config.py` first.

## Decisions worth knowing

- **Newer ZIPs the IRS doesn't list are estimated.** Examples are Frisco 75033/75036 and McKinney 75072. They're drawn with a dashed outline and flagged on the ZIP card. Without this, Dallas–Fort Worth's income center sits about 0.7 miles too far south from 2018 on. The method is in `pipeline/build.py::impute_new_zips` and on the Methodology page.
- **Share $200K+ uses quantile bins**, not the design's equal-width bins. Equal-width bins put about 70% of DFW ZIPs in the lightest class.
- **Connecticut** metros (Hartford, Bridgeport–Stamford, New Haven): the 2023 delineation uses planning regions, which the 2020 block-group file doesn't carry, so CT block groups are re-assigned by location using the 2023 county boundary file (also used for the county outlines).
- **The #100 cutoff is a coin flip:** New Haven edges Reno by a handful of people in the 2025 estimate. Reno's downtown is configured so it drops in cleanly if the order flips.
- **Downtowns (CBD)** are hand-placed in `pipeline/config.py`; each is checked against a named downtown ZIP.
- **Maps frame on the ZIPs holding 99.5% of residents**, so remote parts of a county (Honolulu's Northwestern Islands) don't zoom the metro out.
- **A "Centers, magnified" inset was added** (it isn't in the design). The centers move 1–2 miles across metros 60+ miles wide, so on the main map the trails collapse into a dot.
- **US benchmark** on the trend chart comes from the IRS state-total rows (ZIP `00000`), which include suppressed ZIPs, deflated the same way as the metros.
- **Metro summary and rankings** (sidebar) rank on the values as displayed (e.g. 0.1 mi for gaps), so equal displayed values share a rank. Rank 1 = highest income / widest gap / most widened.
- **Sparse ZIPs fade** on the map (filers per square mile) so large rural ZCTAs don't outweigh the dense core.
- Basemap tiles come from **OpenFreeMap** (free, no API key, © OpenStreetMap contributors).

## Deploy

See `DEPLOY.md`.

Code: MIT. Data derived from IRS SOI and US Census Bureau public files; GeoNames postal codes (CC BY 4.0).
