export type Measure = 'income' | 'wealth' | 'share200k'
export const MEASURES: Measure[] = ['income', 'wealth', 'share200k']

export interface Landmark { name: string; lon: number; lat: number }

export interface MetroMeta {
  id: string            // CBSA code, e.g. '19100'
  name: string          // full CBSA title
  shortName: string     // e.g. 'Dallas–Fort Worth'
  rank: number          // by population, 1 = largest
  pop: number
  popYear: number
  principalCities: string[]
  states: string[]
  bbox: [number, number, number, number] // w, s, e, n
  landmarks: Landmark[]
  cbd: Landmark | null         // main central business district
  zipCount: number
  suppressedCount: number
  summary: MetroSummary
}

/** Per-year metro figures (index-aligned with MetrosFile.years), for cross-metro ranks. */
export interface MetroSummary {
  avgIncome: number[]      // average AGI per return, real (dollarYear) dollars
  share200k: number[]      // % of returns $200K+
  returns: number[]
  zipsReporting: number[]  // ZIPs with a value that year (includes estimated ZIPs)
  zipsEstimated: number[]
  gapMi: number[]          // income-population center distance
  gapBearing: string[]     // direction of the income center from the population center
}

export interface MetrosFile {
  generated: string
  years: number[]
  dollarYear: number
  /** United States, from the IRS state-total rows (includes suppressed ZIPs). */
  us: { avgIncome: number[]; share200k: number[]; returns: number[] }
  metros: MetroMeta[]
}

export interface ZipRow {
  place: string
  ret: (number | null)[]        // number of returns
  income: (number | null)[]     // avg AGI per return, real dollars
  wealth: (number | null)[]     // capital income per return, real dollars
  share200k: (number | null)[]  // % of returns with AGI >= $200K (nominal size class)
  po?: boolean                  // absorbed PO-box ZIP returns
  est?: { from: string; since: number } // not in the IRS file; modeled from parent ZIP `from`
}

export interface Bins {
  breaks: number[]              // lower bound of each bin, ascending; breaks[0] is the floor
  outlierMin: number | null     // values strictly greater than this are outliers
  outliers: { zcta: string; place: string; value: number }[]
}

export interface CenterPoint { year: number; lat: number; lon: number }

export interface Finding {
  firstYear: number
  lastYear: number
  incMi: number
  incBearing: string
  popMi: number
  popBearing: string
  gap0: number
  gap1: number
}

export interface MetroData {
  id: string
  years: number[]
  dollarYear: number
  zips: Record<string, ZipRow>
  metroAvg: Record<Measure, number[]>
  bins: Record<Measure, Bins>
  centers: { income: CenterPoint[]; pop: CenterPoint[]; aboveAvg: CenterPoint[] }
  gapMi: number[]
  finding: Finding
  suppressedZips: string[]      // ZCTAs on the map with no value in the latest year
}

export interface CenterToggles { income: boolean; pop: boolean; aboveAvg: boolean; cbd: boolean }
