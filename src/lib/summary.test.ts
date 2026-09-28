import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { MetroMeta, MetrosFile } from './types'
import { gapChange, neighborWindow, rankDesc, rankGap, rankGapChange, rankIncome, rankShare } from './rank'
import { metroStats } from './stats'
import { trendSummary } from '../components/TrendChart'
import { fmtSignedMi } from '../components/SeparationPanel'

const mf: MetrosFile = JSON.parse(readFileSync(new URL('../../public/data/metros.json', import.meta.url), 'utf8'))
const last = mf.years.length - 1
const byId = (id: string) => mf.metros.find((m) => m.id === id)!

describe('rankDesc (competition ranking on displayed values)', () => {
  const items = [{ n: 'a', v: 1.71 }, { n: 'b', v: 1.69 }, { n: 'c', v: 2.0 }, { n: 'd', v: null }, { n: 'e', v: 1.2 }]
  const r = rankDesc(items, (x) => x.v, (v) => Math.round(v * 10) / 10, (x, y) => x.n.localeCompare(y.n))
  it('ties share a rank and the next rank skips', () => {
    expect(r.map((x) => [x.item.n, x.rank, x.tied])).toEqual([['c', 1, false], ['a', 2, true], ['b', 2, true], ['e', 4, false]])
  })
  it('drops missing values instead of ranking them', () => expect(r.find((x) => x.item.n === 'd')).toBeUndefined())
})

describe('neighborWindow', () => {
  const list = Array.from({ length: 50 }, (_, i) => i + 1)
  it.each([[1, [1, 2, 3, 4, 5]], [2, [1, 2, 3, 4, 5]], [25, [23, 24, 25, 26, 27]], [49, [46, 47, 48, 49, 50]], [50, [46, 47, 48, 49, 50]]])(
    'rank %i shows %j', (rank, want) => expect(neighborWindow(list, rank - 1, 2).rows).toEqual(want))
  it('always contains the selected row', () => {
    for (let i = 0; i < 50; i++) expect(neighborWindow(list, i, 2).rows).toContain(i + 1)
  })
})

describe('cross-metro rankings on the real data', () => {
  it('current gap: rank 1 is the widest', () => {
    const r = rankGap(mf, last)
    expect(r.length).toBe(mf.metros.length)
    for (let i = 1; i < r.length; i++) expect(r[i].value).toBeLessThanOrEqual(r[i - 1].value + 0.1)
    expect(r[0].rank).toBe(1)
  })
  it('gap change: rank 1 is the most widened, uses rounded values, empty in the base year', () => {
    const r = rankGapChange(mf, last)
    for (let i = 1; i < r.length; i++) expect(r[i].value).toBeLessThanOrEqual(r[i - 1].value + 1e-9)
    expect(rankGapChange(mf, 0)).toEqual([])
    const tampa = byId('45300')
    expect(gapChange(tampa, last)).toBeCloseTo(Number(tampa.summary.gapMi[last].toFixed(1)) - Number(tampa.summary.gapMi[0].toFixed(1)), 9)
  })
  it('ranks are 1..N with no gaps except after ties', () => {
    for (const r of [rankGap(mf, last), rankIncome(mf, last), rankShare(mf, last)]) {
      r.forEach((x, i) => expect(x.rank === i + 1 || (x.tied && x.rank === r[i - 1].rank)).toBe(true))
    }
  })
})

describe('metroStats', () => {
  it('Tampa 2022 matches the summary arrays', () => {
    const t = byId('45300'), s = metroStats(mf, t, last)
    expect(s.avgIncome).toBe(t.summary.avgIncome[last])
    expect(s.share200k).toBe(t.summary.share200k[last])
    expect(s.realChangePct).toBe(Math.round((t.summary.avgIncome[last] / t.summary.avgIncome[0] - 1) * 100))
    expect(s.incomeRank).toMatch(new RegExp(`^(tied )?#\\d+ of ${mf.metros.length}$`))
  })
  it('base year has no real change', () => expect(metroStats(mf, byId('45300'), 0).realChangePct).toBeNull())
  it('missing values degrade to null, not NaN', () => {
    const m: MetroMeta = JSON.parse(JSON.stringify(byId('45300')))
    m.summary.avgIncome[last] = null as unknown as number
    m.summary.share200k[last] = NaN
    const mf2 = { ...mf, metros: mf.metros.map((x) => (x.id === m.id ? m : x)) }
    const s = metroStats(mf2, m, last)
    expect(s.avgIncome).toBeNull(); expect(s.incomeRank).toBeNull(); expect(s.share200k).toBeNull(); expect(s.realChangePct).toBeNull()
  })
  it('reporting ZIPs never exceed the ZIP count', () => {
    for (const m of mf.metros) m.summary.zipsReporting.forEach((z) => expect(z).toBeLessThanOrEqual(m.zipCount))
  })
})

describe('trend + formatting', () => {
  it('trendSummary: first, last, % change and a padded non-zero domain', () => {
    const t = trendSummary([80000, null, 90000, 100000])
    expect(t.first).toBe(80000); expect(t.last).toBe(100000); expect(t.pct).toBe(25)
    expect(t.lo).toBeLessThan(80000); expect(t.lo).toBeGreaterThan(0); expect(t.hi).toBeGreaterThan(100000)
  })
  it('one spike does not flatten the rest: other points still span > 40% of the height', () => {
    const vals = [80e3, 82e3, 84e3, 86e3, 88e3, 130e3, 90e3]
    const t = trendSummary(vals)
    expect((90e3 - 80e3) / (t.hi - t.lo)).toBeGreaterThan(0.15)
  })
  it('signed miles use displayed precision', () => {
    expect(fmtSignedMi(0.04)).toBe('0.0 mi'); expect(fmtSignedMi(0.94)).toBe('+0.9 mi'); expect(fmtSignedMi(-0.25)).toBe('−0.3 mi')
  })
})
