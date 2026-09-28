import { useMemo, useState } from 'react'
import type { Measure, MetroData } from '../lib/types'
import { NODATA } from '../lib/bins'
import { CHANGE_TITLE, changeBinOf, fmtChange, type ChangeLayer } from '../lib/change'

interface Props {
  measure: Measure
  data: MetroData
  year: number
  change: ChangeLayer | null
  onHoverBin: (b: number | null) => void
  locked: number | null
  onLock: (b: number | null) => void
  variant?: 'bar' | 'list'
}

const LABELS = ['Much slower', 'Slower', 'A bit slower', 'About like the metro', 'A bit faster', 'Faster', 'Much faster']

/** Legend for the change view: 7 diverging classes centred on the metro's own change. */
export default function ChangeLegend({ measure, data, year, change, onHoverBin, locked, onLock, variant = 'bar' }: Props) {
  const [hovered, setHovered] = useState<number | null>(null)
  const first = data.years[0]
  const counts = useMemo(() => {
    const c = new Map<number, number>()
    if (!change) return c
    for (const v of change.byZip.values()) { const k = changeBinOf(v, change.bins); c.set(k, (c.get(k) ?? 0) + 1) }
    return c
  }, [change])

  const head = (
    <div className="legend-head">
      <span className="eyebrow">{CHANGE_TITLE[measure]}, {first}–{year}</span>
      <span className="legend-units">{measure === 'income' ? 'real %' : measure === 'wealth' ? `${data.dollarYear} $` : 'points'}</span>
    </div>
  )
  if (!change) {
    return (
      <div className="legend">
        {head}
        <p className="legend-status"><span className="hint">{first} is the starting year. Move the timeline to a later year to see change.</span></p>
      </div>
    )
  }
  const { center, t } = change.bins
  const edges = [center - t[2], center - t[1], center - t[0], center + t[0], center + t[1], center + t[2]]
  const range = (i: number) => {
    if (i === NODATA) return `No ${first} value`
    if (i === 0) return `Below ${fmtChange(measure, edges[0])}`
    if (i === 6) return `Above ${fmtChange(measure, edges[5])}`
    return `${fmtChange(measure, edges[i - 1])} to ${fmtChange(measure, edges[i])}`
  }
  const hover = (i: number) => ({
    onMouseEnter: () => { setHovered(i); onHoverBin(i) }, onMouseLeave: () => { setHovered(null); onHoverBin(null) },
    onFocus: () => { setHovered(i); onHoverBin(i) }, onBlur: () => { setHovered(null); onHoverBin(null) },
    onClick: () => onLock(locked === i ? null : i), 'aria-pressed': locked === i,
  })
  const focus = hovered ?? locked
  const status = (
    <div className="legend-status" aria-live="polite">
      {focus != null
        ? <><span><b>{focus === NODATA ? range(focus) : `${LABELS[focus]}: ${range(focus)}`}</b> · {counts.get(focus) ?? 0} ZIPs</span>
            {locked != null && <button type="button" className="linklike" onClick={() => onLock(null)}>Clear highlight</button>}</>
        : <span className="hint">Hover or click a color to highlight its ZIPs</span>}
    </div>
  )
  const note = (
    <p className="legend-note">
      Colored relative to the metro as a whole, which changed <b>{fmtChange(measure, center)}</b>. Gray ZIPs kept pace; purple grew faster, orange slower.
      {measure === 'share200k' && ' The $200K line is nominal, so part of every rise is inflation.'}
      {measure === 'wealth' && ' Capital income swings with markets.'}
    </p>
  )

  if (variant === 'list') {
    return (
      <div className="legend legend-list">
        {head}
        {[6, 5, 4, 3, 2, 1, 0].map((i) => (
          <button type="button" key={i} className={`legend-row${locked === i ? ' active' : ''}`} onClick={() => onLock(locked === i ? null : i)}>
            <span className="sw" style={{ background: `var(--div-${i + 1})` }} />
            <span>{LABELS[i]} <span className="cnt">({range(i)})</span></span>
            <span className="cnt">{counts.get(i) ?? 0} ZIPs</span>
          </button>
        ))}
        <div className="legend-row"><span className="sw sw-nodata" /><span>No {first} value</span><span className="cnt">{counts.get(NODATA) ?? 0} ZIPs</span></div>
        {locked != null && <button type="button" className="linklike" onClick={() => onLock(null)}>Clear highlight</button>}
        {note}
      </div>
    )
  }
  return (
    <div className="legend">
      {head}
      <div className="legend-bar div-bar">
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <button type="button" key={i} className={`lg-cell${locked === i ? ' active' : ''}`} {...hover(i)} aria-label={`Highlight ${LABELS[i].toLowerCase()} (${range(i)}), ${counts.get(i) ?? 0} ZIPs`}>
            <span className="sw" style={{ background: `var(--div-${i + 1})` }} />
          </button>
        ))}
        <button type="button" className={`lg-cell lg-nd${locked === NODATA ? ' active' : ''}`} {...hover(NODATA)} aria-label={`Highlight ZIPs with no ${first} value`}>
          <span className="sw sw-nodata" />
          <span className="lg-tick">No data</span>
        </button>
      </div>
      <div className="div-ticks" aria-hidden>
        <span>slower</span><span>{fmtChange(measure, center)} metro</span><span>faster</span>
      </div>
      {status}
      {note}
    </div>
  )
}
