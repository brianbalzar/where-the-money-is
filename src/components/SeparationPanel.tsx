import { useState } from 'react'
import type { MetrosFile, MetroMeta } from '../lib/types'
import { fmtMi } from '../lib/format'
import { gapChange, groupedWindow, metroLabel, rankGap, rankGapChange, type Ranked } from '../lib/rank'

export type SepMode = 'current' | 'change'

interface Props {
  mf: MetrosFile
  metro: MetroMeta
  year: number
  onSelect: (id: string) => void
}

export function fmtSignedMi(v: number): string {
  const r = Number(fmtMi(v))
  return r === 0 ? '0.0 mi' : `${r > 0 ? '+' : '−'}${fmtMi(Math.abs(r))} mi`
}

export default function SeparationPanel({ mf, metro, year, onSelect }: Props) {
  const [mode, setMode] = useState<SepMode>('current')
  const [showTied, setShowTied] = useState(false)
  const yi = mf.years.indexOf(year)
  const first = mf.years[0]
  const canChange = yi > 0
  const m = canChange ? mode : 'current'
  if (yi < 0) return null

  const s = metro.summary
  const g0 = fmtMi(s.gapMi[0]), g1 = fmtMi(s.gapMi[yi])
  const list: Ranked<MetroMeta>[] = m === 'current' ? rankGap(mf, yi) : rankGapChange(mf, yi)
  const me = list.find((r) => r.item.id === metro.id)
  const { groups } = groupedWindow(list, (t) => t.id === metro.id, 2)
  const n = mf.metros.length
  const delta = gapChange(metro, yi)

  const rankLine = !me ? 'Not ranked (missing data)'
    : m === 'current'
      ? `${me.tied ? 'Tied ' : ''}#${me.rank} of ${n} metros by current gap`
      : delta > 0 ? `${me.tied ? 'Tied ' : ''}#${me.rank} biggest widening of ${n}`
      : delta < 0 ? `${me.tied ? 'Tied ' : ''}#${me.rank} of ${n} · gap narrowed`
      : `${me.tied ? 'Tied ' : ''}#${me.rank} of ${n} · no change at 0.1 mi precision`

  const since = year === first ? null
    : g0 === g1 ? `About ${g1} mi in both ${first} and ${year}`
    : `${g0} mi → ${g1} mi since ${first}`

  const valueText = (r: Ranked<MetroMeta>) => (m === 'current' ? `${fmtMi(r.value)} mi` : fmtSignedMi(r.value))
  const row = (r: Ranked<MetroMeta>, cur: boolean, moreTied: number) => (
    <button type="button" className={`sep-row${cur ? ' cur' : ''}`} aria-current={cur ? 'true' : undefined}
      onClick={() => !cur && onSelect(r.item.id)}
      aria-label={`${cur ? 'Current metro: ' : 'Show '}${metroLabel(r.item)}, ${r.tied ? 'tied ' : ''}rank ${r.rank}, ${valueText(r)}${moreTied ? `, ${moreTied} more tied at this rank` : ''}`}>
      <span className="sr">{r.tied ? '=' : ''}{r.rank}</span>
      <span className="sn">{cur && <span aria-hidden className="sep-marker">▸ </span>}{metroLabel(r.item)}{moreTied > 0 && <span className="sep-more" aria-hidden> +{moreTied} tied</span>}</span>
      <span className="sv">{valueText(r)}</span>
    </button>
  )

  return (
    <section className="sep" aria-labelledby="sep-h">
      <div className="sep-head">
        <h2 id="sep-h" className="eyebrow">Income–population separation</h2>
      </div>
      <p className="sep-big"><b>{g1} mi</b> <span>{s.gapBearing[yi]}</span></p>
      <p className="sep-sub">Income center is {s.gapBearing[yi]} of the population center, {year}.</p>

      <div className="seg seg-sm" role="radiogroup" aria-label="Rank metros by">
        <button type="button" role="radio" aria-checked={m === 'current'} className={m === 'current' ? 'on' : ''} onClick={() => setMode('current')}>Current gap</button>
        <button type="button" role="radio" aria-checked={m === 'change'} className={m === 'change' ? 'on' : ''}
          disabled={!canChange} aria-disabled={!canChange} title={canChange ? undefined : `Pick a year after ${first} to rank by change`}
          onClick={() => canChange && setMode('change')}>Change since {first}</button>
      </div>
      {!canChange && <p className="sep-note">{first} is the base year, so there is no change to rank. Move the timeline to a later year.</p>}

      <p className="sep-rank"><b>{rankLine}</b></p>
      {since && <p className="sep-since">{since}{m === 'change' && g0 !== g1 ? <span className="sep-delta"> {fmtSignedMi(delta)}</span> : null}</p>}

      <ol className="sep-list" aria-label={m === 'current' ? `Metros ranked by current gap, 1 is the widest; showing ranks near ${metro.shortName}` : `Metros ranked by change in gap since ${first}, 1 is the most widened; showing ranks near ${metro.shortName}`}>
        {groups.map((g) => {
          const cur = g.members.find((r) => r.item.id === metro.id)
          const lead = cur ?? g.members[0]
          const others = g.members.filter((r) => r !== lead)
          return [
            <li key={lead.item.id}>{row(lead, !!cur, cur ? 0 : others.length)}</li>,
            cur && others.length > 0 && (
              <li key="tied" className="sep-tied">
                <button type="button" className="linklike" aria-expanded={showTied} onClick={() => setShowTied(!showTied)}>
                  {showTied ? 'Hide' : 'Also'} tied at #{g.rank}: {others.length} {others.length === 1 ? 'metro' : 'metros'}
                </button>
              </li>
            ),
            ...(cur && showTied ? others.map((r) => <li key={r.item.id} className="sep-tied-row">{row(r, false, 0)}</li>) : []),
          ]
        })}
      </ol>
      <p className="sep-note">{m === 'current' ? 'Rank 1 = widest gap between the income and population centers.' : `Rank 1 = most widened since ${first}. Changes use values rounded to 0.1 mi.`}</p>
    </section>
  )
}
