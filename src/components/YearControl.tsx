interface Props {
  years: number[]
  year: number
  playing: boolean
  onYear: (y: number) => void
  onPlay: () => void
  onStep?: (d: 1 | -1) => void
  compact?: boolean
}

export default function YearControl({ years, year, playing, onYear, onPlay, onStep, compact }: Props) {
  const first = years[0], last = years[years.length - 1]
  const pct = last > first ? ((year - first) / (last - first)) * 100 : 100
  const labels = years.filter((y, i) => (y - first) % 3 === 0 || i === years.length - 1)
  // drop a 3-year label that would collide with the final year
  const shown = compact ? [first, last] : labels.filter((y) => y === last || last - y >= 2)
  return (
    <div className={`year-ctl${compact ? ' compact' : ''}${onStep && !compact ? ' with-steps' : ''}`}>
      <button type="button" className="play" onClick={onPlay} aria-label={playing ? 'Pause' : 'Play years'}>
        {playing ? (
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden><rect x="3" y="2" width="3.5" height="12" fill="currentColor" /><rect x="9.5" y="2" width="3.5" height="12" fill="currentColor" /></svg>
        ) : (
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden><path d="M4 2 L14 8 L4 14 Z" fill="currentColor" /></svg>
        )}
      </button>
      {!compact && <div className="year-readout" aria-hidden>{year}</div>}
      <div className="track">
        <div className="rail"><div className="rail-fill" style={{ width: `${pct}%` }} /></div>
        <div className="ticks" aria-hidden>
          {years.map((y) => <span key={y} style={{ left: `${((y - first) / (last - first)) * 100}%` }} />)}
        </div>
        <input
          type="range" min={first} max={last} step={1} value={year}
          aria-label="Year" aria-valuetext={String(year)}
          onChange={(e) => onYear(Number(e.target.value))}
        />
        <div className="tick-labels" aria-hidden>
          {shown.map((y) => <span key={y} style={{ left: `${((y - first) / (last - first)) * 100}%` }}>{y}</span>)}
        </div>
      </div>
      {compact && <div className="year-readout" aria-hidden>{year}</div>}
      {onStep && !compact && (
        <div className="year-steps">
          <button type="button" aria-label="Previous year" disabled={year <= first} onClick={() => onStep(-1)}>‹</button>
          <button type="button" aria-label="Next year" disabled={year >= last} onClick={() => onStep(1)}>›</button>
        </div>
      )}
    </div>
  )
}
