import type { PointerEvent as RPointerEvent } from 'react'
import type { ReactNode } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import MapView, { type BeadHover } from './components/MapView'
import MetroSelector from './components/MetroSelector'
import Legend from './components/Legend'
import YearControl from './components/YearControl'
import ZipCard from './components/ZipCard'
import SummaryTable, { findingText } from './components/SummaryTable'
import Methodology from './components/Methodology'
import CenterInset from './components/CenterInset'
import MetroStats from './components/MetroStats'
import TrendChart from './components/TrendChart'
import SeparationPanel from './components/SeparationPanel'
import ChangeLegend from './components/ChangeLegend'
import { changeLayer, type MapView as MapViewMode } from './lib/change'
import type { CenterToggles, Measure, MetroData, MetrosFile } from './lib/types'
import { MEASURES } from './lib/types'
import { MEASURE_LABEL, fmtCoord, fmtMi } from './lib/format'
import { bearingDeg, compass16, haversineMi } from './lib/geo'
import type { Theme } from './lib/theme'

const BASE = import.meta.env.BASE_URL
const DEFAULT_METRO = '19100' // Dallas–Fort Worth–Arlington
const PLAY_STEP_MS = 1200

function readUrl() {
  const q = new URLSearchParams(location.search)
  const m = q.get('measure')
  return {
    metro: q.get('metro') ?? DEFAULT_METRO,
    measure: (MEASURES.includes(m as Measure) ? m : 'income') as Measure,
    year: q.get('year') ? Number(q.get('year')) : null,
    zip: q.get('zip'),
    page: q.get('page'),
    view: (q.get('view') === 'change' ? 'change' : 'level') as MapViewMode,
  }
}

function useMedia(q: string) {
  const [m, setM] = useState(() => matchMedia(q).matches)
  useEffect(() => {
    const mq = matchMedia(q)
    const f = () => setM(mq.matches)
    mq.addEventListener('change', f)
    return () => mq.removeEventListener('change', f)
  }, [q])
  return m
}

function initialTheme(): Theme {
  try {
    const t = localStorage.getItem('wtmi-theme')
    if (t === 'light' || t === 'dark') return t
  } catch { /* storage unavailable */ }
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

type Sheet = 'collapsed' | 'peek' | 'expanded'

export default function App() {
  const init = useMemo(readUrl, [])
  const [metros, setMetros] = useState<MetrosFile | null>(null)
  const [metroId, setMetroId] = useState(init.metro)
  const [measure, setMeasure] = useState<Measure>(init.measure)
  const [view, setView] = useState<MapViewMode>(init.view)
  const [year, setYear] = useState<number | null>(init.year)
  const [playing, setPlaying] = useState(false)
  const [toggles, setToggles] = useState<CenterToggles>({ income: true, pop: true, aboveAvg: false, cbd: true, counties: true })
  const [hover, setHover] = useState<{ zip: string; x: number; y: number } | null>(null)
  const [pinned, setPinned] = useState<string | null>(init.zip)
  const [bead, setBead] = useState<BeadHover | null>(null)
  const [hlBin, setHlBin] = useState<number | null>(null)
  const [lockBin, setLockBin] = useState<number | null>(null)
  const [theme, setThemeState] = useState<Theme>(initialTheme)
  // Apply the attribute synchronously so the map (a child, whose effects run
  // before ours) reads the new theme's CSS variables when it restyles.
  const setTheme = (t: Theme) => { document.documentElement.dataset.theme = t; setThemeState(t) }
  const [page, setPage] = useState<'map' | 'method'>(init.page === 'methodology' ? 'method' : 'map')
  const [tableOpen, setTableOpen] = useState(false)
  const [sheet, setSheet] = useState<Sheet>('peek')
  const [data, setData] = useState<MetroData | null>(null)
  const [geo, setGeo] = useState<GeoJSON.FeatureCollection | null>(null)
  const [counties, setCounties] = useState<GeoJSON.FeatureCollection | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [zoomReq, setZoomReq] = useState(0)
  const mobile = useMedia('(max-width: 767px)')
  const narrow = useMedia('(max-width: 1099px)')
  const reducedMotion = useMedia('(prefers-reduced-motion: reduce)')

  // ---------- theme ----------
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try { localStorage.setItem('wtmi-theme', theme) } catch { /* ignore */ }
  }, [theme])

  // ---------- data ----------
  useEffect(() => {
    fetch(`${BASE}data/metros.json`).then((r) => r.json()).then(setMetros).catch(() => setErr('Could not load the metro list.'))
  }, [])
  const metro = metros?.metros.find((m) => m.id === metroId) ?? metros?.metros.find((m) => m.id === DEFAULT_METRO) ?? metros?.metros[0]

  useEffect(() => {
    if (!metro) return
    let live = true
    setData(null); setGeo(null); setHover(null); setCounties(null)
    // county outlines are optional: a missing file just means no lines
    fetch(`${BASE}data/${metro.id}/counties.geojson`).then((r) => (r.ok ? r.json() : null)).then((c) => live && setCounties(c)).catch(() => {})
    Promise.all([
      fetch(`${BASE}data/${metro.id}/data.json`).then((r) => r.json()),
      fetch(`${BASE}data/${metro.id}/zctas.geojson`).then((r) => r.json()),
    ]).then(([d, g]) => {
      if (!live) return
      setData(d); setGeo(g)
      setYear((y) => (y != null && d.years.includes(y) ? y : d.years[d.years.length - 1]))
    }).catch(() => live && setErr(`Could not load data for ${metro.shortName}.`))
    return () => { live = false }
  }, [metro?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { setLockBin(null); setHlBin(null) }, [measure, metro?.id, view])

  const years = data?.years ?? metros?.years ?? []
  const curYear = year ?? years[years.length - 1] ?? 2022
  const change = useMemo(
    () => (view === 'change' && data ? changeLayer(data, measure, Math.max(0, data.years.indexOf(curYear))) : null),
    [view, data, measure, curYear])

  // ---------- URL sync ----------
  useEffect(() => {
    if (!metro) return
    const q = new URLSearchParams()
    q.set('metro', metro.id)
    q.set('measure', measure)
    q.set('year', String(curYear))
    if (view === 'change') q.set('view', 'change')
    if (pinned) q.set('zip', pinned)
    if (page === 'method') q.set('page', 'methodology')
    history.replaceState(null, '', `${location.pathname}?${q}`)
  }, [metro, measure, curYear, pinned, page, view])

  // ---------- metro stepping ----------
  const sorted = useMemo(() => (metros ? [...metros.metros].sort((a, b) => a.rank - b.rank) : []), [metros])
  const step = useCallback((d: 1 | -1) => {
    if (!metro || !sorted.length) return
    const i = sorted.findIndex((m) => m.id === metro.id)
    setMetroId(sorted[(i + d + sorted.length) % sorted.length].id)
    setPinned(null)
  }, [metro, sorted])
  const selectMetro = (id: string) => { setMetroId(id); setPinned(null) }

  // ---------- playback ----------
  const togglePlay = useCallback(() => {
    if (!years.length) return
    setPlaying((p) => {
      if (!p && curYear >= years[years.length - 1]) setYear(years[0])
      return !p
    })
  }, [years, curYear])
  // One timeout per step, keyed on the year, so there is never more than one timer.
  useEffect(() => {
    if (!playing || !years.length) return
    if (curYear >= years[years.length - 1]) { setPlaying(false); return }
    const t = window.setTimeout(() => setYear(curYear + 1), PLAY_STEP_MS)
    return () => clearTimeout(t)
  }, [playing, curYear, years])
  const stepYear = (d: 1 | -1) => { setPlaying(false); setYear(Math.min(years[years.length - 1], Math.max(years[0], curYear + d))) }

  // ---------- keyboard ----------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t.closest('input:not([type=range]), textarea, [role=combobox]')) return
      if (e.key === '[') step(-1)
      else if (e.key === ']') step(1)
      else if (e.key === ' ' && !t.closest('button')) { e.preventDefault(); togglePlay() }
      else if (e.key === 'Escape') { setPinned(null); setTableOpen(false) }
      else if (!t.closest('input[type=range]') && years.length) {
        if (e.key === 'ArrowLeft') setYear(Math.max(years[0], curYear - 1))
        else if (e.key === 'ArrowRight') setYear(Math.min(years[years.length - 1], curYear + 1))
        else if (e.key === 'Home') setYear(years[0])
        else if (e.key === 'End') setYear(years[years.length - 1])
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [step, togglePlay, years, curYear])

  if (err) return <div className="fatal">{err}</div>
  if (!metros || !metro) return <div className="loading">Loading…</div>

  if (page === 'method') return <Methodology years={metros.years} dollarYear={metros.dollarYear} onClose={() => setPage('map')} />

  const finding = data ? findingText(data, curYear) : ''
  const meta = `#${metro.rank} of ${metros.metros.length} by population · ${metro.zipCount} ZIPs · ${metro.suppressedCount} suppressed in ${years[years.length - 1] ?? ''}`
  const setYearFromChart = (y: number) => { setPlaying(false); setYear(y) }
  const cbdLine = data && metro.cbd && (() => {
    const i = Math.max(0, data.years.indexOf(curYear))
    const c = metro.cbd!, inc = data.centers.income[i], pop = data.centers.pop[i]
    const d = (p: { lat: number; lon: number }) => `${fmtMi(haversineMi(c.lat, c.lon, p.lat, p.lon))} mi ${compass16(bearingDeg(c.lat, c.lon, p.lat, p.lon))}`
    return (
      <p className="cbd-line">
        <span className="cbd-mark" aria-hidden />
        <span>From {c.name}, {curYear}: income center <b>{d(inc)}</b>; population center <b>{d(pop)}</b>.</span>
      </p>
    )
  })()
  const stats = <MetroStats mf={metros} metro={metro} year={curYear} />
  const trend = data && (
    <TrendChart years={data.years} values={data.metroAvg.income} benchmark={metros.us?.avgIncome} year={curYear} dollarYear={data.dollarYear} onYear={setYearFromChart} />
  )
  const separation = <SeparationPanel mf={metros} metro={metro} year={curYear} onSelect={selectMetro} />

  const map = (
    <MapView
      metro={metro} data={data} geo={geo} counties={counties} measure={measure} year={curYear} toggles={toggles}
      hoverZip={hover?.zip ?? null} pinnedZip={pinned} highlightBin={hlBin ?? lockBin} theme={theme} reducedMotion={reducedMotion}
      onHoverZip={(z, pt) => setHover(z && pt && !mobile ? { zip: z, ...pt } : null)}
      onClickZip={(z) => { setPinned(z); if (z && mobile) setSheet('peek') }}
      onBeadHover={setBead}
      ariaLabel={`Map of ${metro.name}. ${finding}`}
      zoomToCenters={zoomReq}
      view={view} change={change}
      padding={mobile ? { top: 24, bottom: 388, left: 16, right: 16 } : { top: 40, bottom: 130, left: narrow ? 160 : 290, right: 70 }}
    />
  )

  const measureCtl = (
    <div className="seg" role="radiogroup" aria-label="Map measure">
      {MEASURES.map((m) => (
        <button type="button" key={m} role="radio" aria-checked={measure === m} className={measure === m ? 'on' : ''} onClick={() => setMeasure(m)}>{MEASURE_LABEL[m]}</button>
      ))}
    </div>
  )

  const viewCtl = (
    <div className="seg seg-sm seg-view-toggle" role="radiogroup" aria-label="Map shows">
      <button type="button" role="radio" aria-checked={view === 'level'} className={view === 'level' ? 'on' : ''} onClick={() => setView('level')}>Level</button>
      <button type="button" role="radio" aria-checked={view === 'change'} className={view === 'change' ? 'on' : ''} onClick={() => setView('change')}>Change since {years[0] ?? 2011}</button>
    </div>
  )

  const measureNote = measure !== 'income' && view === 'level' && (
    <p className="measure-note">Colors show {measure === 'wealth' ? 'capital income per return' : 'the share of returns over $200K'}. The centers and the headline always use total income and tax returns.</p>
  )

  const centerToggles = (
    <div className="toggles">
      {([['income', 'Income center'], ['pop', 'Population center'], ['aboveAvg', 'Above-average income'], ['cbd', 'Downtown (CBD)'], ['counties', 'County lines']] as const).map(([k, label]) => (
        <label key={k} className={`tg tg-${k}${toggles[k] ? '' : ' off'}`}>
          <input type="checkbox" checked={toggles[k]} onChange={(e) => setToggles({ ...toggles, [k]: e.target.checked })} />
          <span className="tg-mark" aria-hidden />{label}
        </label>
      ))}
    </div>
  )

  const themeCtl = (
    <div className="seg seg-theme" role="radiogroup" aria-label="Theme">
      {(['light', 'dark'] as const).map((t) => (
        <button type="button" key={t} role="radio" aria-checked={theme === t} className={theme === t ? 'on' : ''} onClick={() => setTheme(t)}>{t === 'light' ? 'Light' : 'Dark'}</button>
      ))}
    </div>
  )

  const beadTip = bead && (
    <div className="bead-tip" style={{ left: bead.x + 14, top: bead.y + 14 }}>
      {bead.year} · {fmtCoord(bead.lat)}, {fmtCoord(bead.lon)}{bead.moved != null ? ` · moved ${fmtMi(bead.moved)} mi` : ''}
    </div>
  )

  const hoverCard = hover && data && !pinned && (
    <HoverPos x={hover.x} y={hover.y}>
      <ZipCard data={data} zip={hover.zip} measure={measure} year={curYear} mode="hover" view={view} change={change} />
    </HoverPos>
  )

  const tableModal = tableOpen && data && (
    <div className="modal-scrim" onClick={() => setTableOpen(false)}>
      <div className="modal" role="dialog" aria-label="Year-by-year table" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head"><span className="eyebrow">{metro.shortName} · centers by year</span>
          <button type="button" className="linklike" onClick={() => setTableOpen(false)}>Close</button></div>
        <p className="finding sm">{finding}</p>
        <SummaryTable data={data} metro={metro} variant={mobile ? 'compact' : 'full'} order="asc" />
      </div>
    </div>
  )

  // ======================= MOBILE =======================
  if (mobile) {
    return (
      <div className="app mobile">
        <header className="topbar">
          <MetroSelector metros={metros.metros} current={metro} onSelect={selectMetro} onStep={step} compact />
        </header>
        <main className="m-map">{map}{beadTip}
          {data && sheet !== 'expanded' && <CenterInset data={data} year={curYear} toggles={toggles} onZoom={() => setZoomReq((n) => n + 1)} size={112} compact />}
        </main>
        <BottomSheet sheet={sheet} setSheet={setSheet}>
          {pinned && data ? (
            <div className="sheet-card">
              <ZipCard data={data} zip={pinned} measure={measure} year={curYear} mode="pinned" onUnpin={() => setPinned(null)} view={view} change={change} />
            </div>
          ) : (
            <>
              <p className="finding m">{finding || 'Loading…'}</p>
              {sheet === 'peek' && <MetroStats mf={metros} metro={metro} year={curYear} variant="line" />}
              {sheet !== 'collapsed' && data && (
                <>
                  <YearControl years={years} year={curYear} playing={playing} onYear={(y) => { setPlaying(false); setYear(y) }} onPlay={togglePlay} compact />
                  {measureCtl}
                  {viewCtl}
                  {measureNote}
                  {sheet === 'peek' && <p className="hint">Swipe up for legend, table, method</p>}
                </>
              )}
              {sheet === 'expanded' && data && (
                <div className="sheet-more">
                  {cbdLine}
                  {stats}
                  {trend}
                  {centerToggles}
                  {view === 'change'
                    ? <ChangeLegend measure={measure} data={data} year={curYear} change={change} onHoverBin={setHlBin} locked={lockBin} onLock={setLockBin} variant="list" />
                    : <Legend measure={measure} data={data} year={curYear} onHoverBin={setHlBin} locked={lockBin} onLock={setLockBin} variant="list" />}
                  {separation}
                  <div className="eyebrow">Centers by year</div>
                  <SummaryTable data={data} metro={metro} variant="compact" order="desc" limit={5} onAll={() => setTableOpen(true)} />
                  <div className="sheet-links">
                    <button type="button" className="cta" onClick={() => setPage('method')}>Methodology</button>
                    {themeCtl}
                  </div>
                  <p className="meta">{meta}</p>
                </div>
              )}
            </>
          )}
        </BottomSheet>
        {tableModal}
      </div>
    )
  }

  // ======================= DESKTOP =======================
  return (
    <div className="app desktop">
      <aside className="panel">
        <section className="p-head">
          <div className="p-eyebrow-row"><span className="eyebrow">Where the money is</span>{themeCtl}</div>
          <MetroSelector metros={metros.metros} current={metro} onSelect={selectMetro} onStep={step} />
          {stats}
        </section>
        <section className="p-finding">
          <p className="finding">{finding || 'Loading…'}</p>
          {cbdLine}
          {data && (
            <p className="stats">
              <span>Gap {data.years[0]} <b>{fmtMi(data.gapMi[0])} mi</b></span>
              {curYear !== data.years[0] && <span>Gap {curYear} <b>{fmtMi(data.gapMi[Math.max(0, data.years.indexOf(curYear))])} mi</b></span>}
            </p>
          )}
        </section>
        <section className="p-measure">
          <div className="measure-head"><span className="eyebrow">Map measure</span>{viewCtl}</div>
          {measureCtl}
          {measureNote}
          {centerToggles}
        </section>
        <section className="p-legend">
          {data && (view === 'change'
            ? <ChangeLegend measure={measure} data={data} year={curYear} change={change} onHoverBin={setHlBin} locked={lockBin} onLock={setLockBin} />
            : <Legend measure={measure} data={data} year={curYear} onHoverBin={setHlBin} locked={lockBin} onLock={setLockBin} />)}
        </section>
        <section className="p-trend">{trend}</section>
        <section className="p-sep">{separation}</section>
        <section className="p-meta"><p className="meta">{meta}</p></section>
        <footer className="p-foot">
          <button type="button" className="cta" onClick={() => setTableOpen(true)}>Year-by-year table</button>
          <button type="button" className="cta" onClick={() => setPage('method')}>Methodology</button>
        </footer>
      </aside>
      <main className="map-area">
        {map}
        {data && (
          <div className="year-float">
            <YearControl years={years} year={curYear} playing={playing} onYear={(y) => { setPlaying(false); setYear(y) }} onPlay={togglePlay} onStep={stepYear} />
          </div>
        )}
        {data && <CenterInset data={data} year={curYear} toggles={toggles} onZoom={() => setZoomReq((n) => n + 1)} size={narrow ? 112 : 232} compact={narrow} />}
        {pinned && data && (
          <div className="pinned-float">
            <ZipCard data={data} zip={pinned} measure={measure} year={curYear} mode="pinned" onUnpin={() => setPinned(null)} view={view} change={change} />
          </div>
        )}
        {hoverCard}
        {beadTip}
      </main>
      {tableModal}
    </div>
  )
}

/** Positions the hover card 16px from the pointer and flips at the edges. */
function HoverPos({ x, y, children }: { x: number; y: number; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ left: x + 16, top: y + 16 })
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const parent = el.parentElement!.getBoundingClientRect()
    const w = el.offsetWidth, h = el.offsetHeight
    let left = x + 16, top = y + 16
    if (left + w > parent.width - 8) left = x - 16 - w
    if (top + h > parent.height - 110) top = Math.max(8, y - 16 - h)
    setPos({ left, top })
  }, [x, y])
  return <div ref={ref} className="hover-pos" style={pos}>{children}</div>
}

function BottomSheet({ sheet, setSheet, children }: { sheet: Sheet; setSheet: (s: Sheet) => void; children: ReactNode }) {
  const drag = useRef<{ y0: number; s: Sheet } | null>(null)
  const order: Sheet[] = ['collapsed', 'peek', 'expanded']
  const onDown = (e: RPointerEvent) => { drag.current = { y0: e.clientY, s: sheet }; (e.target as HTMLElement).setPointerCapture(e.pointerId) }
  const onUp = (e: RPointerEvent) => {
    const d = drag.current
    drag.current = null
    if (!d) return
    const dy = e.clientY - d.y0
    const i = order.indexOf(d.s)
    if (Math.abs(dy) < 8) setSheet(order[(i + 1) % 3 === 0 ? 1 : i + 1] ?? 'peek')
    else if (dy < -40) setSheet(order[Math.min(2, i + 1)])
    else if (dy > 40) setSheet(order[Math.max(0, i - 1)])
  }
  return (
    <section className={`sheet sheet-${sheet}`} aria-label="Details">
      <div className="handle-hit" onPointerDown={onDown} onPointerUp={onUp} role="button" tabIndex={0} aria-label="Resize panel"
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSheet(sheet === 'expanded' ? 'peek' : 'expanded') }}>
        <span className="handle" />
      </div>
      <div className="sheet-body">{children}</div>
    </section>
  )
}
