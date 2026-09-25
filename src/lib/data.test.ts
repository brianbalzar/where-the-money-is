// Runs against the real published data (public/data), not a fixture.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { binOf, NODATA } from './bins'
import type { MetroData, MetrosFile, Measure } from './types'

const root = new URL('../../public/data/', import.meta.url)
const metros: MetrosFile = JSON.parse(readFileSync(new URL('metros.json', root), 'utf8'))

describe('metros.json', () => {
  it('lists 50 metros ranked 1..50 with unique ids', () => {
    expect(metros.metros.length).toBe(50)
    expect(new Set(metros.metros.map((m) => m.id)).size).toBe(50)
    expect(metros.metros.map((m) => m.rank)).toEqual([...metros.metros.map((m) => m.rank)].sort((a, b) => a - b))
  })
  it('includes Dallas–Fort Worth with its curated landmarks', () => {
    const dfw = metros.metros.find((m) => m.id === '19100')!
    expect(dfw.landmarks.map((l) => l.name)).toContain('Colleyville')
  })
})

describe.each(metros.metros.map((m) => [m.shortName, m.id]))('%s', (_n, id) => {
  const d: MetroData = JSON.parse(readFileSync(new URL(`${id}/data.json`, root), 'utf8'))
  const geo = JSON.parse(readFileSync(new URL(`${id}/zctas.geojson`, root), 'utf8'))
  const last = d.years.length - 1

  it('has one center per year for every kind, and gaps', () => {
    for (const k of ['income', 'pop', 'aboveAvg'] as const) expect(d.centers[k].length).toBe(d.years.length)
    expect(d.gapMi.length).toBe(d.years.length)
  })

  it('every map polygon has a data row and vice versa', () => {
    const ids = new Set(geo.features.map((f: { properties: { zcta: string } }) => f.properties.zcta))
    expect(ids.size).toBe(Object.keys(d.zips).length)
    for (const z of Object.keys(d.zips)) expect(ids.has(z)).toBe(true)
  })

  it.each(['income', 'wealth', 'share200k'] as Measure[])('%s: no empty legend bin in the latest year', (m) => {
    const b = d.bins[m]
    const counts = new Map<number, number>()
    for (const z of Object.values(d.zips)) {
      const k = binOf(z[m][last], b)
      counts.set(k, (counts.get(k) ?? 0) + 1)
    }
    const nb = b.breaks.length + (b.outlierMin != null ? 1 : 0)
    for (let i = 0; i < nb; i++) expect(counts.get(i) ?? 0, `bin ${i}`).toBeGreaterThan(0)
    // an edge at or below the minimum would leave bin 0 permanently empty
    const vals = Object.values(d.zips).map((z) => z[m][last]).filter((v): v is number => v != null)
    expect(b.breaks.slice(1).every((e) => e > Math.min(...vals))).toBe(true)
    expect(counts.get(NODATA) ?? 0).toBe(d.suppressedZips.length)
  })

  it('outliers are at most ~3% of ZIPs and are named', () => {
    for (const m of ['income', 'wealth'] as const) {
      const b = d.bins[m]
      expect(b.outliers.length).toBeLessThanOrEqual(Math.floor(0.03 * Object.keys(d.zips).length))
      for (const o of b.outliers) expect(o.value).toBeGreaterThan(b.outlierMin!)
    }
    expect(d.bins.share200k.outlierMin).toBeNull()
  })
})
