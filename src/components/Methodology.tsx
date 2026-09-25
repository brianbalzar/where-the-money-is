interface Props { years: number[]; dollarYear: number; onClose: () => void }

export default function Methodology({ years, dollarYear, onClose }: Props) {
  const first = years[0], last = years[years.length - 1]
  return (
    <div className="method-scrim">
      <article className="method" aria-labelledby="method-h">
        <div className="method-top">
          <span className="eyebrow">Where the money is</span>
          <button type="button" className="cta" onClick={onClose}>← Back to map</button>
        </div>
        <h1 id="method-h">Methodology</h1>
        <p>
          This site locates the <em>center of income</em> for each of the 50 largest US metro areas, every year from {first} to {last},
          and compares it with the <em>center of population</em>. The distance between the two is the headline: it shows where
          money is concentrated relative to where people file taxes, and whether that is shifting.
        </p>

        <h2>1. Data sources</h2>
        <ul>
          <li><b>Income:</b> IRS Statistics of Income (SOI), <i>Individual Income Tax Statistics — ZIP Code Data</i>, tax years {first}–{last}. Totals of adjusted gross income (AGI), returns, interest, dividends and capital gains by ZIP code and AGI size class.</li>
          <li><b>ZIP geography:</b> Census 2020 ZIP Code Tabulation Areas (ZCTAs), cartographic boundary file (1:500k), simplified for the web.</li>
          <li><b>ZIP points:</b> Census 2020 block-group centers of population.</li>
          <li><b>Metro areas:</b> OMB core-based statistical area (CBSA) delineation of July 2023. Metros are ranked by the latest Census population estimate.</li>
          <li><b>PO-box ZIPs:</b> GeoNames postal-code points (CC BY 4.0).</li>
          <li><b>Inflation:</b> BLS CPI-U, US city average, annual average.</li>
          <li><b>Basemap:</b> © OpenStreetMap contributors, tiles by OpenFreeMap.</li>
        </ul>

        <h2>2. What “center of income” means</h2>
        <p>
          Each ZIP is represented by one fixed point: the population-weighted mean of the 2020 block-group centers of population inside it.
          This keeps a large, mostly empty ZIP from pulling the center toward its geometric middle. The <b>income center</b> for a year is the
          mean of those points weighted by each ZIP’s total AGI. The <b>population center</b> is the same calculation weighted by the number of
          returns. “Population” here means <b>tax returns</b>, not residents: non-filers are missing, and a joint return counts once.
        </p>
        <p>
          Because the population center moves wherever growth goes, the income center moving north on its own proves little. The gap between
          the two, and how it changes, is the part that says money is concentrating somewhere faster than people are.
        </p>

        <h2>3. The above-average income center</h2>
        <p>
          A second income center weights each ZIP only by income <i>above</i> what the metro average would give it: returns × (average income − metro average),
          counting only ZIPs above the average. It isolates where the excess income sits and ignores the bulk of middle-income filers that
          dominate the plain income center.
        </p>

        <h2>4. Income is not wealth</h2>
        <p>
          There is no public ZIP-level measure of net worth. The <b>wealth signal</b> is capital income per return — taxable interest,
          ordinary dividends and net capital gains — which people only receive from assets. It tracks wealth better than wages do, but it
          swings with markets (2021’s capital-gains spike is visible everywhere) and misses unrealized gains, home equity and retirement accounts.
          Treat it as a proxy, never as net worth.
        </p>

        <h2>5. Suppressed ZIPs</h2>
        <p>
          The IRS does not publish ZIPs with fewer than about 100 returns. They appear hatched on the map as “no data” and are excluded from ranks.
          In the centers, a suppressed ZIP-year contributes nothing. Because such ZIPs hold under 100 returns, the error this introduces is tiny,
          and it keeps fast-growing fringe ZIPs (which were often suppressed in early years) in the calculation once they grow.
        </p>

        <h2>6. ZIP codes vs. ZCTAs, and fixed geography</h2>
        <p>
          IRS data is by USPS ZIP; maps are by Census ZCTA. PO-box and single-building ZIPs have no ZCTA polygon. Their returns are added to the
          ZCTA that contains (or is nearest to) the PO-box ZIP’s location, so downtown income is not dropped. Every year uses the same 2020 ZCTAs
          and the same 2023 metro definition, so movement in the centers is not an artifact of boundary changes. ZCTAs that cross a county line are
          assigned to the county holding most of their population.
        </p>

        <h2>7. Newer ZIPs the IRS does not list</h2>
        <p>
          When USPS splits a ZIP, the IRS file does not list the new one. Its filers are pooled into the state’s unlocated
          “other” total, and the parent ZIP shows a sudden one-year drop in returns. Left alone, this removes whole fast-growing
          suburbs from the data — in Dallas–Fort Worth, Frisco’s 75033 and 75036 and McKinney’s 75072, about 141,000 residents in 2020 —
          and pulls every center away from where growth is happening.
        </p>
        <p>
          These ZIPs are <b>estimated</b> and drawn with a dashed outline. A ZCTA is estimated when it has at least 1,000 residents, never
          appears in the IRS file, and borders a ZIP that lost at least 25% of its returns in a single year. Its returns are its population
          (linear between the 2010 and 2020 censuses) times the parent ZIP’s returns per resident; its average income, capital income and
          $200K+ share are the parent’s. Before the parent’s drop year, part of the new ZIP’s filers were still counted in the parent, so the
          estimate is reduced by that share to keep the total continuous. Populated ZIPs that don’t fit this pattern (campuses, bases) stay “no data”.
          The full list is in <code>pipeline/imputation_report.csv</code>.
        </p>

        <h2>8. Inflation</h2>
        <p>
          All dollar values are converted to {dollarYear} dollars with the CPI-U annual average. The $200K+ share is the exception: the IRS size
          class is fixed in nominal dollars, so part of that share’s rise over time is inflation.
        </p>

        <h2>9. Limits</h2>
        <ul>
          <li>Averages, not medians. The IRS publishes ZIP totals only, so a handful of very high earners can lift a ZIP’s average.</li>
          <li>Small year-to-year moves may be noise; there are no uncertainty estimates. The headline uses first-to-latest displacement and bearing, not a fitted trend.</li>
          <li>Returns are counted where the filer lists their address, which is not always where they live or work.</li>
          <li>The IRS publishes ZIP data about two years after the tax year ends; the latest year shown is the latest published.</li>
          <li>Headlines are generated from the numbers and describe movement only; they say nothing about causes.</li>
          <li>ZIP place names come from the Census place that covers most of each ZCTA (or the USPS city name), so neighborhoods inside a large city show the city name.</li>
        </ul>
        <p className="method-foot"><button type="button" className="cta" onClick={onClose}>← Back to map</button></p>
      </article>
    </div>
  )
}
