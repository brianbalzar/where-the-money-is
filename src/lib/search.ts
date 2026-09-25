import type { MetroMeta } from './types'

export const norm = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** Case- and diacritic-insensitive prefix match on any word of title, principal cities or states. */
export function searchMetros(metros: MetroMeta[], q: string): MetroMeta[] {
  const terms = norm(q).split(/[\s,–-]+/).filter(Boolean)
  if (!terms.length) return [...metros].sort((a, b) => a.rank - b.rank)
  return metros
    .filter((m) => {
      const words = norm([m.name, ...m.principalCities, ...m.states].join(' ')).split(/[\s,–\-.]+/)
      return terms.every((t) => words.some((w) => w.startsWith(t)))
    })
    .sort((a, b) => a.rank - b.rank)
}
