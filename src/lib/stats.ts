import type { MetroMeta, MetrosFile } from './types'
import { ordinalText, rankIncome, rankOfMetro, rankShare } from './rank'

export interface MetroStats {
  avgIncome: number | null
  incomeRank: string | null      // "#14 of 50"
  share200k: number | null
  shareRank: string | null
  realChangePct: number | null   // vs first year; null in the first year or if missing
  returns: number | null
  zipsReporting: number | null
  zipsEstimated: number
  zipCount: number
}

const ok = (v: number | null | undefined): v is number => v != null && Number.isFinite(v)

export function metroStats(mf: MetrosFile, m: MetroMeta, yi: number): MetroStats {
  const s = m.summary
  const inc = s.avgIncome[yi], base = s.avgIncome[0]
  const ri = rankOfMetro(rankIncome(mf, yi), m.id)
  const rs = rankOfMetro(rankShare(mf, yi), m.id)
  const n = mf.metros.length
  return {
    avgIncome: ok(inc) ? inc : null,
    incomeRank: ri ? ordinalText(ri.rank, n, ri.tied) : null,
    share200k: ok(s.share200k[yi]) ? s.share200k[yi] : null,
    shareRank: rs ? ordinalText(rs.rank, n, rs.tied) : null,
    realChangePct: yi > 0 && ok(inc) && ok(base) && base > 0 ? Math.round((inc / base - 1) * 100) : null,
    returns: ok(s.returns[yi]) ? s.returns[yi] : null,
    zipsReporting: ok(s.zipsReporting[yi]) ? s.zipsReporting[yi] : null,
    zipsEstimated: s.zipsEstimated[yi] ?? 0,
    zipCount: m.zipCount,
  }
}

export function fmtSignedPct(p: number): string {
  return p === 0 ? '0%' : `${p > 0 ? '+' : '−'}${Math.abs(p)}%`
}

export function fmtCount(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`
  if (n >= 1e4) return `${Math.round(n / 1e3)}K`
  return n.toLocaleString('en-US')
}
