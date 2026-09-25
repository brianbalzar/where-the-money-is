import type { CenterToggles, MetroData } from '../lib/types'
import { fmtMi } from '../lib/format'

/**
 * The centers move a few miles across a metro that is 60+ miles wide, so on the
 * main map the trails collapse into a dot. This inset redraws them magnified,
 * in true proportion (equirectangular around the centers), with a mile scale.
 */
interface Props {
  data: MetroData
  year: number
  toggles: CenterToggles
  onZoom: () => void
  size?: number
  compact?: boolean
}

export default function CenterInset({ data, year, toggles, onZoom, size = 232, compact }: Props) {
  const kinds = (['aboveAvg', 'pop', 'income'] as const).filter((k) => toggles[k])
  const pts = kinds.flatMap((k) => data.centers[k])
  if (!pts.length) return null
  const lat0 = pts.reduce((s, p) => s + p.lat, 0) / pts.length
  const kx = 69.172 * Math.cos((lat0 * Math.PI) / 180) // miles per degree lon
  const ky = 69.0 // miles per degree lat
  const xs = pts.map((p) => p.lon * kx), ys = pts.map((p) => p.lat * ky)
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys)
  const span = Math.max(maxX - minX, maxY - minY, 1.5) * 1.25
  const pad = compact ? 14 : 22
  const inner = size - pad * 2
  const s = inner / span
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2
  const X = (lon: number) => size / 2 + (lon * kx - cx) * s
  const Y = (lat: number) => size / 2 - (lat * ky - cy) * s + 6
  const yi = Math.max(0, data.years.indexOf(year))

  // scale bar: largest of 0.5 / 1 / 2 / 5 mi that fits in 40% of the width
  const bar = [5, 2, 1, 0.5, 0.25].find((m) => m * s <= inner * 0.4) ?? 0.25

  const trail = (k: 'income' | 'pop' | 'aboveAvg') => {
    const c = data.centers[k]
    const past = c.slice(0, yi + 1), fut = c.slice(yi)
    const path = (arr: typeof c) => arr.map((p, i) => `${i ? 'L' : 'M'}${X(p.lon).toFixed(1)},${Y(p.lat).toFixed(1)}`).join('')
    return (
      <g key={k} className={`ins-${k}`}>
        {fut.length > 1 && <path d={path(fut)} className="ins-trail future" />}
        <path d={path(past)} className="ins-halo" />
        <path d={path(past)} className="ins-trail" />
        {c.map((p, i) => <circle key={p.year} cx={X(p.lon)} cy={Y(p.lat)} r={i === yi ? 0 : 2.1} className={`ins-bead${i > yi ? ' future' : ''}`} />)}
        {k === 'income' && <circle cx={X(c[yi].lon)} cy={Y(c[yi].lat)} r={6} className="ins-mark" />}
        {k === 'pop' && <circle cx={X(c[yi].lon)} cy={Y(c[yi].lat)} r={5.6} className="ins-mark" />}
        {k === 'aboveAvg' && <rect x={X(c[yi].lon) - 5} y={Y(c[yi].lat) - 5} width={10} height={10} className="ins-mark" />}
        {!compact && k !== 'aboveAvg' && (() => {
          // put the start-year label behind the trail (opposite its first move)
          const j = Math.min(c.length - 1, 3)
          let dx = X(c[0].lon) - X(c[j].lon), dy = Y(c[0].lat) - Y(c[j].lat)
          const len = Math.hypot(dx, dy) || 1
          dx /= len; dy /= len
          return <text x={X(c[0].lon) + dx * 17} y={Y(c[0].lat) + dy * 13 + 3.5} className="ins-year">{c[0].year}</text>
        })()}
      </g>
    )
  }
  const inc = data.centers.income[yi], pop = data.centers.pop[yi]
  const showGap = toggles.income && toggles.pop

  return (
    <div className={`inset${compact ? ' compact' : ''}`}>
      <div className="inset-head">
        <span className="eyebrow">{compact ? 'Centers' : 'Centers, magnified'}</span>
        <button type="button" className="linklike" onClick={onZoom}>{compact ? 'Zoom' : 'Zoom map'}</button>
      </div>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img"
        aria-label={`Magnified trails of the centers, ${data.years[0]} to ${year}`}>
        {!compact && <text x={size - 8} y={16} className="ins-north" textAnchor="end">N ↑</text>}
        {showGap && <line x1={X(inc.lon)} y1={Y(inc.lat)} x2={X(pop.lon)} y2={Y(pop.lat)} className="ins-gap" />}
        {kinds.map(trail)}
        <g transform={`translate(10, ${size - 12})`}>
          <line x1={0} x2={bar * s} y1={0} y2={0} className="ins-scale" />
          <line x1={0} x2={0} y1={-4} y2={0} className="ins-scale" />
          <line x1={bar * s} x2={bar * s} y1={-4} y2={0} className="ins-scale" />
          <text x={bar * s + 5} y={3} className="ins-year" textAnchor="start" style={{ textAnchor: "start" }}>{bar} mi</text>
        </g>
      </svg>
      {showGap && !compact && <div className="inset-foot">Gap {year}: <b>{fmtMi(data.gapMi[yi])} mi</b></div>}
    </div>
  )
}
