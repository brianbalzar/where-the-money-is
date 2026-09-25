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

export type TrendMode = 'timeline' | 'vsUS'

/** Where the metro would be if it had grown at the US rate since the first year. */
export function proportionalPath(values: (number | null)[], bench: (number | null)[]): (number | null)[] {
  const v0 = values[0], b0 = bench[0]
  return bench.map((b) => (v0 != null && b0 != null && b != null && b0 > 0 ? (v0 * b) / b0 : null))
}

export default function TrendChart({ years, values, benchmark, benchmarkLabel = 'US average', year, dollarYear, onYear }: Props) {
  const [focus, setFocus] = useState<number | null>(null)
  const [mode, setMode] = useState<TrendMode>('timeline')
  const tid = useId()
  const canVs = !!benchmark && benchmark.some((b) => b != null)
  const m: TrendMode = canVs ? mode : 'timeline'
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
      {canVs && (
        <div className="seg seg-sm trend-mode" role="radiogroup" aria-label="Trend view">
          <button type="button" role="radio" aria-checked={m === 'timeline'} className={m === 'timeline' ? 'on' : ''} onClick={() => setMode('timeline')}>Over time</button>
          <button type="button" role="radio" aria-checked={m === 'vsUS'} className={m === 'vsUS' ? 'on' : ''} onClick={() => setMode('vsUS')}>Metro vs US</button>
        </div>
      )}
      {m === 'vsUS' && benchmark ? (
        <VsUS years={years} values={values} bench={benchmark} year={year} onYear={onYear} dollarYear={dollarYear} />
      ) : (<>
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
      </>)}
    </div>
  )
}

// ---------------------------------------------------------------------------------------------
// Metro vs US: connected scatter, one dot per year, tail fading toward the first year.
const SW = 320, SH = 190, SL = 40, SR = 10, ST = 12, SB = 30

const kTick = (v: number) => `$${Math.round(v / 1000)}K`

function niceTicks(lo: number, hi: number, n = 3): number[] {
  const step0 = (hi - lo) / n
  const mag = 10 ** Math.floor(Math.log10(step0))
  const step = [1, 2, 2.5, 5, 10].map((k) => k * mag).find((s) => s >= step0) ?? step0
  const out: number[] = []
  for (let t = Math.ceil(lo / step) * step; t <= hi; t += step) out.push(t)
  return out
}

function VsUS({ years, values, bench, year, onYear, dollarYear }: {
  years: number[]; values: (number | null)[]; bench: (number | null)[]; year: number; onYear: (y: number) => void; dollarYear: number
}) {
  const [focus, setFocus] = useState<number | null>(null)
  const tid = useId()
  const prop = proportionalPath(values, bench)
  const sel = years.indexOf(year)
  const show = focus ?? sel
  const pts = years.map((_, i) => (values[i] != null && bench[i] != null ? { i, x: bench[i]!, y: values[i]! } : null)).filter((p): p is { i: number; x: number; y: number } => !!p)
  if (pts.length < 2) return null
  const xs = pts.map((p) => p.x), ys = [...pts.map((p) => p.y), ...prop.filter((v): v is number => v != null)]
  const pad = (a: number, b: number) => Math.max((b - a) * 0.1, b * 0.01)
  const x0 = Math.min(...xs) - pad(Math.min(...xs), Math.max(...xs)), x1 = Math.max(...xs) + pad(Math.min(...xs), Math.max(...xs))
  const y0 = Math.min(...ys) - pad(Math.min(...ys), Math.max(...ys)), y1 = Math.max(...ys) + pad(Math.min(...ys), Math.max(...ys))
  const X = (v: number) => SL + ((v - x0) / (x1 - x0)) * (SW - SL - SR)
  const Y = (v: number) => ST + (1 - (v - y0) / (y1 - y0)) * (SH - ST - SB)
  const k = values[0]! / bench[0]!                       // proportional line: y = k * x
  const first = years[0]
  const cur = sel >= 0 ? pts.find((p) => p.i === sel) : undefined
  const expected = sel >= 0 ? prop[sel] : null
  const vsPath = cur && expected ? Math.round((cur.y / expected - 1) * 100) : null
  const head = Math.max(1, sel)

  return (
    <>
      {cur && expected != null && (
        sel === 0
          ? <p className="trend-sum"><b>{fmtDollars(cur.y)}</b><span>metro vs {fmtDollars(cur.x)} US in {first}, the starting point</span></p>
          : <>
              <p className="trend-sum">
                <b>{vsPath === 0 ? 'On pace with the US' : `${Math.abs(vsPath!)}% ${vsPath! > 0 ? 'above' : 'below'} the US-growth path`}</b>
              </p>
              <p className="trend-cmp">
                Growing at the US rate, {fmtDollars(values[0]!)} in {first} would be <b>{fmtDollars(expected)}</b> in {year}; the metro reached <b>{fmtDollars(cur.y)}</b>.
              </p>
            </>
      )}
      <div className="trend-plot">
        <svg viewBox={`0 0 ${SW} ${SH}`} role="group" className="vsus"
          aria-label={`Metro average income plotted against the US average, one point per year from ${first} to ${years[years.length - 1]}. The dotted line is where the metro would be at the US growth rate. Use Tab to move between years; press Enter to show a year on the map.`}>
          <defs><clipPath id={`${tid}-clip`}><rect x={SL} y={ST} width={SW - SL - SR} height={SH - ST - SB} /></clipPath></defs>
          {niceTicks(y0, y1).map((t) => (
            <g key={`y${t}`}><line x1={SL} x2={SW - SR} y1={Y(t)} y2={Y(t)} className="vs-grid" /><text x={SL - 5} y={Y(t) + 3} textAnchor="end" className="trend-axis">{kTick(t)}</text></g>
          ))}
          {niceTicks(x0, x1).map((t) => (
            <g key={`x${t}`}><line x1={X(t)} x2={X(t)} y1={ST} y2={SH - SB} className="vs-grid" /><text x={X(t)} y={SH - SB + 12} textAnchor="middle" className="trend-axis">{kTick(t)}</text></g>
          ))}
          <text x={(SL + SW - SR) / 2} y={SH - 3} textAnchor="middle" className="vs-label">US average →</text>
          <text x={10} y={(ST + SH - SB) / 2} textAnchor="middle" className="vs-label" transform={`rotate(-90 10 ${(ST + SH - SB) / 2})`}>This metro →</text>
          <line x1={X(x0)} y1={Y(k * x0)} x2={X(x1)} y2={Y(k * x1)} className="vs-prop" clipPath={`url(#${tid}-clip)`} />
          {pts.slice(1).map((p, j) => {
            const a = pts[j]
            const t = p.i / head, future = p.i > sel
            return <line key={`s${p.i}`} x1={X(a.x)} y1={Y(a.y)} x2={X(p.x)} y2={Y(p.y)} className="vs-tail"
              style={{ strokeWidth: future ? 1 : 0.8 + 2.2 * t, opacity: future ? 0.15 : 0.3 + 0.7 * t }} />
          })}
          {pts.map((p) => (
            <g key={years[p.i]} tabIndex={0} role="button"
              aria-label={`${years[p.i]}: metro ${fmtDollars(p.y)}, US ${fmtDollars(p.x)}${prop[p.i] != null ? `, at US growth ${fmtDollars(prop[p.i]!)}` : ''}${years[p.i] === year ? ', shown on map' : ''}`}
              aria-describedby={show === p.i ? tid : undefined}
              onMouseEnter={() => setFocus(p.i)} onMouseLeave={() => setFocus(null)}
              onFocus={() => setFocus(p.i)} onBlur={() => setFocus(null)}
              onClick={() => onYear(years[p.i])}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onYear(years[p.i]) } }}
              className={`trend-pt vs-pt${p.i === sel ? ' sel' : ''}${p.i > sel ? ' future' : ''}`}>
              <circle cx={X(p.x)} cy={Y(p.y)} r={9} className="vs-hit" />
              <circle cx={X(p.x)} cy={Y(p.y)} r={p.i === sel ? 4.6 : 2.4} />
            </g>
          ))}
          {[pts[0], cur].filter(Boolean).map((p) => p && (
            <text key={`l${p.i}`} x={X(p.x) + (p.i === 0 ? -6 : 7)} y={Y(p.y) + (p.i === 0 ? 12 : -7)} textAnchor={p.i === 0 ? 'end' : 'start'} className="vs-year">{years[p.i]}</text>
          ))}
        </svg>
        {show >= 0 && values[show] != null && bench[show] != null && (
          <div id={tid} role="tooltip" className="trend-tip"
            style={{ left: `${(X(bench[show]!) / SW) * 100}%`, top: `${(Y(values[show]!) / SH) * 100}%`,
              transform: `translate(${X(bench[show]!) > SW * 0.7 ? '-92%' : X(bench[show]!) < SW * 0.3 ? '-8%' : '-50%'}, calc(-100% - 10px))` }}>
            <b>{years[show]}</b> {fmtDollars(values[show]!)} <span className="tip-us">· US {fmtDollars(bench[show]!)}</span>
          </div>
        )}
      </div>
      <div className="trend-key" aria-hidden>
        <span><i className="k-metro" /> This metro, {first}→{years[years.length - 1]}</span>
        <span><i className="k-prop" /> At US growth rate</span>
      </div>
      <p className="vs-note">Above the dotted line = outgrew the US since {first}; below = lagged. {dollarYear} dollars.</p>
      <table className="visually-hidden">
        <caption>Metro vs US average income per return, {dollarYear} dollars</caption>
        <thead><tr><th scope="col">Year</th><th scope="col">This metro</th><th scope="col">US average</th><th scope="col">Metro at US growth rate</th></tr></thead>
        <tbody>{years.map((yr, i) => <tr key={yr}><th scope="row">{yr}</th>
          <td>{values[i] != null ? fmtDollars(values[i]!) : 'no data'}</td>
          <td>{bench[i] != null ? fmtDollars(bench[i]!) : 'no data'}</td>
          <td>{prop[i] != null ? fmtDollars(prop[i]!) : 'no data'}</td></tr>)}</tbody>
      </table>
    </>
  )
}
