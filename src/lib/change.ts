import type { Measure, MetroData, ZipRow } from './types'
import { NODATA } from './bins'

export type MapView = 'level' | 'change'

/**
 * Change from the first year to year index `yi`, in the unit that reads best per measure:
 *  income    -> % real change            (+26 = +26%)
 *  wealth    -> real $ change per return (capital income can be ~0 or negative in the base year)
 *  share200k -> percentage-point change
 */
export function changeOf(m: Measure, v0: number | null | undefined, v1: number | null | undefined): number | null {
  if (v0 == null || v1 == null || !Number.isFinite(v0) || !Number.isFinite(v1)) return null
  if (m === 'income') return v0 > 0 ? (v1 / v0 - 1) * 100 : null
  return v1 - v0
}

export function zipChange(row: ZipRow | undefined, m: Measure, yi: number): number | null {
  return row ? changeOf(m, row[m][0], row[m][yi]) : null
}

export function metroChange(d: MetroData, m: Measure, yi: number): number | null {
  return changeOf(m, d.metroAvg[m][0], d.metroAvg[m][yi])
}

export interface ChangeBins { center: number; t: [number, number, number] } // 7 classes

const niceStep = (m: Measure, v: number) => {
  if (m === 'wealth') return v < 1000 ? Math.max(50, Math.round(v / 50) * 50) : Math.round(v / 500) * 500
  return v < 10 ? Math.max(0.5, Math.round(v * 2) / 2) : Math.round(v)
}

/**
 * Seven diverging classes symmetric around the metro's own change:
 * |d| <= t1 is "about like the metro"; t2, t3 mark faster/slower; beyond t3 is the extreme.
 * Thresholds are quantiles of |d| so every metro and year gets a readable spread.
 */
export function changeBins(values: number[], center: number, m: Measure): ChangeBins {
  const a = values.map((v) => Math.abs(v - center)).sort((x, y) => x - y)
  const q = (p: number) => (a.length ? a[Math.min(a.length - 1, Math.floor(p * (a.length - 1)))] : 1)
  let t1 = niceStep(m, q(0.25)), t2 = niceStep(m, q(0.6)), t3 = niceStep(m, q(0.88))
  const min = m === 'wealth' ? 50 : 0.5
  t1 = Math.max(t1, min); t2 = Math.max(t2, t1 + min); t3 = Math.max(t3, t2 + min)
  return { center, t: [t1, t2, t3] }
}

/** 0..6, slowest to fastest; 3 = about like the metro. */
export function changeBinOf(v: number | null, b: ChangeBins): number {
  if (v == null) return NODATA
  const d = v - b.center, [t1, t2, t3] = b.t
  if (d < -t3) return 0
  if (d < -t2) return 1
  if (d < -t1) return 2
  if (d <= t1) return 3
  if (d <= t2) return 4
  if (d <= t3) return 5
  return 6
}

export function fmtChange(m: Measure, v: number): string {
  const sign = v > 0 ? '+' : v < 0 ? '−' : ''
  const a = Math.abs(v)
  if (m === 'income') return `${sign}${a < 10 ? a.toFixed(1) : Math.round(a)}%`
  if (m === 'share200k') return `${sign}${a.toFixed(1)} pts`
  return `${sign}$${a >= 1000 ? (a / 1000).toFixed(1) + 'K' : Math.round(a)}`
}

export const CHANGE_TITLE: Record<Measure, string> = {
  income: 'Real change in average income',
  wealth: 'Change in capital income per return',
  share200k: 'Change in share of returns $200K+',
}

export interface ChangeLayer {
  bins: ChangeBins
  metro: number
  byZip: Map<string, number | null>
}

/** Everything the map and legend need for the change view, or null in the base year. */
export function changeLayer(d: MetroData, m: Measure, yi: number): ChangeLayer | null {
  if (yi <= 0) return null
  const metro = metroChange(d, m, yi)
  if (metro == null) return null
  const byZip = new Map<string, number | null>()
  const vals: number[] = []
  for (const [z, row] of Object.entries(d.zips)) {
    const c = zipChange(row, m, yi)
    byZip.set(z, c)
    if (c != null) vals.push(c)
  }
  return { bins: changeBins(vals, metro, m), metro, byZip }
}
