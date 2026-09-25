import { useMemo, useState } from 'react'
import type { Measure, MetroData } from '../lib/types'
import { binOf, NODATA, spreadIdx } from '../lib/bins'
import { fmtTick, fmtValue, MEASURE_TITLE } from '../lib/format'

const RAMP_KEY: Record<Measure, string> = { income: 'income', wealth: 'wealth', share200k: 'share' }

interface Props {
  measure: Measure
  data: MetroData
  year: number
  onHoverBin: (b: number | null) => void
  locked: number | null
  onLock: (b: number | null) => void
  variant?: 'bar' | 'list'
}

export default function Legend({ measure, data, year, onHoverBin, locked, onLock, variant = 'bar' }: Props) {
  const [hovered, setHovered] = useState<number | null>(null)
  const [showAll, setShowAll] = useState(false)
  const b = data.bins[measure]
  const n = b.breaks.length
  const key = RAMP_KEY[measure]
  const idx = spreadIdx(n)
  const hasOut = b.outlierMin != null && b.outliers.length > 0
  const yi = data.years.indexOf(year)

  const counts = useMemo(() => {
    const c = new Map<number, number>()
    for (const z of Object.values(data.zips)) {
      const k = binOf(z[measure][yi], b)
      c.set(k, (c.get(k) ?? 0) + 1)
    }
    return c
  }, [data, measure, yi, b])

  const units = measure === 'share200k' ? 'share of returns' : `${data.dollarYear} $`
  const outs = showAll ? b.outliers : b.outliers.slice(0, 3)
  const hover = (i: number | null) => ({
    onMouseEnter: () => { setHovered(i); onHoverBin(i) },
    onMouseLeave: () => { setHovered(null); onHoverBin(null) },
    onFocus: () => { setHovered(i); onHoverBin(i) },
    onBlur: () => { setHovered(null); onHoverBin(null) },
    onClick: () => onLock(locked === i ? null : i),
    'aria-pressed': locked === i,
  })

  const upper = (i: number) => (i < n - 1 ? b.breaks[i + 1] : b.outlierMin)
  const rangeText = (i: number) => {
    if (i === NODATA) return 'No data (IRS-suppressed)'
    if (i === n) return `Over ${fmtTick(measure, b.outlierMin!)} (outliers)`
    const hi = upper(i)
    return hi != null ? `${fmtTick(measure, b.breaks[i])} to ${fmtTick(measure, hi)}` : `${fmtTick(measure, b.breaks[i])} and up`
  }
  const focus = hovered ?? locked
  const status = (
    <div className="legend-status" aria-live="polite">
      {focus != null ? (
        <>
          <span><b>{rangeText(focus)}</b> · {counts.get(focus) ?? 0} ZIPs</span>
          {locked != null && <button type="button" className="linklike" onClick={() => onLock(null)}>Clear highlight</button>}
        </>
      ) : <span className="hint">Hover or click a color to highlight its ZIPs</span>}
    </div>
  )

  if (variant === 'list') {
    return (
      <div className="legend legend-list">
        <div className="legend-head"><span className="eyebrow">{MEASURE_TITLE[measure]}, {year}</span><span className="legend-units">{units}</span></div>
        {Array.from({ length: n }, (_, i) => (
          <button type="button" className={`legend-row${locked === i ? ' active' : ''}`} key={i} onClick={() => onLock(locked === i ? null : i)}>
            <span className="sw" style={{ background: `var(--ramp-${key}-${idx[i]})` }} />
            <span>{fmtTick(measure, b.breaks[i])}{upper(i) != null ? `–${fmtTick(measure, upper(i)!)}` : '+'}</span>
            <span className="cnt">{counts.get(i) ?? 0} ZIPs</span>
          </button>
        ))}
        {hasOut && (
          <div className="legend-row"><span className="sw sw-out" style={{ background: `var(--ramp-${key}-out)` }} /><span>Over {fmtTick(measure, b.outlierMin!)}</span><span className="cnt">{counts.get(n) ?? 0} ZIPs</span></div>
        )}
        <div className="legend-row"><span className="sw sw-nodata" /><span>No data</span><span className="cnt">{counts.get(NODATA) ?? 0} ZIPs</span></div>
        {locked != null && <button type="button" className="linklike" onClick={() => onLock(null)}>Clear highlight</button>}
        <Notes measure={measure} />
      </div>
    )
  }

  return (
    <div className="legend">
      <div className="legend-head"><span className="eyebrow">{MEASURE_TITLE[measure]}, {year}</span><span className="legend-units">{units}</span></div>
      <div className="legend-bar">
        {Array.from({ length: n }, (_, i) => (
          <button type="button" key={i} className={`lg-cell${locked === i ? ' active' : ''}`} {...hover(i)} aria-label={`Highlight ${fmtTick(measure, b.breaks[i])} bin, ${counts.get(i) ?? 0} ZIPs`}>
            <span className="sw" style={{ background: `var(--ramp-${key}-${idx[i]})` }} />
            <span className="lg-tick">{fmtTick(measure, b.breaks[i])}</span>
          </button>
        ))}
        {hasOut && (
          <button type="button" className={`lg-cell lg-out${locked === n ? ' active' : ''}`} {...hover(n)} aria-label={`Highlight outliers, ${counts.get(n) ?? 0} ZIPs`}>
            <span className="sw sw-out" style={{ background: `var(--ramp-${key}-out)` }} />
            <span className="lg-tick">{fmtTick(measure, b.outlierMin!)}+</span>
          </button>
        )}
        <button type="button" className={`lg-cell lg-nd${locked === NODATA ? ' active' : ''}`} {...hover(NODATA)} aria-label={`Highlight ZIPs with no data, ${counts.get(NODATA) ?? 0}`}>
          <span className="sw sw-nodata" />
          <span className="lg-tick">No data</span>
        </button>
      </div>
      {status}
      {hasOut && (
        <p className="legend-outliers">
          <b>Outliers{year !== data.years[data.years.length - 1] ? ` (${data.years[data.years.length - 1]} values)` : ''}:</b>{' '}
          {outs.map((o, i) => (
            <span key={o.zcta}>{i > 0 && ' · '}{o.zcta} {o.place} {fmtValue(measure, o.value)}</span>
          ))}
          {b.outliers.length > 3 && (
            <> · <button type="button" className="linklike" onClick={() => setShowAll(!showAll)}>{showAll ? 'fewer' : `+${b.outliers.length - 3} more`}</button></>
          )}
        </p>
      )}
      <Notes measure={measure} />
    </div>
  )
}

function Notes({ measure }: { measure: Measure }) {
  if (measure === 'share200k')
    return <p className="legend-note">The $200K line is in nominal dollars, so part of the rise over time is inflation.</p>
  if (measure === 'wealth')
    return <p className="legend-note">Dividends, interest and capital gains per return. A proxy for wealth, not net worth; it swings with markets (note 2021).</p>
  return <p className="legend-note">Average (mean) adjusted gross income per tax return. Bins are fixed on the latest year. Dashed outlines are newer ZIPs the IRS doesn’t list; their values are estimated.</p>
}
