import { useId, useState } from 'react'
import { fmtDollars } from '../lib/format'
import { fmtSignedPct } from '../lib/stats'

interface Props {
  years: number[]
  values: (number | null)[]   // real average income per return
  benchmark?: (number | null)[] // same measure for the US, drawn for comparison
  benchmarkLabel?: string
  year: number
  dollarYear: number
  onYear: (y: number) => void
}

export interface TrendSummary { first: number | null; last: number | null; pct: number | null; lo: number; hi: number }

/** Values and y-domain for the chart. The domain is min..max (not zero-based) with padding,
 *  so one unusual year shows as a bump rather than flattening the rest. */
export function trendSummary(values: (number | null)[]): TrendSummary {
  const v = values.filter((x): x is number => x != null && Number.isFinite(x))
  const first = values.find((x) => x != null) ?? null
  const last = [...values].reverse().find((x) => x != null) ?? null
  const min = v.length ? Math.min(...v) : 0, max = v.length ? Math.max(...v) : 1
  const pad = Math.max((max - min) * 0.12, max * 0.02, 1)
  return { first, last, pct: first && last ? Math.round((last / first - 1) * 100) : null, lo: min - pad, hi: max + pad }
}

const W = 320, H = 96, PL = 6, PR = 6, PT = 10, PB = 18

export default function TrendChart({ years, values, benchmark, benchmarkLabel = 'US average', year, dollarYear, onYear }: Props) {
  const [focus, setFocus] = useState<number | null>(null)
  const tid = useId()
  // one domain for both lines so they are directly comparable
  const s = trendSummary([...values, ...(benchmark ?? [])])
  const x = (i: number) => PL + (i / Math.max(1, years.length - 1)) * (W - PL - PR)
  const y = (v: number) => PT + (1 - (v - s.lo) / (s.hi - s.lo)) * (H - PT - PB)
  const pathOf = (vs: (number | null)[]) => {
    let p = ''
    vs.forEach((v, i) => { if (v != null) p += `${p && vs[i - 1] != null ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}` })
    return p
  }
  const d = pathOf(values)
  const dUS = benchmark ? pathOf(benchmark) : ''
  const sel = years.indexOf(year)
  const show = focus ?? sel
  const first = years[0], last = years[years.length - 1]

  return (
    <div className="trend">
      <div className="trend-head">
        <span className="eyebrow">Metro income trend</span>
        <span className="trend-units">Avg income per return · {dollarYear} dollars</span>
      </div>
      {(() => {
        // Summary ends at the selected year, matching the stats above; the full
        // period stays visible on the line itself.
        const v0 = values[0], vs = sel >= 0 ? values[sel] : null
        if (v0 == null || vs == null) return null
        if (sel === 0) return <p className="trend-sum"><b>{fmtDollars(v0)}</b><span>in {first}, the base year</span></p>
        const pct = Math.round((vs / v0 - 1) * 100)
        const b0 = benchmark?.[0], bs = sel >= 0 ? benchmark?.[sel] : null
        const bpct = b0 != null && bs != null ? Math.round((bs / b0 - 1) * 100) : null
        return (
          <>
            <p className="trend-sum">
              <b>{fmtDollars(v0)} → {fmtDollars(vs)}</b>
              <span>{fmtSignedPct(pct)} after inflation, {first}–{year}</span>
            </p>
            {bpct != null && bs != null && (
              <p className="trend-cmp">
                {benchmarkLabel}: {fmtDollars(b0!)} → {fmtDollars(bs)}, {fmtSignedPct(bpct)}.{' '}
                <b>{vs >= bs ? `${Math.round((vs / bs - 1) * 100)}% above` : `${Math.round((1 - vs / bs) * 100)}% below`}</b> the US in {year}
                {pct !== bpct && <>; grew {pct > bpct ? 'faster' : 'slower'} than the US since {first}</>}.
              </p>
            )}
          </>
        )
      })()}
      <div className="trend-plot">
        <svg viewBox={`0 0 ${W} ${H}`} role="group" aria-label={`Average income per return by year, ${first} to ${last}. Use Tab to move between years; press Enter to show a year on the map.`}>
          {sel >= 0 && <line x1={x(sel)} x2={x(sel)} y1={PT - 6} y2={H - PB} className="trend-sel" />}
          {dUS && <path d={dUS} className="trend-bench" />}
          <path d={d} className="trend-line" />
          {values.map((v, i) => v == null ? null : (
            <g key={years[i]}
              tabIndex={0} role="button"
              aria-label={`${years[i]}: ${fmtDollars(v)} average income per return${benchmark?.[i] != null ? `; ${benchmarkLabel} ${fmtDollars(benchmark[i]!)}` : ''}${years[i] === year ? ', shown on map' : ''}`}
              aria-describedby={show === i ? tid : undefined}
              onMouseEnter={() => setFocus(i)} onMouseLeave={() => setFocus(null)}
              onFocus={() => setFocus(i)} onBlur={() => setFocus(null)}
              onClick={() => onYear(years[i])}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onYear(years[i]) } }}
              className={`trend-pt${i === sel ? ' sel' : ''}`}>
              <rect x={x(i) - 10} y={0} width={20} height={H - PB + 4} className="trend-hit" />
              <circle cx={x(i)} cy={y(v)} r={i === sel ? 4.2 : 2.4} />
            </g>
          ))}
          <text x={x(0)} y={H - 4} className="trend-axis" textAnchor="start">{first}</text>
          <text x={x(years.length - 1)} y={H - 4} className="trend-axis" textAnchor="end">{last}</text>
        </svg>
        {show >= 0 && values[show] != null && (
          <div id={tid} role="tooltip" className="trend-tip"
            style={{
              left: `${(x(show) / W) * 100}%`, top: `${(y(values[show]!) / H) * 100}%`,
              // keep the tooltip inside the panel at either end of the line
              transform: `translate(${show === 0 ? '-8%' : show === years.length - 1 ? '-92%' : '-50%'}, calc(-100% - 10px))`,
            }}>
            <b>{years[show]}</b> {fmtDollars(values[show]!)}
            {benchmark?.[show] != null && <span className="tip-us"> · US {fmtDollars(benchmark[show]!)}</span>}
          </div>
        )}
      </div>
      {dUS && (
        <div className="trend-key" aria-hidden>
          <span><i className="k-metro" /> This metro</span>
          <span><i className="k-us" /> {benchmarkLabel}</span>
        </div>
      )}
      <table className="visually-hidden">
        <caption>Average income per return by year, {dollarYear} dollars</caption>
        <thead><tr><th scope="col">Year</th><th scope="col">This metro</th>{benchmark && <th scope="col">{benchmarkLabel}</th>}</tr></thead>
        <tbody>{years.map((yr, i) => <tr key={yr}><th scope="row">{yr}</th><td>{values[i] != null ? fmtDollars(values[i]!) : 'no data'}</td>
          {benchmark && <td>{benchmark[i] != null ? fmtDollars(benchmark[i]!) : 'no data'}</td>}</tr>)}</tbody>
      </table>
    </div>
  )
}
