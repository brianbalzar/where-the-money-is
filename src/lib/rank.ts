import type { MetroMeta, MetrosFile } from './types'
import { fmtMi } from './format'

export interface Ranked<T> { item: T; value: number; rank: number; tied: boolean }

/**
 * Competition ranking ("1, 2, 2, 4"), highest first, on the value as DISPLAYED
 * (`key` rounds it), so two metros that both read "1.7 mi" share a rank.
 * Items whose value is null/NaN are left out. Display order within a tie is by `tiebreak`.
 */
export function rankDesc<T>(items: T[], value: (t: T) => number | null | undefined, key: (v: number) => number,
  tiebreak: (a: T, b: T) => number): Ranked<T>[] {
  const rows = items
    .map((item) => ({ item, v: value(item) }))
    .filter((r): r is { item: T; v: number } => r.v != null && Number.isFinite(r.v))
    .map((r) => ({ item: r.item, value: r.v, k: key(r.v) }))
    .sort((a, b) => b.k - a.k || tiebreak(a.item, b.item))
  const out: Ranked<T>[] = []
  rows.forEach((r, i) => {
    const rank = i > 0 && rows[i - 1].k === r.k ? out[i - 1].rank : i + 1
    out.push({ item: r.item, value: r.value, rank, tied: false })
  })
  for (const r of out) r.tied = out.filter((o) => o.rank === r.rank).length > 1
  return out
}

/** Up to `each` rows either side of index i, shifted so the window stays full at the ends. */
export function neighborWindow<T>(list: T[], i: number, each = 2): { rows: T[]; start: number } {
  const size = Math.min(list.length, each * 2 + 1)
  const start = Math.max(0, Math.min(i - each, list.length - size))
  return { rows: list.slice(start, start + size), start }
}

const r1 = (v: number) => Number(fmtMi(v))           // gap precision: 0.1 mi
const byName = (a: MetroMeta, b: MetroMeta) => a.shortName.localeCompare(b.shortName)

export function yearIndex(mf: MetrosFile, year: number): number {
  return mf.years.indexOf(year)
}

export function rankIncome(mf: MetrosFile, yi: number) {
  return rankDesc(mf.metros, (m) => m.summary.avgIncome[yi], (v) => Math.round(v / 1000), byName) // $K as displayed
}
export function rankShare(mf: MetrosFile, yi: number) {
  return rankDesc(mf.metros, (m) => m.summary.share200k[yi], (v) => Math.round(v * 10) / 10, byName)
}
export function rankGap(mf: MetrosFile, yi: number) {
  return rankDesc(mf.metros, (m) => m.summary.gapMi[yi], r1, byName)
}
/** Change in gap since the first year, rounded as displayed; rank 1 = most widened. */
export function gapChange(m: MetroMeta, yi: number): number {
  return r1(m.summary.gapMi[yi]) - r1(m.summary.gapMi[0])
}
export function rankGapChange(mf: MetrosFile, yi: number) {
  if (yi <= 0) return []
  return rankDesc(mf.metros, (m) => gapChange(m, yi), (v) => Math.round(v * 10) / 10, byName)
}

export function rankOfMetro<T extends { item: MetroMeta }>(list: T[], id: string): T | undefined {
  return list.find((r) => r.item.id === id)
}

/** Display name with state(s) so e.g. "Portland, OR" and "Columbus, OH" are unambiguous. */
export function metroLabel(m: MetroMeta): string {
  return m.shortName.includes(',') ? m.shortName : `${m.shortName}, ${m.states.join('-')}`
}

export function ordinalText(rank: number, of: number, tied: boolean): string {
  return `${tied ? 'tied ' : ''}#${rank} of ${of}`
}

export interface RankGroup<T> { rank: number; members: Ranked<T>[] }

/**
 * Neighbours by DISTINCT rank: up to `each` rank groups above and below the
 * selected item's group (shifted at the ends to keep the window full), so a
 * big tie can never crowd out the metros with larger or smaller values.
 */
export function groupedWindow<T>(list: Ranked<T>[], isMe: (t: T) => boolean, each = 2): { groups: RankGroup<T>[]; mine: number } {
  const groups: RankGroup<T>[] = []
  for (const r of list) {
    const g = groups[groups.length - 1]
    if (g && g.rank === r.rank) g.members.push(r)
    else groups.push({ rank: r.rank, members: [r] })
  }
  const gi = groups.findIndex((g) => g.members.some((m) => isMe(m.item)))
  if (gi < 0) return { groups: [], mine: -1 }
  const { rows, start } = neighborWindow(groups, gi, each)
  return { groups: rows, mine: gi - start }
}
