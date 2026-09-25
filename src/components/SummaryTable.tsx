import type { MetroData, MetroMeta } from '../lib/types'
import { fmtCoord, fmtMi } from '../lib/format'
import { bearingDeg, compass16, haversineMi } from '../lib/geo'

/**
 * Headline for the selected year: movement from the first year to `year`.
 * Direction words follow the displayed (rounded) numbers, never the raw ones.
 */
export function findingText(d: MetroData, year?: number): string {
  const yi = year != null && d.years.includes(year) ? d.years.indexOf(year) : d.years.length - 1
  const first = d.years[0], y = d.years[yi]
  const i0 = d.centers.income[0], i1 = d.centers.income[yi], p0 = d.centers.pop[0], p1 = d.centers.pop[yi]
  const g1 = fmtMi(d.gapMi[yi])
  if (yi === 0) {
    return `In ${first}, the income center sat ${g1} miles ${compass16(bearingDeg(p1.lat, p1.lon, i1.lat, i1.lon))} of the population center. Move the timeline to see how that changed.`
  }
  const g0 = fmtMi(d.gapMi[0])
  const gap = g0 === g1
    ? `The gap between them held at about ${g1} miles.`
    : `The gap between them ${Number(g1) > Number(g0) ? 'grew' : 'narrowed'} from ${g0} to ${g1} miles.`
  const moved = (a: { lat: number; lon: number }, b: { lat: number; lon: number }) => {
    const mi = haversineMi(a.lat, a.lon, b.lat, b.lon)
    return fmtMi(mi) === '0.0' ? 'barely moved' : `moved ${fmtMi(mi)} miles ${compass16(bearingDeg(a.lat, a.lon, b.lat, b.lon))}`
  }
  return `From ${first} to ${y}, the income center ${moved(i0, i1)}; the population center ${moved(p0, p1)}. ${gap}`
}

interface Row { year: number; iLat: number; iLon: number; iMoved: number | null; pLat: number; pLon: number; pMoved: number | null; gap: number }

export function tableRows(d: MetroData): Row[] {
  return d.years.map((y, i) => {
    const a = d.centers.income[i], p = d.centers.pop[i]
    const pa = i ? d.centers.income[i - 1] : null, pp = i ? d.centers.pop[i - 1] : null
    return {
      year: y, iLat: a.lat, iLon: a.lon, iMoved: pa ? haversineMi(pa.lat, pa.lon, a.lat, a.lon) : null,
      pLat: p.lat, pLon: p.lon, pMoved: pp ? haversineMi(pp.lat, pp.lon, p.lat, p.lon) : null, gap: d.gapMi[i],
    }
  })
}

function downloadCsv(d: MetroData, m: MetroMeta) {
  const head = 'year,income_center_lat,income_center_lon,income_moved_mi,pop_center_lat,pop_center_lon,pop_moved_mi,above_avg_lat,above_avg_lon,gap_mi'
  const lines = tableRows(d).map((r, i) => [r.year, r.iLat, r.iLon, r.iMoved?.toFixed(3) ?? '', r.pLat, r.pLon, r.pMoved?.toFixed(3) ?? '',
    d.centers.aboveAvg[i].lat, d.centers.aboveAvg[i].lon, r.gap.toFixed(3)].join(','))
  const blob = new Blob([[head, ...lines].join('\n')], { type: 'text/csv' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `centers_${m.id}_${m.shortName.replace(/[^A-Za-z]+/g, '-').toLowerCase()}.csv`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

interface Props { data: MetroData; metro: MetroMeta; variant: 'full' | 'compact'; order?: 'asc' | 'desc'; limit?: number; onAll?: () => void }

export default function SummaryTable({ data, metro, variant, order = 'asc', limit, onAll }: Props) {
  let rows = tableRows(data)
  if (order === 'desc') rows = rows.reverse()
  const total = rows.length
  if (limit) rows = rows.slice(0, limit)
  const mv = (v: number | null) => (v == null ? '—' : fmtMi(v))

  if (variant === 'compact') {
    return (
      <div className="stable compact">
        <div className="st-row st-head"><span>Year</span><span>Income moved</span><span>Pop. moved</span><span>Gap</span></div>
        {rows.map((r) => (
          <div className="st-row" key={r.year}><span>{r.year}</span><span>{mv(r.iMoved)} mi</span><span>{mv(r.pMoved)} mi</span><span>{fmtMi(r.gap)} mi</span></div>
        ))}
        {limit && total > limit && onAll && <button type="button" className="cta" onClick={onAll}>All {total} years</button>}
      </div>
    )
  }
  return (
    <div className="stable full">
      <div className="st-row st-head">
        <span>Year</span><span>Income center (lat, lon)</span><span>Moved (mi)</span><span>Population center (lat, lon)</span><span>Moved (mi)</span><span>Gap (mi)</span>
      </div>
      {rows.map((r) => (
        <div className="st-row" key={r.year}>
          <span>{r.year}</span><span>{fmtCoord(r.iLat)}, {fmtCoord(r.iLon)}</span><span>{mv(r.iMoved)}</span>
          <span>{fmtCoord(r.pLat)}, {fmtCoord(r.pLon)}</span><span>{mv(r.pMoved)}</span><span>{fmtMi(r.gap)}</span>
        </div>
      ))}
      <p className="st-foot">Miles are great-circle distances. <button type="button" className="linklike" onClick={() => downloadCsv(data, metro)}>Download CSV</button></p>
    </div>
  )
}
