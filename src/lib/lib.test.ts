import { describe, expect, it } from 'vitest'
import { binOf, NODATA, spreadIdx, spreadRamp } from './bins'
import { bearingDeg, compass16, haversineMi } from './geo'
import { searchMetros } from './search'
import { fmtDollars } from './format'
import type { MetroMeta } from './types'

describe('binOf', () => {
  const b = { breaks: [30000, 50000, 70000], outlierMin: 190000, outliers: [] }
  it('bins by lower bound', () => {
    expect(binOf(30000, b)).toBe(0)
    expect(binOf(49999, b)).toBe(0)
    expect(binOf(50000, b)).toBe(1)
    expect(binOf(189000, b)).toBe(2)
  })
  it('clamps below the floor into bin 0', () => expect(binOf(1000, b)).toBe(0))
  it('flags outliers strictly above outlierMin', () => {
    expect(binOf(190000, b)).toBe(2)
    expect(binOf(190001, b)).toBe(3)
  })
  it('null is no data, never a ramp colour', () => {
    expect(binOf(null, b)).toBe(NODATA)
    expect(binOf(undefined, b)).toBe(NODATA)
  })
  it('no outlier bin when outlierMin is null', () => expect(binOf(1e9, { ...b, outlierMin: null })).toBe(2))
})

describe('spreadRamp', () => {
  it('keeps the ends when bins < steps', () => {
    expect(spreadIdx(5)).toEqual([1, 2, 4, 5, 6])
    expect(spreadIdx(6)).toEqual([1, 2, 3, 4, 5, 6])
  })
  it('spreadRamp and spreadIdx agree', () => {
    const r = ['1', '2', '3', '4', '5', '6']
    for (let n = 1; n <= 6; n++) expect(spreadRamp(r, n)).toEqual(spreadIdx(n).map(String))
  })
})

describe('geo', () => {
  it('haversine: downtown Dallas to downtown Fort Worth ≈ 30 mi', () => {
    const d = haversineMi(32.7801, -96.8005, 32.7555, -97.3308)
    expect(d).toBeGreaterThan(30)
    expect(d).toBeLessThan(32)
  })
  it('16-point compass', () => {
    expect(compass16(0)).toBe('north')
    expect(compass16(337.5)).toBe('north-northwest')
    expect(compass16(359)).toBe('north')
    expect(compass16(bearingDeg(32.78, -96.80, 33.15, -96.82))).toBe('north')
  })
})

describe('searchMetros', () => {
  const m = (id: string, rank: number, name: string, cities: string[], states: string[]): MetroMeta => ({
    id, rank, name, shortName: name, pop: 0, popYear: 2024, principalCities: cities, states, bbox: [0, 0, 1, 1], landmarks: [], zipCount: 0, suppressedCount: 0,
  })
  const list = [
    m('19100', 4, 'Dallas-Fort Worth-Arlington, TX', ['Dallas', 'Fort Worth', 'Arlington'], ['TX']),
    m('47900', 6, 'Washington-Arlington-Alexandria, DC-VA-MD-WV', ['Washington', 'Arlington', 'Alexandria'], ['DC', 'VA', 'MD', 'WV']),
    m('41740', 17, 'San Diego-Chula Vista-Carlsbad, CA', ['San Diego'], ['CA']),
  ]
  it('empty query lists by rank', () => expect(searchMetros(list, '').map((x) => x.rank)).toEqual([4, 6, 17]))
  it('matches any principal city', () => expect(searchMetros(list, 'arlington').map((x) => x.id)).toEqual(['19100', '47900']))
  it('is diacritic- and case-insensitive', () => expect(searchMetros(list, 'SÁN dieg').map((x) => x.id)).toEqual(['41740']))
  it('matches state', () => expect(searchMetros(list, 'va').map((x) => x.id)).toEqual(['47900']))
})

describe('format', () => {
  it('dollars', () => {
    expect(fmtDollars(158_400)).toBe('$158K')
    expect(fmtDollars(1_234_000)).toBe('$1.2M')
    expect(fmtDollars(18_240)).toBe('$18K')
    expect(fmtDollars(4_250)).toBe('$4.3K')
  })
})
