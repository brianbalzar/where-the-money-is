import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { changeBinOf, changeBins, changeLayer, changeOf, fmtChange } from './change'
import { NODATA } from './bins'
import type { MetroData } from './types'

const dfw: MetroData = JSON.parse(readFileSync(new URL('../../public/data/19100/data.json', import.meta.url), 'utf8'))
const last = dfw.years.length - 1

describe('changeOf units', () => {
  it('income is % real change; wealth is $; share is points', () => {
    expect(changeOf('income', 80000, 100000)).toBeCloseTo(25)
    expect(changeOf('wealth', -500, 1500)).toBe(2000)
    expect(changeOf('share200k', 4.1, 7.3)).toBeCloseTo(3.2)
  })
  it('missing or non-positive income base gives null, never Infinity', () => {
    expect(changeOf('income', null, 100)).toBeNull()
    expect(changeOf('income', 0, 100)).toBeNull()
    expect(changeOf('share200k', 3, undefined)).toBeNull()
  })
  it('formats with explicit signs', () => {
    expect(fmtChange('income', 26.4)).toBe('+26%'); expect(fmtChange('income', -3.24)).toBe('−3.2%')
    expect(fmtChange('share200k', 2.04)).toBe('+2.0 pts'); expect(fmtChange('wealth', 2400)).toBe('+$2.4K')
  })
})

describe('diverging bins', () => {
  const b = changeBins([10, 20, 26, 30, 40, 60, -5], 26, 'income')
  it('are symmetric around the metro change and ordered', () => {
    expect(b.center).toBe(26)
    expect(b.t[0]).toBeLessThan(b.t[1]); expect(b.t[1]).toBeLessThan(b.t[2])
  })
  it('the metro value itself is the neutral class; extremes land at the ends', () => {
    expect(changeBinOf(26, b)).toBe(3)
    expect(changeBinOf(-500, b)).toBe(0)
    expect(changeBinOf(500, b)).toBe(6)
    expect(changeBinOf(null, b)).toBe(NODATA)
  })
})

describe('changeLayer on real DFW data', () => {
  it('is null in the base year', () => expect(changeLayer(dfw, 'income', 0)).toBeNull())
  it('metro change matches metroAvg; ZIPs fall on both sides of neutral', () => {
    const L = changeLayer(dfw, 'income', last)!
    expect(L.metro).toBeCloseTo((dfw.metroAvg.income[last] / dfw.metroAvg.income[0] - 1) * 100, 6)
    const bins = [...L.byZip.values()].map((v) => changeBinOf(v, L.bins))
    expect(bins.some((x) => x >= 0 && x < 3)).toBe(true)
    expect(bins.some((x) => x > 3)).toBe(true)
    expect(bins.filter((x) => x === 3).length).toBeGreaterThan(0)
  })
  it('works for every measure without NaN', () => {
    for (const m of ['income', 'wealth', 'share200k'] as const) {
      const L = changeLayer(dfw, m, last)!
      for (const v of L.byZip.values()) if (v != null) expect(Number.isFinite(v)).toBe(true)
    }
  })
})
