import type { CSSProperties } from 'react'
import type { Measure, MetroData } from '../lib/types'
import { binOf, spreadIdx } from '../lib/bins'
import { fmtInt, fmtValue, measureCaption } from '../lib/format'

const RAMP_KEY: Record<Measure, string> = { income: 'income', wealth: 'wealth', share200k: 'share' }

export function rankOf(data: MetroData, measure: Measure, yi: number, zip: string): { rank: number; of: number } | null {
  const vals: [string, number][] = []
  for (const [z, r] of Object.entries(data.zips)) {
    const v = r[measure][yi]
    if (v != null) vals.push([z, v])
  }
  vals.sort((a, b) => b[1] - a[1])
  const i = vals.findIndex(([z]) => z === zip)
  return i < 0 ? null : { rank: i + 1, of: vals.length }
}

function Spark({ values, years, year, avg, h }: { values: (number | null)[]; years: number[]; year: number; avg?: number[]; h: number }) {
  const w = 200
  const all = [...values.filter((v): v is number => v != null), ...(avg ?? [])]
  if (all.length < 2) return null
  const lo = Math.min(...all), hi = Math.max(...all)
  const x = (i: number) => (i / (years.length - 1)) * (w - 6) + 3
  const y = (v: number) => h - 3 - ((v - lo) / (hi - lo || 1)) * (h - 6)
  let d = ''
  values.forEach((v, i) => { if (v != null) d += `${d && values[i - 1] != null ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}` })
  const yi = years.indexOf(year)
  const cv = values[yi]
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" height={h} aria-hidden>
      {avg && <path d={avg.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('')} className="spark-avg" />}
      {avg && yi >= 0 && <circle cx={x(yi)} cy={y(avg[yi])} r={2} className="spark-avg-dot" />}
      <path d={d} className="spark-line" />
      {cv != null && <circle cx={x(yi)} cy={y(cv)} r={3} className="spark-dot" />}
    </svg>
  )
}

interface Props {
  data: MetroData
  zip: string
  measure: Measure
  year: number
  mode: 'hover' | 'pinned'
  onUnpin?: () => void
  style?: CSSProperties
}

export default function ZipCard({ data, zip, measure, year, mode, onUnpin, style }: Props) {
  const row = data.zips[zip]
  const yi = data.years.indexOf(year)
  const v = row?.[measure][yi] ?? null
  const place = row?.place ?? ''
  const first = data.years[0], last = data.years[data.years.length - 1]

  if (v == null) {
    const n = row?.ret[yi]
    return (
      <div className={`zip-card suppressed ${mode}`} style={style} role="dialog" aria-label={`ZIP ${zip}`}>
        <div className="zc-top"><span className="zc-zip">{zip}</span><span className="zc-place">{place}</span>
          {mode === 'pinned' && <button type="button" className="unpin" onClick={onUnpin}>Close</button>}</div>
        <div className="zc-nd"><span className="sw sw-nodata" /> <span className="zc-value">No data</span></div>
        <p className="zc-expl">
          The IRS withholds values for ZIPs with fewer than about 100 returns.
          {n != null ? ` This ZIP had ${fmtInt(n)} in ${year}.` : ''} It is excluded from ranks and centers.
        </p>
      </div>
    )
  }

  const rk = rankOf(data, measure, yi, zip)
  const ret = row.ret[yi]
  const series = row[measure]
  const firstV = series.find((s) => s != null) ?? null
  const firstYear = data.years[series.findIndex((s) => s != null)]
  const avg = data.metroAvg[measure][yi]
  const b = data.bins[measure]
  const bi = binOf(v, b)
  const n = b.breaks.length
  const key = RAMP_KEY[measure]
  const swatch = bi === n ? `var(--ramp-${key}-out)` : `var(--ramp-${key}-${spreadIdx(n)[bi]})`
  const pctVsAvg = avg ? ((v - avg) / avg) * 100 : null

  const estNote = row.est && (
    <p className="zc-est">
      <b>Estimated.</b> The IRS file does not list this newer ZIP. Values are modeled from its census population and neighboring ZIP {row.est.from}.
    </p>
  )

  return (
    <div className={`zip-card ${mode}`} style={style} role={mode === 'pinned' ? 'dialog' : undefined} aria-label={`ZIP ${zip}`}>
      <div className="zc-top">
        <span className="zc-zip">{zip}</span><span className="zc-place">{place}</span>
        {mode === 'pinned' && <button type="button" className="unpin" onClick={onUnpin}>Unpin</button>}
      </div>
      <div>
        <div className="zc-value">{fmtValue(measure, v)}</div>
        <div className="zc-cap">{measureCaption(measure, year)}</div>
      </div>
      {mode === 'pinned' && (
        <div className="zc-bin">
          <span className="sw" style={{ background: swatch }} />
          <span>{bi === n ? 'Outlier' : `bin ${bi + 1} of ${n}`}</span>
          {pctVsAvg != null && <span className="zc-vs">{Math.abs(pctVsAvg).toFixed(0)}% {pctVsAvg >= 0 ? 'above' : 'below'} metro average ({fmtValue(measure, avg)})</span>}
        </div>
      )}
      {estNote}
      {mode === 'hover' && (
        <div className="zc-grid2">
          <span>Rank <b>{rk ? `${rk.rank} of ${rk.of}` : '—'}</b></span>
          <span>Returns <b>{ret != null ? fmtInt(ret) : '—'}</b></span>
        </div>
      )}
      <Spark values={series} years={data.years} year={year} h={mode === 'pinned' ? 56 : 42} avg={data.metroAvg[measure]} />
      <div className="zc-key">
        <span><i className="k-zip" /> This ZIP</span>
        <span><i className="k-avg" /> Metro average {fmtValue(measure, data.metroAvg[measure][yi])}</span>
      </div>
      <div className="zc-ends">
        <span>{firstYear ?? first} {firstV != null ? fmtValue(measure, firstV) : '—'}</span>
        <span>{last} {series[series.length - 1] != null ? fmtValue(measure, series[series.length - 1]!) : '—'}</span>
      </div>
      {mode === 'pinned' && (
        <dl className="zc-kv">
          <dt>Rank in metro</dt><dd>{rk ? `${rk.rank} of ${rk.of}` : '—'}</dd>
          <dt>Tax returns</dt><dd>{ret != null ? fmtInt(ret) : '—'}</dd>
          <dt>Change since {firstYear}</dt><dd>{firstV != null ? `${v >= firstV ? '+' : '−'}${Math.abs(((v - firstV) / firstV) * 100).toFixed(0)}%` : '—'}</dd>
          {row.po && <><dt>Note</dt><dd>Includes PO-box ZIP returns</dd></>}
        </dl>
      )}
    </div>
  )
}
