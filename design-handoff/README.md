# Handoff: Where the Money Is
*Centers of income in America's largest metros*

## Overview
A static site (GitHub Pages) where a reader picks one of the 50 largest US metros (Census CBSAs) and sees:
1. A ZIP-level (ZCTA) choropleth of one of three IRS measures.
2. The metro's **income-weighted center** and **population-weighted center** (weighted by number of returns), each with a year-by-year trail from 2011 to the latest year.
3. The **gap** between the two latest centers. This is the headline.

Example metro in all mocks: Dallas–Fort Worth–Arlington, TX. **All numbers in the mocks are placeholders.**

Target stack: Vite + React + TypeScript + MapLibre GL JS, with a Python data pipeline. No heavy UI framework. Use plain CSS with the custom properties in `tokens.css`.

## About the design files
The files in `design/` are **design references built in HTML**. They show the intended look and behavior; they are not production code. Recreate them in the Vite/React/TS app.

- `design/Where the Money Is - Options.dc.html` is an options board. Open it in a browser with `support.js` next to it. Every option has an id badge (1a, 2b…). This README says which ids were chosen.
- `design/MapSchematic.dc.html` draws the **schematic** maps. Hexagons stand in for ZCTA polygons; roads, lakes and landmark positions are approximate. Do not reuse its geometry. Use it only as the reference for **layer order, colors, stroke widths and marker styling**.

## Fidelity
**High fidelity** for tokens, typography, color, component styling and layout proportions. The map contents are **schematic**: real ZCTA shapes, basemap and data come from the pipeline and MapLibre.

## Chosen direction and components
Visual system: **1a "Annual report"**, derived from the Upchurch design system: Inter + Source Serif 4; black, white and warm grays; brand blue `#0082FF` used only for links, focus and the active thumb; square corners; 1px hairlines; no gradients.

| Area | Primary | Alternates on the board |
|---|---|---|
| Desktop layout | **1a** left panel 392px, map fills the rest | 2a (right panel + black finding band), 2b (headline row across top) |
| Dark theme | **2c** | — |
| Mobile | **1d** bottom sheet (peek) + **2e** (expanded) | 2d stacked scroll page |
| Ramps | **1f** single hue per measure | — |
| Outlier / no-data | **1l** near-black outlier with white keyline; hatched no-data | 1m, 1n |
| Legend | **1o** stepped bar with split-off outlier + no-data | 1p strip plot (good for an "expand legend" view), 1q list |
| Center markers | **1r** solid circle vs hollow ring, year beads, dashed population trail | 1s chevrons, 2h comet |
| Year control | **1u** play + ticked slider | 2f gap-over-time chart as the track |
| ZIP card | **1w** hover tooltip; **2g** pinned card + suppressed state | — |
| Summary table | **1y** full table | 1z gap-first bars |
| Metro selector | **1aa** search combobox + prev/next; **2i** jump grid as the "browse all" view | — |

If the product owner picks a different alternate, its spec is on the board under the same id.

---

## Screens / views

### A. Desktop main view (1a), ≥ 1024px
CSS grid: `grid-template-columns: 392px minmax(0,1fr)`, full viewport height. No page scroll.

**Left panel** (`aside`): white, `border-right: 1px solid var(--border-1)`, flex column. Sections are separated by 1px `--border-1` bottom borders. Horizontal padding is 24px throughout.

1. **Header** (padding 24/24/20, gap 14)
   - Eyebrow "WHERE THE MONEY IS": Inter 600 11px, tracking 0.12em, uppercase, `--fg-3`.
   - Metro selector row: a button (flex 1, `1px solid #000`, padding 10/12, Inter 600 15px, metro full CBSA name, chevron-down at right) plus two 40px-wide square buttons, prev ‹ and next › (`1px solid --border-2`).
   - Meta line: "Rank 4 of 50 by population · 247 ZIPs · 9 suppressed", Inter 12px `--fg-4`.
2. **Finding** (padding 22/24, gap 12)
   - One sentence, Source Serif 4 400 22px, line-height 1.3, `--fg-1`, `text-wrap: pretty`. Template:
     > The income center moved {X.X} miles {compass-16} since {firstYear}; the population center moved {Y.Y} miles. The gap between them grew from {G0} to {G1} miles.
     Use "narrowed" when G1 < G0. `compass-16` is the 16-point bearing from the first to the latest point (e.g. "north-northwest").
   - Stats line: "Gap 2011 **2.2 mi**" and "Gap 2023 **3.8 mi**", Inter 12px, bold values in `--fg-1`, gap 20.
3. **Map measure** (padding 18/24, gap 14)
   - Eyebrow "MAP MEASURE".
   - Segmented control with 3 equal columns and a `1px solid #000` outer border and dividers. Active: black background, white text. Labels: "Avg income", "Wealth signal", "Share $200K+". Inter 600 12px, padding 8/6.
   - Center toggles (flex-wrap, gap 16, Inter 13px): "Income center" (12px black dot), "Population center" (8px ring, 2.5px green), "Above-average income" (10px square outline, **off by default**, muted `--fg-4`). These are checkbox toggles.
4. **Legend** (1o, padding 18/24, gap 10). See the component spec.
5. **Footer links**, pinned to the bottom (`margin-top: auto`, border-top): "YEAR-BY-YEAR TABLE" and "METHODOLOGY". Inter 700 12px, tracking 0.06em, uppercase, `--action`. The table opens as a panel or modal (1y). Methodology is a separate section/page.

**Map area**: `position: relative`, map fills it.
- Zoom +/− at top-right, 20px inset: a 34×34 stack with a `--border-2` border on a white background.
- **Year control** (1u) floats at the bottom: 24px inset left/right/bottom, white, `1px solid --border-2`.
- **ZIP hover card** (1w) follows the pointer, offset 16px, flips at the viewport edge.

### B. Desktop dark (2c)
Same structure with `[data-theme=dark]`. Panel background is black and hairlines are `#2D2C2A`. The segmented active state inverts (white background, black text). The play button is white with a black glyph. The basemap switches to its dark style, and the choropleth uses the **dark ramp (dark→light)** so high values glow. The theme toggle is a two-segment "Light | Dark" control in the header (Inter 600 11px). It defaults to `prefers-color-scheme`.

### C. Mobile (< 768px): 1d + 2e
- **Top bar**, 56px, sticky: metro button (flex 1) plus prev/next buttons at 44×40. All tap targets are at least 44px.
- **Map**: full width, fills the viewport behind the sheet.
- **Bottom sheet**, with three snap points:
  - *Peek* (1d, about 344px visible): drag handle 36×4 `--border-2`; finding (Serif 18px/1.35); year row `44px play | slider | year (Serif 20px 600)`; measure segmented (padding 12 so the height is 44px or more); hint "SWIPE UP FOR LEGEND, TABLE, METHOD".
  - *Expanded* (2e, top at about 150px): the map stays visible above. Adds the vertical legend (1q-style rows with ZIP counts), the 5 most recent table rows plus "All 13 years", and a methodology link.
  - *Collapsed*: handle and finding only.
- No horizontal scroll anywhere. The table on mobile has 4 columns: Year, Income moved, Pop. moved, Gap.
- The ZIP card on mobile opens as a **tap**, not a hover, and replaces the sheet content, with an × to close.

### D. Methodology / about
A single readable column, max-width 70ch, Inter 16–18px / 1.6, H2s in Source Serif 4 600. Sections:
1. Data sources: IRS SOI ZIP code data, Census ZCTAs, CBSA delineation (state which vintages).
2. What "center of income" means: the weighted mean of ZIP points; the population center is weighted by returns.
3. The above-average income center.
4. Why income ≠ wealth, and what the wealth signal is.
5. Suppressed ZIPs.
6. Inflation adjustment (deflator and base year).
7. The limits listed under "Data caveats" below.

---

## Component specs

### Metro selector (1aa + 2i)
- **Closed**: the button described above. `[` and `]` keys go to the previous/next metro globally, and prev/next buttons wrap around the 50.
- **Open**: an ARIA combobox listbox directly under the button, `1px solid #000`, width at least 380px.
  - Input: 15px with a 1px black caret.
  - Rows: 3 columns (`30px rank | name | state`), padding 10/14, 14px, `1px --neutral-100` separators. The active row is inverted (black background, white text).
  - Footer hint row, 11px `--fg-4`: "↑↓ move · Enter open · [ ] prev/next metro".
  - Matching is case- and diacritic-insensitive on any word of the CBSA title, the principal cities and the state ("Arlington" finds DFW). An empty query lists all 50 by rank.
- **Browse all** (2i): a link at the bottom of the listbox opens a sheet with a 5-column grid of all 50 (rank + short name, 12px, row padding 5/6, `--neutral-100` bottom border). The current metro is inverted. On mobile it opens full screen.
- Update the URL on change (`?metro=19100&measure=income&year=2023`) so views are linkable.

### Legend (1o)
- Title: "{Measure name}, {year}", Inter 600 11px eyebrow style, with a units note at the right ("2023 $").
- **Bins**: 6 equal-flex swatches, height 12px, gap 2px, `opacity: .85` to match the map. Under each swatch is its lower bound in Inter 10px `--fg-3`, tabular numbers ("$35K", "$52K"…).
- **Outlier swatch**: after a 10px spacer; `--ramp-*-out` with a 1px white inner outline (`outline-offset:-2px`). Label "$190K+".
- **No-data swatch**: after another 10px spacer; 45° hatch (`repeating-linear-gradient(45deg, --nodata-bg 0 3px, --nodata-hatch 3px 4px)`) with a 1px hatch-color border. Label "No data".
- **Outlier names line** (11px/1.5): "**Outliers:** 75205 Highland Park $742K · 76092 Southlake $468K · 75225 Preston Hollow $401K · +4 more". Show the top 3 by value; "+N more" expands the list.
- **Bin rules**, computed in the pipeline per metro, per measure, on the **latest year**, then held fixed across all years so playback compares like with like:
  - Outliers are values greater than Q3 + 3×IQR (capped so at most about 3% of ZIPs qualify).
  - The remaining values are split into 6 quantile bins. Round the breaks to readable numbers ($1K below $100K, $5K above).
  - **Share $200K+** uses 6 equal-interval bins of 0–max rounded to 5 points, with no outlier bin.
  - **Wealth signal** uses the same rule as income; expect more outliers.
- **Hover a swatch**: highlight the ZIPs in that bin (others drop to 0.25 opacity).

### Choropleth (MapLibre)
Layer order, bottom to top:
1. Basemap land, water, parks. Use a light muted style (Protomaps "light"/"grayscale", or MapTiler Dataviz Light).
2. **ZCTA fill**: `fill-color` step expression on the bin index; `fill-opacity: var(--choropleth-opacity)` (0.74 light, 0.8 dark). Outliers use opacity 0.95.
3. **ZCTA outline**: 0.3px `rgba(0,0,0,.12)`, visible at zoom 9 and above. Outlier outline is 1.3px white (black in dark).
4. **No-data fill**: `fill-pattern` using a 6×6 hatch sprite. **Never** give it a ramp color.
5. Basemap **water** re-drawn above the fill, so lakes read clearly.
6. **Roads** re-drawn above the fill: motorways and trunks with a 5px casing (`--map-road-casing`) and a 2.1px line (`--map-road`) at zoom 9–10, scaled up with zoom. Major arterials are 1px. Keep route shields.
7. Place labels and the **landmarks** layer.
8. Selected / hovered ZIP: 2.6px `--center-income` stroke.
9. **Trails, gap line and center markers** (top).

### Reference landmarks
About 5 per metro, hand-curated in the pipeline config (DFW: Downtown Dallas, Downtown Fort Worth, Plano, Frisco, Colleyville).
- Marker: a 5.2px square, white fill, 1.2px `--map-label` stroke.
- Label: Inter *italic* 10px `--map-label`, 3px halo, offset 7px to the side.
- These must be visually quieter than the centers. They are not interactive.

### Center markers and trails (1r)
| | Income center | Population center |
|---|---|---|
| Latest marker | solid circle r=6, `--center-income`, 2.2px halo in `--bg` | hollow ring r=5.6, 2.8px `--center-pop` stroke, `--bg` fill |
| Trail | 2px solid line over a 4.5px `--bg` halo | 2px **dashed** (3/2) line over a 4.5px halo |
| Year beads | r=2.1, filled | r=2.1, `--bg` fill + 1px stroke |
| Labels | "2011" at the start; "Income center 2023" (Inter 700 10.5px) at the end | same, placed on the opposite side |

- **Gap**: a dashed line (2/2.5, 1.4px, `--gap-line`) between the two *current-year* markers, plus a chip at its midpoint (black background, white Inter 700 9.5px, e.g. "3.8 mi gap").
- **Above-average center** (toggle): a hollow square in `--center-above-avg`, with a trail like the population trail but in gray.
- **Hover a bead**: a tooltip with "2017 · 32.874, −96.991 · moved 0.4 mi". Beads have a 12px hit radius.
- During playback, the marker sits at the current year. Trail segments *after* the current year drop to 0.2 opacity.
- Shape and fill carry identity (solid vs hollow, solid vs dashed), so the markers work in grayscale and for colorblind readers.

### Year control (1u)
- Grid: `40px | 72px | 1fr`, gap 18, padding 14/18.
- **Play/pause**: a 40×40 black square with a white glyph. Space toggles it.
- **Year readout**: Source Serif 4 600 30px, tabular numbers.
- **Track**: a native `<input type=range>` (min firstYear, max latestYear, step 1), restyled:
  - Rail: 2px `--border-2`, with the filled portion in black.
  - One 1×16px tick per year in `--fg-4`.
  - Thumb: a 14px black square with a 2px white border plus a 1px black ring (in 2f the thumb is blue).
  - Year labels under the track every 3 years, plus the last year, in 11px.
- **Keyboard**: ←/→ ±1 year, Home/End jump to the first/last year.
- **Playback**: 900ms per year; it starts from the first year if already at the end, and stops at the latest year. The choropleth cross-fades over 300ms; markers glide along the trail over 600ms `--ease-out`.
- `prefers-reduced-motion`: step instantly, with no glide or fade.
- Changing the year updates the legend title, the ZIP card and the URL.

### ZIP card: hover (1w) and pinned (2g)
**Hover** (236px wide, white, `1px solid #000`, padding 14, gap 8, `--shadow-2`):
- Row: "75024" (Inter 700 15px) on the left, place name (12px `--fg-3`) on the right.
- Value: Source Serif 4 600 26px ("$158K"), then the measure caption, 11px ("Avg income per return · 2023").
- A hairline, then a 2-column row: "Rank **38 of 238**" and "Returns **21,340**".
- Sparkline, 34px tall: a 2px line in `--center-income` and a 3px dot at the current year. Endpoint labels at 10px ("2011 $132K", "2023 $158K").

**Pinned** (click a ZIP; 280px):
- Adds "UNPIN" (Inter 700 11px, blue), the bin swatch with "bin 5 of 6", "34% above metro average ($118K)", and a taller 56px sparkline with a dashed metro-average line.
- Then a key/value grid: Rank in metro, Tax returns, Change since 2011.
- On desktop it docks in the panel or at the map's top-right; on mobile it replaces the sheet content.

**Suppressed ZIP** (220px): place name; hatch swatch plus "No data" (Serif 22px); explanation:
> The IRS withholds values for ZIPs with fewer than about 100 returns. This ZIP had {n} in {year}. It is excluded from ranks and centers.

If the return count itself is unavailable, drop the second sentence.

Formatting:
- Dollars: under $1M show "$158K"; otherwise "$1.2M".
- Share: "12.4%".
- Wealth: "$18.2K capital income per return".
- Rank is among non-suppressed ZIPs in the metro, where 1 is the highest.

### Summary table (1y)
- Above the table: the finding sentence in Serif 19px.
- Columns: `Year | Income center (lat, lon) | Moved | Population center (lat, lon) | Moved | Gap`. Grid template `40px 1.5fr 44px 1.5fr 44px 48px`, gap 6.
- Header: 10.5px `--fg-4`, 1px black bottom border.
- Rows: 11.5px tabular numbers, padding 4/0, `--neutral-100` separators.
- Coordinates to 4 decimals; miles to 1 decimal. The first row shows "—" for Moved.
- Footnote: "Miles are great-circle distances." plus a "Download CSV" link.
- Newest year first in the side panel and mobile; oldest first in the full table.

---

## State
```ts
type Measure = 'income' | 'wealth' | 'share200k';
interface AppState {
  metroId: string;          // CBSA code, e.g. '19100'
  measure: Measure;         // default 'income'
  year: number;             // default = latest in data
  playing: boolean;
  showCenters: { income: boolean; pop: boolean; aboveAvg: boolean }; // true, true, false
  hoverZip: string | null;
  pinnedZip: string | null;
  theme: 'light' | 'dark';  // default from prefers-color-scheme
  sheet: 'collapsed' | 'peek' | 'expanded';  // mobile only
}
```
Sync `metroId`, `measure`, `year` and `pinnedZip` to the URL query string.

## Data the pipeline should emit (per metro)
- `metros.json`: `[{ id, name, shortName, rank, principalCities[], states[], bbox, landmarks:[{name,lon,lat}] }]`
- `{metroId}/zctas.pmtiles` (or simplified GeoJSON under about 1.5MB) with the property `zcta`.
- `{metroId}/values.json`: `{ years:[…], zips:{ [zcta]: { place, returns:[…], income:[…], wealth:[…], share200k:[…] } } }`, where `null` means suppressed.
- `{metroId}/bins.json`: `{ income:{breaks:[6], outlierMin, outliers:[{zcta,name,value}]}, wealth:{…}, share200k:{breaks:[6]} }`
- `{metroId}/centers.json`: `{ income:[{year,lat,lon}], pop:[…], aboveAvg:[…], gapMi:[…], finding:{incMi, incBearing, popMi, popBearing, gap0, gap1} }`
- Metro averages per year per measure (for the pinned card).

## Data caveats: where the design assumes something
1. **ZIP ≠ ZCTA.** IRS data is by USPS ZIP. PO-box and single-building ZIPs have no polygon. The design assumes they are left off the map; decide whether they count toward centers (they would need a point).
2. **One point per ZIP.** Centers assume a fixed *population-weighted internal point* per ZCTA (e.g. from block-level population), not the geometric centroid.
3. **Fixed geography.** Use one ZCTA vintage (2020) and one CBSA delineation for every year. Otherwise some of the "movement" is boundary change. Crosswalk 2011–2019 ZIPs to 2020 ZCTAs.
4. **"Population" means returns**, not residents. Say "tax filers" or "returns" in labels.
5. **Suppression varies by year.** Recommendation: fix the ZIP universe (exclude from centers any ZIP suppressed in any year) so playback doesn't flicker. Report the count in the meta line.
6. **Mean, not median.** There is no ZIP-level median. Always say "average".
7. **Wealth is a proxy.** Capital income swings with markets (for example the 2021 capital gains spike). Consider a 3-year rolling average for playback. Never call it net worth.
8. **The $200K+ size class is nominal dollars**, so its share rises partly from inflation. Say so in the legend note.
9. **Inflation.** Pick one deflator (CPI-U suggested) and one base year; labels read "{base} dollars".
10. **Noise.** Small year-to-year moves may be noise; there are no uncertainty estimates. The finding uses first→latest displacement and bearing, not a trend fit.
11. **Names are extra data.** Place names, outlier neighborhood names and landmarks need a ZIP→place crosswalk plus curation.
12. **Latest-year lag** is about 2 years. Read the latest year from the data; never hardcode it.
13. Headline copy is generated from numbers. Avoid causal language ("pulling", "because").

## Accessibility
- Text contrast is at least 4.5:1. `--fg-4` (#6E6C68) is for captions only.
- Every control is keyboard reachable, with a visible `--focus-ring`.
- The map has an `aria-label` summarising the finding. The table is the text alternative to the map and trails.
- Ramps are single-hue with monotonic lightness, so they are colorblind-safe. Center identity uses shape, not just color.

## Design tokens
All tokens are in **`tokens.css`**: color, dark theme, map colors, three ramps plus outliers, no-data, type, spacing, radius, shadow and motion. Key rules:
- Radius 0 by default; 4px maximum.
- 1px hairlines.
- Shadows only on floating cards and sheets.
- Blue only for links, focus and the active thumb.
- Green only for the population center.

## Assets
- Fonts: Inter and Source Serif 4 (Google Fonts, OFL).
- Icons: only chevrons, play/pause and +/−. Draw them in CSS/SVG, or use Lucide at 1.5px stroke.
- Basemap: choose a vector style with separable road and label layers (see Choropleth layer order).
- The hatch sprite is a 6×6 PNG/SVG generated from `--nodata-bg` and `--nodata-hatch`.
- No photography or logos.

## Files
- `tokens.css`: design tokens (CSS custom properties).
- `design/Where the Money Is - Options.dc.html`: the full options board. Turn 2 (top) holds the 1a-style riffs; Turn 1 holds all original options, ramps, components and developer notes.
- `design/MapSchematic.dc.html`: schematic map renderer (layer order and marker styling reference).
- `design/support.js`: runtime needed to open the `.dc.html` files locally.
