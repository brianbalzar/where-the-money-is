import type { MetroMeta, MetrosFile } from '../lib/types'
import { metroStats, fmtCount, fmtSignedPct } from '../lib/stats'
import { fmtDollars, fmtShare } from '../lib/format'

interface Props { mf: MetrosFile; metro: MetroMeta; year: number; variant?: 'full' | 'line' }

/** Compact metro summary under the selector. Ranks: #1 = highest of the 50. */
export default function MetroStats({ mf, metro, year, variant = 'full' }: Props) {
  const yi = mf.years.indexOf(year)
  if (yi < 0) return null
  const s = metroStats(mf, metro, yi)
  const first = mf.years[0]
  if (variant === 'line') {
    const parts = [
      s.avgIncome != null && `Avg ${fmtDollars(s.avgIncome)}${s.incomeRank ? ` (${s.incomeRank.replace(' of ' + mf.metros.length, '')})` : ''}`,
      s.share200k != null && `${fmtShare(s.share200k)} ≥ $200K`,
      s.realChangePct != null && `${fmtSignedPct(s.realChangePct)} real since ${first}`,
    ].filter(Boolean)
    return <p className="ms-line" aria-label={`${metro.shortName} ${year}: ${parts.join(', ')}. Ranks among ${mf.metros.length} metros, 1 is highest.`}>{parts.join(' · ')}</p>
  }
  const row = (label: string, value: string, rank: string | null, rankDesc: string) => (
    <div className="ms-row">
      <dt>{label}</dt>
      <dd className="ms-val">{value}</dd>
      <dd className="ms-rank" aria-label={rank ? `${rank} metros, ${rankDesc}` : undefined}>{rank ?? ''}</dd>
    </div>
  )
  return (
    <div className="metro-stats">
      <dl aria-label={`${metro.shortName} summary, ${year}`}>
        {row('Avg income / return', s.avgIncome != null ? fmtDollars(s.avgIncome) : '—', s.incomeRank, 'ranked by average income, 1 is highest')}
        {row('Share of returns ≥ $200K', s.share200k != null ? fmtShare(s.share200k) : '—', s.shareRank, 'ranked by share of returns over $200K, 1 is highest')}
        {row(`Real change since ${first}`, year === first ? 'base year' : s.realChangePct != null ? fmtSignedPct(s.realChangePct) : '—', null, '')}
      </dl>
      <p className="ms-note">
        {year} · {mf.dollarYear} dollars · ranks among {mf.metros.length} metros, #1 = highest
      </p>
      <p className="meta">
        {s.returns != null ? `${fmtCount(s.returns)} returns` : 'Returns unavailable'}
        {s.zipsReporting != null && ` · ${s.zipsReporting} of ${s.zipCount} ZIPs reporting`}
        {s.zipsEstimated > 0 && ` (${s.zipsEstimated} estimated)`}
      </p>
    </div>
  )
}
