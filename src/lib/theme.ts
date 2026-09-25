import type { Measure } from './types'

export type Theme = 'light' | 'dark'

/** Read a CSS custom property off <html> (theme-aware). */
export function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

const RAMP_KEY: Record<Measure, string> = { income: 'income', wealth: 'wealth', share200k: 'share' }

export function rampColors(m: Measure): { ramp: string[]; outlier: string } {
  const k = RAMP_KEY[m]
  const ramp = [1, 2, 3, 4, 5, 6].map((i) => cssVar(`--ramp-${k}-${i}`))
  const outlier = cssVar(`--ramp-${k}-out`) || ramp[5]
  return { ramp, outlier }
}

export interface MapColors {
  land: string; water: string; road: string; casing: string; label: string; halo: string
  centerIncome: string; centerPop: string; centerAbove: string; gap: string; bg: string
  nodataBg: string; nodataHatch: string; choroOpacity: number; fg3: string
}

export function mapColors(): MapColors {
  return {
    land: cssVar('--map-land'),
    water: cssVar('--map-water'),
    road: cssVar('--map-road'),
    casing: cssVar('--map-road-casing'),
    label: cssVar('--map-label'),
    halo: cssVar('--map-label-halo'),
    centerIncome: cssVar('--center-income'),
    centerPop: cssVar('--center-pop'),
    centerAbove: cssVar('--center-above-avg'),
    gap: cssVar('--gap-line'),
    bg: cssVar('--bg'),
    nodataBg: cssVar('--nodata-bg'),
    nodataHatch: cssVar('--nodata-hatch'),
    choroOpacity: parseFloat(cssVar('--choropleth-opacity')) || 0.74,
    fg3: cssVar('--fg-3'),
  }
}
