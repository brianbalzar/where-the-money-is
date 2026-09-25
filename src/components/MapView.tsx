import { useEffect, useRef } from 'react'
import maplibregl, { type GeoJSONSource, type Map as MLMap } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { buildStyle, fillColorExpr, fillOpacityExpr } from '../lib/mapStyle'
import { mapColors, rampColors, type Theme } from '../lib/theme'
import { binOf, spreadRamp } from '../lib/bins'
import type { CenterPoint, CenterToggles, Measure, MetroData, MetroMeta } from '../lib/types'
import { fmtMi } from '../lib/format'
import { haversineMi } from '../lib/geo'

export interface BeadHover { kind: string; year: number; lat: number; lon: number; moved: number | null; x: number; y: number }

interface Props {
  metro: MetroMeta
  data: MetroData | null
  geo: GeoJSON.FeatureCollection | null
  measure: Measure
  year: number
  toggles: CenterToggles
  hoverZip: string | null
  pinnedZip: string | null
  highlightBin: number | null
  theme: Theme
  reducedMotion: boolean
  onHoverZip: (zip: string | null, pt: { x: number; y: number } | null) => void
  onClickZip: (zip: string | null) => void
  onBeadHover: (b: BeadHover | null) => void
  ariaLabel: string
  zoomToCenters: number          // increment to fly to the centers
  padding: { top: number; bottom: number; left: number; right: number }
}

type Kind = 'income' | 'pop' | 'aboveAvg'
const KINDS: Kind[] = ['aboveAvg', 'pop', 'income']  // the CBD toggle is handled separately
const LABEL: Record<Kind, string> = { income: 'Income center', pop: 'Population center', aboveAvg: 'Above-average center' }

function makeImages(map: MLMap) {
  const c = mapColors()
  const dpr = 2
  const mk = (w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void) => {
    const cv = document.createElement('canvas')
    cv.width = w * dpr; cv.height = h * dpr
    const ctx = cv.getContext('2d')!
    ctx.scale(dpr, dpr)
    draw(ctx)
    return ctx.getImageData(0, 0, cv.width, cv.height)
  }
  const put = (id: string, img: ImageData) => {
    if (map.hasImage(id)) map.removeImage(id)
    map.addImage(id, img, { pixelRatio: dpr })
  }
  put('hatch', mk(6, 6, (x) => {
    x.fillStyle = c.nodataBg; x.fillRect(0, 0, 6, 6)
    x.strokeStyle = c.nodataHatch; x.lineWidth = 1.5
    x.beginPath(); x.moveTo(-1, 7); x.lineTo(7, -1); x.moveTo(-1, 1); x.lineTo(1, -1); x.moveTo(5, 7); x.lineTo(7, 5); x.stroke()
  }))
  put('landmark-sq', mk(9, 9, (x) => {
    x.fillStyle = c.bg; x.strokeStyle = c.label; x.lineWidth = 1.2
    x.fillRect(1.9, 1.9, 5.2, 5.2); x.strokeRect(1.9, 1.9, 5.2, 5.2)
  }))
  // CBD: outlined diamond with a solid centre
  put('cbd-icon', mk(16, 16, (x) => {
    x.fillStyle = c.bg; x.strokeStyle = c.label; x.lineWidth = 1.6
    x.beginPath(); x.moveTo(8, 1.5); x.lineTo(14.5, 8); x.lineTo(8, 14.5); x.lineTo(1.5, 8); x.closePath(); x.fill(); x.stroke()
    x.fillStyle = c.label; x.beginPath(); x.arc(8, 8, 2.2, 0, Math.PI * 2); x.fill()
  }))
  put('above-sq', mk(16, 16, (x) => {
    x.fillStyle = c.bg; x.strokeStyle = c.centerAbove; x.lineWidth = 2
    x.fillRect(3, 3, 10, 10); x.strokeRect(3, 3, 10, 10)
  }))
}

export default function MapView(p: Props) {
  const el = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MLMap | null>(null)
  const ready = useRef(false)
  const chipRef = useRef<maplibregl.Marker | null>(null)
  const markerPos = useRef<Record<Kind, [number, number] | null>>({ income: null, pop: null, aboveAvg: null })
  const anim = useRef<number | null>(null)
  const prevHl = useRef<string[]>([])
  const props = useRef(p)
  props.current = p
  const appliedTheme = useRef<Theme | null>(null)

  // ---------- init ----------
  useEffect(() => {
    const map = new maplibregl.Map({
      container: el.current!,
      style: buildStyle(mapColors(), p.theme === 'dark'),
      bounds: p.metro.bbox,
      fitBoundsOptions: { padding: safePad(el.current, p.padding) },
      attributionControl: { compact: true },
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
    })
    map.touchZoomRotate.disableRotation()
    // Our own ResizeObserver: in dev, CSS can arrive after the map is created,
    // leaving MapLibre on its 400x300 fallback canvas. Resize and re-fit whenever
    // the container size changes materially.
    let lastW = el.current!.clientWidth
    const ro = new ResizeObserver(() => {
      const w = el.current?.clientWidth ?? 0
      map.resize()
      if (Math.abs(w - lastW) > 120) map.fitBounds(props.current.metro.bbox, { padding: safePad(el.current, props.current.padding), duration: 0 })
      lastW = w
    })
    ro.observe(el.current!)
    map.once('remove', () => ro.disconnect())
    mapRef.current = map
    appliedTheme.current = p.theme
    if (import.meta.env.DEV) (window as unknown as { __map: MLMap }).__map = map
    map.on('styleimagemissing', () => makeImages(map))
    // 'style.load' rather than 'load': if the basemap tiles are slow or blocked,
    // the choropleth and centers must still draw.
    map.once('style.load', () => {
      makeImages(map)
      ready.current = true
      pushAll()
    })
    const onMove = (e: maplibregl.MapLayerMouseEvent) => {
      const f = e.features?.[0]
      const z = (f?.properties?.zcta as string) ?? null
      map.getCanvas().style.cursor = z ? 'pointer' : ''
      props.current.onHoverZip(z, z ? { x: e.point.x, y: e.point.y } : null)
    }
    map.on('mousemove', 'zcta-fill', onMove)
    map.on('mouseleave', 'zcta-fill', () => { map.getCanvas().style.cursor = ''; props.current.onHoverZip(null, null) })
    map.on('click', (e) => {
      const f = map.queryRenderedFeatures(e.point, { layers: ['zcta-fill'] })[0]
      props.current.onClickZip((f?.properties?.zcta as string) ?? null)
    })
    map.on('mousemove', 'bead', (e) => {
      const f = e.features?.[0]
      if (!f) return
      const pr = f.properties as Record<string, unknown>
      props.current.onBeadHover({
        kind: String(pr.kind), year: Number(pr.year), lat: Number(pr.lat), lon: Number(pr.lon),
        moved: pr.moved == null || pr.moved === 'null' ? null : Number(pr.moved), x: e.point.x, y: e.point.y,
      })
    })
    map.on('mouseleave', 'bead', () => props.current.onBeadHover(null))
    return () => { map.remove(); mapRef.current = null; ready.current = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---------- theme: rebuild style, then re-push everything ----------
  // Only restyle when the theme differs from the one the current map was built with.
  // (A "skip first run" flag breaks under React StrictMode's double-mount in dev:
  // the re-run called setStyle mid-load and the map never finished loading.)
  useEffect(() => {
    const map = mapRef.current
    if (!map || appliedTheme.current === p.theme) return
    appliedTheme.current = p.theme
    ready.current = false
    map.setStyle(buildStyle(mapColors(), p.theme === 'dark'), { diff: false })
    map.once('style.load', () => { makeImages(map); ready.current = true; pushAll() })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.theme])

  // ---------- metro change: fly to bbox ----------
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    map.fitBounds(p.metro.bbox, { padding: safePad(el.current, p.padding), duration: p.reducedMotion ? 0 : 800 })
    markerPos.current = { income: null, pop: null, aboveAvg: null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.metro.id])

  useEffect(() => { if (ready.current) pushGeo() }, [p.geo, p.metro.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // fly to the centers (from the inset's "Zoom map")
  useEffect(() => {
    const map = mapRef.current
    if (!map || !p.zoomToCenters || !p.data) return
    const all = [...p.data.centers.income, ...p.data.centers.pop, ...(p.toggles.aboveAvg ? p.data.centers.aboveAvg : [])]
    const lons = all.map((c) => c.lon), lats = all.map((c) => c.lat)
    map.fitBounds([Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)],
      { padding: safePad(el.current, { ...p.padding, top: p.padding.top + 60, left: p.padding.left + 60, right: p.padding.right + 60 }), maxZoom: 13.5, duration: p.reducedMotion ? 0 : 900 })
  }, [p.zoomToCenters]) // eslint-disable-line react-hooks/exhaustive-deps

  // the gap chip is noise at metro zoom; it appears with the marker labels
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const f = () => chipRef.current?.getElement().classList.toggle('hidden', map.getZoom() < 11)
    map.on('zoom', f)
    return () => { map.off('zoom', f) }
  }, [])
  useEffect(() => { if (ready.current) pushChoropleth() }, [p.data, p.geo, p.measure, p.year, p.highlightBin, p.theme]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (ready.current) pushHighlight() }, [p.hoverZip, p.pinnedZip, p.geo]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (ready.current) pushCenters(true) }, [p.data, p.year, p.toggles]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (ready.current) pushCbd() }, [p.toggles.cbd, p.metro.id]) // eslint-disable-line react-hooks/exhaustive-deps

  function pushAll() {
    pushGeo()
    pushChoropleth()
    pushHighlight()
    pushCenters(false)
  }

  function pushGeo() {
    const map = mapRef.current!
    const { geo, metro } = props.current
    ;(map.getSource('zcta') as GeoJSONSource).setData(geo ?? { type: 'FeatureCollection', features: [] })
    ;(map.getSource('landmarks') as GeoJSONSource).setData({
      type: 'FeatureCollection',
      features: metro.landmarks.map((l) => ({ type: 'Feature', properties: { name: l.name }, geometry: { type: 'Point', coordinates: [l.lon, l.lat] } })),
    })
    pushCbd()
  }

  function pushCbd() {
    const map = mapRef.current!
    const { metro, toggles } = props.current
    const c = metro.cbd
    ;(map.getSource('cbd') as GeoJSONSource).setData({
      type: 'FeatureCollection',
      features: c && toggles.cbd ? [{ type: 'Feature', properties: { name: c.name }, geometry: { type: 'Point', coordinates: [c.lon, c.lat] } }] : [],
    })
  }

  function pushChoropleth() {
    const map = mapRef.current!
    const { data, geo, measure, year, highlightBin } = props.current
    if (!data || !geo) return
    const b = data.bins[measure]
    const n = b.breaks.length
    const { ramp, outlier } = rampColors(measure)
    map.setPaintProperty('zcta-fill', 'fill-color', fillColorExpr(spreadRamp(ramp, n), outlier))
    map.setPaintProperty('zcta-fill', 'fill-opacity', fillOpacityExpr(mapColors().choroOpacity, n))
    const yi = data.years.indexOf(year)
    for (const f of geo.features) {
      const z = f.properties!.zcta as string
      const row = data.zips[z]
      const v = row ? row[measure][yi] : null
      const bi = binOf(v, b)
      map.setFeatureState({ source: 'zcta', id: z }, {
        b: bi,
        out: b.outlierMin != null && bi === n,
        dim: highlightBin != null && bi !== highlightBin,
      })
    }
  }

  function pushHighlight() {
    const map = mapRef.current!
    for (const z of prevHl.current) map.setFeatureState({ source: 'zcta', id: z }, { hl: false })
    const on = [props.current.hoverZip, props.current.pinnedZip].filter(Boolean) as string[]
    for (const z of on) map.setFeatureState({ source: 'zcta', id: z }, { hl: true })
    prevHl.current = on
  }

  function pushCenters(animate: boolean) {
    const map = mapRef.current!
    const { data, year, toggles, reducedMotion } = props.current
    const empty: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] }
    if (!data) {
      for (const s of ['trails', 'beads', 'markers', 'gap']) (map.getSource(s) as GeoJSONSource).setData(empty)
      chipRef.current?.remove(); chipRef.current = null
      return
    }
    const yi = Math.max(0, data.years.indexOf(year))
    const on = KINDS.filter((k) => toggles[k])

    // label side: income label goes on the side away from the population center
    const inc = data.centers.income[yi], pop = data.centers.pop[yi]
    const incSide = inc && pop && inc.lon < pop.lon ? 'left' : 'right'
    const sideOf = (k: Kind) => (k === 'income' ? incSide : incSide === 'left' ? 'right' : 'left')

    const trails: GeoJSON.Feature[] = []
    const beads: GeoJSON.Feature[] = []
    for (const k of on) {
      const pts = data.centers[k]
      for (let i = 1; i < pts.length; i++) {
        trails.push({
          type: 'Feature', properties: { kind: k, future: pts[i].year > year },
          geometry: { type: 'LineString', coordinates: [[pts[i - 1].lon, pts[i - 1].lat], [pts[i].lon, pts[i].lat]] },
        })
      }
      pts.forEach((pt, i) => {
        const moved = i === 0 ? null : haversine(pts[i - 1], pt)
        beads.push({
          type: 'Feature',
          properties: { kind: k, year: pt.year, lat: pt.lat, lon: pt.lon, moved, first: i === 0 && k !== 'aboveAvg', future: pt.year > year, side: sideOf(k) },
          geometry: { type: 'Point', coordinates: [pt.lon, pt.lat] },
        })
      })
    }
    ;(map.getSource('trails') as GeoJSONSource).setData({ type: 'FeatureCollection', features: trails })
    ;(map.getSource('beads') as GeoJSONSource).setData({ type: 'FeatureCollection', features: beads })

    const target: Record<Kind, [number, number]> = {
      income: [data.centers.income[yi].lon, data.centers.income[yi].lat],
      pop: [data.centers.pop[yi].lon, data.centers.pop[yi].lat],
      aboveAvg: [data.centers.aboveAvg[yi].lon, data.centers.aboveAvg[yi].lat],
    }
    const from = { ...markerPos.current }
    const dur = animate && !reducedMotion ? 600 : 0
    const t0 = performance.now()
    if (anim.current) cancelAnimationFrame(anim.current)

    const draw = (t: number) => {
      const e = dur ? Math.min(1, (t - t0) / dur) : 1
      const k = 1 - Math.pow(1 - e, 4) // ease-out
      const cur: Record<Kind, [number, number]> = { ...target }
      for (const kk of KINDS) {
        const f = from[kk]
        if (f) cur[kk] = [f[0] + (target[kk][0] - f[0]) * k, f[1] + (target[kk][1] - f[1]) * k]
      }
      markerPos.current = cur
      ;(map.getSource('markers') as GeoJSONSource).setData({
        type: 'FeatureCollection',
        features: on.map((kk) => ({
          type: 'Feature', properties: { kind: kk, label: `${LABEL[kk]} ${year}`, side: sideOf(kk) },
          geometry: { type: 'Point', coordinates: cur[kk] },
        })),
      })
      const showGap = toggles.income && toggles.pop
      ;(map.getSource('gap') as GeoJSONSource).setData(showGap ? {
        type: 'FeatureCollection',
        features: [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [cur.income, cur.pop] } }],
      } : { type: 'FeatureCollection', features: [] })
      if (showGap) {
        const mid: [number, number] = [(cur.income[0] + cur.pop[0]) / 2, (cur.income[1] + cur.pop[1]) / 2]
        if (!chipRef.current) {
          const d = document.createElement('div')
          d.className = 'gap-chip'
          if (map.getZoom() < 11) d.classList.add('hidden')
          chipRef.current = new maplibregl.Marker({ element: d }).setLngLat(mid).addTo(map)
        }
        chipRef.current.setLngLat(mid)
        chipRef.current.getElement().textContent = `${fmtMi(data.gapMi[yi])} mi gap`
      } else { chipRef.current?.remove(); chipRef.current = null }
      if (e < 1) anim.current = requestAnimationFrame(draw)
    }
    draw(t0)
  }

  const zoom = (d: number) => mapRef.current?.easeTo({ zoom: mapRef.current.getZoom() + d, duration: p.reducedMotion ? 0 : 250 })

  return (
    <div className="map-wrap">
      <div ref={el} className="map" role="region" aria-label={p.ariaLabel} />
      <div className="zoom-ctl">
        <button type="button" aria-label="Zoom in" onClick={() => zoom(1)}>+</button>
        <button type="button" aria-label="Zoom out" onClick={() => zoom(-1)}>−</button>
      </div>
    </div>
  )
}

/** Shrink padding on small canvases so fitBounds always has room (otherwise MapLibre refuses to fit). */
function safePad(el: HTMLElement | null, pad: Props['padding']): Props['padding'] {
  const w = el?.clientWidth ?? 0, h = el?.clientHeight ?? 0
  if (!w || !h) return { top: 10, bottom: 10, left: 10, right: 10 }
  const kx = Math.min(1, (w * 0.5) / (pad.left + pad.right))
  const ky = Math.min(1, (h * 0.5) / (pad.top + pad.bottom))
  return { top: pad.top * ky, bottom: pad.bottom * ky, left: pad.left * kx, right: pad.right * kx }
}

const haversine = (a: CenterPoint, b: CenterPoint) => haversineMi(a.lat, a.lon, b.lat, b.lon)
