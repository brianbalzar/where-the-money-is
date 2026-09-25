import type { Bins } from './types'

export const NODATA = -1

/**
 * Bin index for a value: 0..breaks.length-1, OUTLIER = breaks.length, or NODATA.
 * Values below the floor clamp into bin 0 (bins are fixed on the latest year,
 * so earlier years can dip below it).
 */
export function binOf(v: number | null | undefined, b: Bins): number {
  if (v == null || !Number.isFinite(v)) return NODATA
  if (b.outlierMin != null && v > b.outlierMin) return b.breaks.length
  let i = 0
  for (let k = 1; k < b.breaks.length; k++) if (v >= b.breaks[k]) i = k
  return i
}

/**
 * Pick n colours from a 6-step ramp, spread evenly, always keeping the
 * lightest and darkest. If de-duplication left fewer than 6 bins the legend
 * still spans the full ramp instead of stopping halfway.
 */
export function spreadRamp(ramp: string[], n: number): string[] {
  if (n >= ramp.length) return ramp.slice(0, n)
  if (n <= 1) return [ramp[Math.floor(ramp.length / 2)]]
  return Array.from({ length: n }, (_, i) => ramp[Math.round((i * (ramp.length - 1)) / (n - 1))])
}

/** 1-based ramp step used for each of n bins (matches spreadRamp). */
export function spreadIdx(n: number, steps = 6): number[] {
  if (n >= steps) return Array.from({ length: n }, (_, i) => i + 1)
  if (n <= 1) return [Math.floor(steps / 2) + 1]
  return Array.from({ length: n }, (_, i) => Math.round((i * (steps - 1)) / (n - 1)) + 1)
}
