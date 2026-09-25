import type { Measure } from './types'

export function fmtDollars(v: number): string {
  if (v < 0) return `−${fmtDollars(-v)}`
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
  if (v >= 100_000) return `$${Math.round(v / 1000)}K`
  if (v >= 10_000) return `$${Math.round(v / 1000)}K`
  if (v >= 1000) return `$${(v / 1000).toFixed(1)}K`
  return `$${Math.round(v)}`
}

export function fmtShare(v: number): string {
  return `${v.toFixed(1)}%`
}

export function fmtValue(m: Measure, v: number): string {
  return m === 'share200k' ? fmtShare(v) : fmtDollars(v)
}

/** Legend tick labels: shorter, no decimals on K above $10K. */
export function fmtTick(m: Measure, v: number): string {
  if (m === 'share200k') return `${Math.round(v)}%`
  if (v < 0) return `−${fmtTick(m, -v)}`
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
  if (v >= 10_000) return `$${Math.round(v / 1000)}K`
  if (v >= 1000) return `$${(v / 1000).toFixed(1)}K`
  return `$${Math.round(v)}`
}

export const fmtInt = (v: number) => v.toLocaleString('en-US')
export const fmtMi = (v: number) => v.toFixed(1)
export const fmtCoord = (v: number) => (v < 0 ? '−' : '') + Math.abs(v).toFixed(4)

export const MEASURE_LABEL: Record<Measure, string> = {
  income: 'Avg income',
  wealth: 'Wealth signal',
  share200k: 'Share $200K+',
}

export const MEASURE_TITLE: Record<Measure, string> = {
  income: 'Average income per return',
  wealth: 'Capital income per return',
  share200k: 'Share of returns $200K+',
}

export function measureCaption(m: Measure, year: number): string {
  if (m === 'income') return `Avg income per return · ${year}`
  if (m === 'wealth') return `Capital income per return · ${year}`
  return `Returns reporting $200K+ · ${year}`
}
