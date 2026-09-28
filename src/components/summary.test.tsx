// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within, fireEvent, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { MetrosFile } from '../lib/types'
import { rankGap } from '../lib/rank'
import SeparationPanel from './SeparationPanel'
import TrendChart from './TrendChart'
import MetroStats from './MetroStats'

const root = join(process.cwd(), 'public', 'data')
const read = (p: string) => JSON.parse(readFileSync(join(root, p), 'utf8'))
const mf: MetrosFile = read('metros.json')
const last = mf.years[mf.years.length - 1]
const ranked = rankGap(mf, mf.years.length - 1)

afterEach(cleanup)

describe('SeparationPanel', () => {
  it.each([1, 2, 49, 50])('rank position %i: current marked with aria-current, neighbours clickable', async (pos) => {
    const me = ranked[pos - 1].item
    const onSelect = vi.fn()
    render(<SeparationPanel mf={mf} metro={me} year={last} onSelect={onSelect} />)
    const list = screen.getByRole('list', { name: /ranked by current gap/i })
    const rows = within(list).getAllByRole('button').filter((b) => b.classList.contains('sep-row'))
    expect(rows.length).toBeGreaterThanOrEqual(Math.min(5, new Set(ranked.map((r) => r.rank)).size))
    const current = rows.filter((b) => b.getAttribute('aria-current') === 'true')
    expect(current).toHaveLength(1)
    expect(current[0].textContent).toContain('▸') // not colour alone
    expect(current[0]).toHaveAccessibleName(/^Current metro: /)
    const other = rows.find((b) => b !== current[0])!
    expect(other).toHaveAccessibleName(/^Show .+, (tied )?rank \d+, \d+\.\d mi/)
    await userEvent.click(other)
    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect.mock.calls[0][0]).not.toBe(me.id)
  })

  it('ties never crowd out larger or smaller metros: two distinct ranks above and below', () => {
    // pick the metro inside the largest tie that is not at either end
    const counts = new Map<number, number>()
    ranked.forEach((r) => counts.set(r.rank, (counts.get(r.rank) ?? 0) + 1))
    const distinct = [...counts.keys()]
    const tieRank = distinct.filter((r, i) => i >= 2 && i < distinct.length - 2).sort((a, b) => counts.get(b)! - counts.get(a)!)[0]
    const me = ranked.find((r) => r.rank === tieRank)!.item
    render(<SeparationPanel mf={mf} metro={me} year={last} onSelect={() => {}} />)
    const rows = within(screen.getByRole('list', { name: /ranked by current gap/i })).getAllByRole('button').filter((b) => b.classList.contains('sep-row'))
    const ranks = rows.map((b) => Number(b.querySelector('.sr')!.textContent!.replace('=', '')))
    expect(ranks.filter((r) => r < tieRank).length).toBe(2)
    expect(ranks.filter((r) => r > tieRank).length).toBe(2)
    if (counts.get(tieRank)! > 1) expect(screen.getByRole('button', { name: /also tied at/i })).toBeTruthy()
  })

  it('change mode shows signed values and is disabled in the base year', async () => {
    const tampa = mf.metros.find((m) => m.id === '45300')!
    const { rerender } = render(<SeparationPanel mf={mf} metro={tampa} year={last} onSelect={() => {}} />)
    await userEvent.click(screen.getByRole('radio', { name: /change since/i }))
    const list = screen.getByRole('list', { name: /change in gap/i })
    for (const b of within(list).getAllByRole('button').filter((x) => x.classList.contains('sep-row'))) expect(b).toHaveAccessibleName(/((\+|−)\d+\.\d mi|0\.0 mi)(, \d+ more tied at this rank)?$/)
    rerender(<SeparationPanel mf={mf} metro={tampa} year={mf.years[0]} onSelect={() => {}} />)
    expect(screen.getByRole('radio', { name: /change since/i })).toBeDisabled()
    expect(screen.getByText(/base year/i)).toBeTruthy()
  })

  it('never says a gap changed when the rounded endpoints match', () => {
    const same = mf.metros.find((m) => m.summary.gapMi[0].toFixed(1) === m.summary.gapMi[mf.years.length - 1].toFixed(1))
    if (!same) return
    render(<SeparationPanel mf={mf} metro={same} year={last} onSelect={() => {}} />)
    expect(screen.getByText(/About .* mi in both/)).toBeTruthy()
  })
})

describe('TrendChart', () => {
  it('every year is keyboard reachable with a labelled point and a tooltip; Enter selects the year', async () => {
    const onYear = vi.fn()
    const vals = mf.years.map((_, i) => 80000 + i * 2000)
    render(<TrendChart years={mf.years} values={vals} year={last} dollarYear={last} onYear={onYear} />)
    const pts = screen.getAllByRole('button', { name: /average income per return/ })
    expect(pts).toHaveLength(mf.years.length)
    await userEvent.tab()
    expect(document.activeElement).toBe(pts[0])
    expect(screen.getByRole('tooltip').textContent).toContain(String(mf.years[0]))
    await userEvent.keyboard('{Enter}')
    expect(onYear).toHaveBeenCalledWith(mf.years[0])
    expect(screen.getByText('Metro income trend')).toBeTruthy()
    expect(screen.getAllByText(new RegExp(`${last} dollars`)).length).toBeGreaterThan(0)
    expect(screen.getByRole('table', { hidden: true })).toBeTruthy() // text alternative
  })
})

describe('headline follows the selected year', () => {
  it('uses the selected year, not the last one', async () => {
    const { findingText } = await import('./SummaryTable')
    const d = read('45300/data.json')
    const t = findingText(d, 2018)
    expect(t).toMatch(/^From 2011 to 2018/)
    expect(t).toContain(d.gapMi[d.years.indexOf(2018)].toFixed(1))
    expect(findingText(d, 2011)).toMatch(/^In 2011, the income center sat/)
  })
  it('trend summary ends at the selected year', () => {
    const vals = mf.years.map((_, i) => 80000 + i * 2000)
    render(<TrendChart years={mf.years} values={vals} year={2018} dollarYear={last} onYear={() => {}} />)
    expect(screen.getByText(/2011–2018/)).toBeTruthy()
  })
})

describe('US benchmark', () => {
  it('metros.json carries a full-length US series from the IRS state totals', () => {
    expect(mf.us.avgIncome).toHaveLength(mf.years.length)
    const us = mf.us.avgIncome[mf.years.length - 1]
    expect(us).toBeGreaterThan(80000); expect(us).toBeLessThan(110000) // sanity band, 2022 dollars
    // the US figure includes suppressed ZIPs, so it covers more returns than the 50 metros combined
    const metroReturns = mf.metros.reduce((a, m) => a + m.summary.returns[mf.years.length - 1], 0)
    expect(mf.us.returns[mf.years.length - 1]).toBeGreaterThan(metroReturns)
  })
  it('chart draws the US line, names it in the key, tooltips and text table, and compares at the selected year', async () => {
    const vals = mf.years.map((_, i) => 80000 + i * 2000)
    const { container } = render(<TrendChart years={mf.years} values={vals} benchmark={mf.us.avgIncome} year={2018} dollarYear={last} onYear={() => {}} />)
    expect(container.querySelector('.trend-bench')).not.toBeNull()
    expect(screen.getByText(/US average: .* → .*/)).toBeTruthy()
    expect(screen.getByText(/(above|below)/)).toBeTruthy()
    const pts = screen.getAllByRole('button', { name: /US average \$/ })
    expect(pts).toHaveLength(mf.years.length)
    expect(screen.getByRole('columnheader', { name: 'US average', hidden: true })).toBeTruthy()
  })
})

describe('Metro vs US view', () => {
  it('proportional path grows the first-year metro value at the US rate', async () => {
    const { proportionalPath } = await import('./TrendChart')
    expect(proportionalPath([100, 120, 150], [50, 55, 60])).toEqual([100, 110, 120])
    expect(proportionalPath([null, 1], [1, 2])).toEqual([null, null])
  })
  it('toggle shows a keyboard-accessible point per year and the proportional comparison', async () => {
    const vals = mf.years.map((_, i) => 70000 + i * 2500)
    render(<TrendChart years={mf.years} values={vals} benchmark={mf.us.avgIncome} year={2018} dollarYear={last} onYear={() => {}} />)
    await userEvent.click(screen.getByRole('radio', { name: 'Metro vs US' }))
    const pts = screen.getAllByRole('button', { name: /metro \$.*, US \$.*, at US growth \$/ })
    expect(pts).toHaveLength(mf.years.length)
    expect(screen.getByText(/(above|below) the US-growth path|On pace with the US/)).toBeTruthy()
    expect(screen.getByRole('columnheader', { name: 'Metro at US growth rate', hidden: true })).toBeTruthy()
  })
  it('no toggle without a benchmark', () => {
    render(<TrendChart years={mf.years} values={mf.years.map(() => 1)} year={last} dollarYear={last} onYear={() => {}} />)
    expect(screen.queryByRole('radio', { name: 'Metro vs US' })).toBeNull()
  })
})

describe('MetroStats', () => {
  it('labels rank direction and shows the base-year state', () => {
    const t = mf.metros.find((m) => m.id === '45300')!
    const { rerender } = render(<MetroStats mf={mf} metro={t} year={last} />)
    expect(screen.getByText(/#1 = highest/)).toBeTruthy()
    expect(screen.getAllByLabelText(/1 is highest/).length).toBe(2)
    rerender(<MetroStats mf={mf} metro={t} year={mf.years[0]} />)
    expect(screen.getByText('base year')).toBeTruthy()
  })
})

// ---------------------------------------------------------------- App-level
vi.mock('./MapView', () => ({ default: () => <div data-testid="map" /> }))
vi.mock('./CenterInset', () => ({ default: () => null }))

function stubBrowser(mobile: boolean) {
  window.matchMedia = ((q: string) => ({
    matches: mobile ? /max-width/.test(q) : false, media: q, addEventListener() {}, removeEventListener() {}, onchange: null,
    addListener() {}, removeListener() {}, dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
  vi.stubGlobal('fetch', vi.fn(async (u: string) => {
    const path = String(u).replace(/^.*\/data\//, '')
    return { json: async () => read(path) } as Response
  }))
}

describe('App', () => {
  beforeEach(() => { vi.resetModules() })
  afterEach(() => { vi.unstubAllGlobals() })

  it('desktop: switching metro from the ranking keeps year and measure', async () => {
    stubBrowser(false)
    history.replaceState(null, '', '/?metro=45300&measure=wealth&year=2016')
    const { default: App } = await import('../App')
    render(<App />)
    const list = await screen.findByRole('list', { name: /ranked by current gap/i })
    await waitFor(() => expect(screen.getByText(/Avg income \/ return/i)).toBeTruthy())
    const other = within(list).getAllByRole('button').find((b) => b.getAttribute('aria-current') !== 'true')!
    await act(async () => { fireEvent.click(other) })
    await waitFor(() => expect(new URLSearchParams(location.search).get('metro')).not.toBe('45300'))
    const q = new URLSearchParams(location.search)
    expect(q.get('measure')).toBe('wealth')
    expect(q.get('year')).toBe('2016')
    expect(screen.getByRole('radio', { name: 'Wealth signal' })).toHaveAttribute('aria-checked', 'true')
    expect(await screen.findByText(/^From Downtown .*, 2016: income center/)).toBeTruthy()
    expect(screen.getByRole('checkbox', { name: /Downtown \(CBD\)/ })).toBeChecked()
  })

  it('desktop: the Level / Change toggle recolours the legend and is kept in the URL', async () => {
    stubBrowser(false)
    history.replaceState(null, '', '/?metro=19100&year=2022')
    const { default: App } = await import('../App')
    render(<App />)
    await screen.findByText(/Average income per return, 2022/i)
    await act(async () => { fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Map shows' })).getByRole('radio', { name: /Change since 2011/ })) })
    expect(await screen.findByText(/Real change in average income, 2011–2022/)).toBeTruthy()
    expect(new URLSearchParams(location.search).get('view')).toBe('change')
    expect(screen.getByText(/Colored relative to the metro/)).toBeTruthy()
  })

  it('mobile: collapsed sheet stays concise; expanded sheet has stats, trend and ranking', async () => {
    stubBrowser(true)
    history.replaceState(null, '', '/?metro=33460')
    const { default: App } = await import('../App')
    render(<App />)
    await screen.findByText(/income center/i)
    expect(screen.queryByText('Metro income trend')).toBeNull()
    expect(screen.queryByRole('list', { name: /ranked by/i })).toBeNull()
    const handle = screen.getByRole('button', { name: 'Resize panel' })
    fireEvent.keyDown(handle, { key: 'Enter' })
    expect(await screen.findByText('Metro income trend')).toBeTruthy()
    expect(screen.getByRole('list', { name: /ranked by current gap/i })).toBeTruthy()
    expect(screen.getByText(/Avg income \/ return/i)).toBeTruthy()
  })
})
