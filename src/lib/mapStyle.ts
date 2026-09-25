import type { StyleSpecification, ExpressionSpecification, LayerSpecification } from 'maplibre-gl'
import type { MapColors } from './theme'

/**
 * Basemap: OpenFreeMap vector tiles (OpenMapTiles schema, free, no API key).
 * We write our own style instead of using positron so the choropleth can be
 * sandwiched between land and water/roads, per the handoff's layer order.
 */
const OFM = 'https://tiles.openfreemap.org'
const FONT = ['Noto Sans Regular']
const FONT_BOLD = ['Noto Sans Bold']
const FONT_ITALIC = ['Noto Sans Italic']

const EMPTY = { type: 'FeatureCollection', features: [] } as const

const bin: ExpressionSpecification = ['coalesce', ['feature-state', 'b'], -1] as ExpressionSpecification

export function fillColorExpr(colors: string[], outlier: string): ExpressionSpecification {
  const pairs: (number | string)[] = []
  colors.forEach((c, i) => pairs.push(i, c))
  pairs.push(colors.length, outlier)
  return ['match', bin, ...pairs, 'rgba(0,0,0,0)'] as unknown as ExpressionSpecification
}

/**
 * Sparse ZIPs fade so large rural areas don't outweigh the dense core where the
 * filers (and the centers) are. d = filers per square mile of land, latest year.
 */
const density: ExpressionSpecification = [
  'interpolate', ['linear'], ['coalesce', ['get', 'd'], 1000],
  0, 0.4, 50, 0.5, 250, 0.75, 800, 1,
] as ExpressionSpecification

export function fillOpacityExpr(base: number, nBins: number): ExpressionSpecification {
  return [
    'case',
    ['boolean', ['feature-state', 'dim'], false], 0.12,
    ['==', bin, nBins], ['*', 0.95, density],
    ['*', base, density],
  ] as ExpressionSpecification
}

export function buildStyle(c: MapColors, dark: boolean): StyleSpecification {
  const roadW = (z8: number, z10: number, z14: number): ExpressionSpecification =>
    ['interpolate', ['linear'], ['zoom'], 8, z8, 10, z10, 14, z14] as ExpressionSpecification

  const major = ['match', ['get', 'class'], ['motorway', 'trunk'], true, false] as ExpressionSpecification
  const arterial = ['match', ['get', 'class'], ['primary'], true, false] as ExpressionSpecification

  const layers: LayerSpecification[] = [
    { id: 'land', type: 'background', paint: { 'background-color': c.land } },
    {
      id: 'park', type: 'fill', source: 'omt', 'source-layer': 'park',
      paint: { 'fill-color': dark ? '#141a14' : '#E9EDE6', 'fill-opacity': 0.6 },
    },
    { id: 'water-under', type: 'fill', source: 'omt', 'source-layer': 'water', paint: { 'fill-color': c.water } },

    // ---- choropleth ----
    {
      id: 'zcta-fill', type: 'fill', source: 'zcta',
      paint: { 'fill-color': 'rgba(0,0,0,0)', 'fill-opacity': c.choroOpacity },
    },
    {
      id: 'zcta-nodata', type: 'fill', source: 'zcta',
      paint: {
        'fill-pattern': 'hatch',
        'fill-opacity': ['case', ['==', bin, -1], ['case', ['boolean', ['feature-state', 'dim'], false], 0.3, 1], 0] as ExpressionSpecification,
      },
    },
    {
      id: 'zcta-line', type: 'line', source: 'zcta', minzoom: 9,
      paint: { 'line-color': dark ? 'rgba(255,255,255,.14)' : 'rgba(0,0,0,.12)', 'line-width': 0.3 },
    },
    {
      id: 'zcta-est-line', type: 'line', source: 'zcta', filter: ['has', 'est'] as ExpressionSpecification,
      paint: { 'line-color': c.label, 'line-width': 1, 'line-dasharray': [2, 2], 'line-opacity': 0.8 },
    },
    {
      id: 'zcta-outlier-line', type: 'line', source: 'zcta',
      paint: {
        'line-color': dark ? '#000' : '#fff',
        'line-width': ['case', ['boolean', ['feature-state', 'out'], false], 1.3, 0] as ExpressionSpecification,
      },
    },

    // ---- water + roads re-drawn above the fill ----
    { id: 'water-over', type: 'fill', source: 'omt', 'source-layer': 'water', paint: { 'fill-color': c.water, 'fill-opacity': 0.92 } },
    {
      id: 'road-arterial', type: 'line', source: 'omt', 'source-layer': 'transportation', minzoom: 10,
      filter: ['all', arterial, ['!=', ['get', 'brunnel'], 'tunnel']] as ExpressionSpecification,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': c.road, 'line-width': roadW(0.6, 0.8, 1.6), 'line-opacity': 0.55 },
    },
    {
      id: 'road-major-casing', type: 'line', source: 'omt', 'source-layer': 'transportation', minzoom: 7,
      filter: ['all', major, ['!=', ['get', 'brunnel'], 'tunnel'], ['!=', ['get', 'ramp'], 1]] as ExpressionSpecification,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': c.casing, 'line-width': roadW(3.4, 5, 9) },
    },
    {
      id: 'road-major', type: 'line', source: 'omt', 'source-layer': 'transportation', minzoom: 7,
      filter: ['all', major, ['!=', ['get', 'brunnel'], 'tunnel'], ['!=', ['get', 'ramp'], 1]] as ExpressionSpecification,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': c.road, 'line-width': roadW(1.4, 2.1, 4.2) },
    },
    {
      id: 'road-ref', type: 'symbol', source: 'omt', 'source-layer': 'transportation_name', minzoom: 8,
      filter: ['all', major, ['has', 'ref']] as ExpressionSpecification,
      layout: {
        'symbol-placement': 'line', 'symbol-spacing': 420,
        'text-field': ['get', 'ref'], 'text-font': FONT_BOLD, 'text-size': 10,
        'text-rotation-alignment': 'viewport', 'text-max-angle': 30,
      },
      paint: { 'text-color': c.label, 'text-halo-color': c.halo, 'text-halo-width': 2.2 },
    },
    {
      id: 'place', type: 'symbol', source: 'omt', 'source-layer': 'place', minzoom: 8,
      filter: ['match', ['get', 'class'], ['city', 'town'], true, false] as ExpressionSpecification,
      layout: {
        'text-field': ['coalesce', ['get', 'name:en'], ['get', 'name']] as ExpressionSpecification,
        'text-font': FONT,
        'text-size': ['interpolate', ['linear'], ['zoom'], 8, ['match', ['get', 'class'], 'city', 12, 10], 12, ['match', ['get', 'class'], 'city', 15, 12]] as ExpressionSpecification,
        'text-padding': 6,
        'symbol-sort-key': ['coalesce', ['get', 'rank'], 99] as ExpressionSpecification,
      },
      paint: { 'text-color': c.label, 'text-halo-color': c.halo, 'text-halo-width': 1.6, 'text-opacity': 0.85 },
    },

    // ---- landmarks (quiet, non-interactive) ----
    {
      id: 'landmark-pt', type: 'circle', source: 'landmarks',
      paint: { 'circle-radius': 0 },
    },
    {
      id: 'landmark', type: 'symbol', source: 'landmarks',
      layout: {
        'icon-image': 'landmark-sq', 'icon-allow-overlap': true, 'text-allow-overlap': false,
        'text-field': ['get', 'name'], 'text-font': FONT_ITALIC, 'text-size': 10.5,
        'text-anchor': 'left', 'text-offset': [0.7, 0], 'text-optional': true,
      },
      paint: { 'text-color': c.label, 'text-halo-color': c.halo, 'text-halo-width': 3 },
    },

    // ---- hover / pinned ZIP ----
    {
      id: 'zcta-hl', type: 'line', source: 'zcta',
      paint: {
        'line-color': c.centerIncome,
        'line-width': ['case', ['boolean', ['feature-state', 'hl'], false], 2.6, 0] as ExpressionSpecification,
      },
    },

    // ---- trails, gap, centers (top) ----
    ...trailLayers(c),
  ]

  return {
    version: 8,
    glyphs: `${OFM}/fonts/{fontstack}/{range}.pbf`,
    sources: {
      omt: { type: 'vector', url: `${OFM}/planet` },
      zcta: { type: 'geojson', data: EMPTY as never, promoteId: 'zcta' },
      landmarks: { type: 'geojson', data: EMPTY as never },
      trails: { type: 'geojson', data: EMPTY as never },
      beads: { type: 'geojson', data: EMPTY as never },
      markers: { type: 'geojson', data: EMPTY as never },
      gap: { type: 'geojson', data: EMPTY as never },
    },
    layers,
  }
}

function trailLayers(c: MapColors): LayerSpecification[] {
  const kind = ['get', 'kind'] as ExpressionSpecification
  const kindColor = ['match', kind, 'income', c.centerIncome, 'pop', c.centerPop, c.centerAbove] as ExpressionSpecification
  const past: ExpressionSpecification = ['case', ['boolean', ['get', 'future'], false], 0.2, 1] as ExpressionSpecification
  return [
    // halos under every trail
    {
      id: 'trail-halo', type: 'line', source: 'trails',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': c.bg, 'line-width': 4.5, 'line-opacity': past },
    },
    {
      id: 'trail-solid', type: 'line', source: 'trails',
      filter: ['==', kind, 'income'] as ExpressionSpecification,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': kindColor, 'line-width': 2, 'line-opacity': past },
    },
    {
      id: 'trail-dashed', type: 'line', source: 'trails',
      filter: ['!=', kind, 'income'] as ExpressionSpecification,
      paint: { 'line-color': kindColor, 'line-width': 2, 'line-dasharray': [1.5, 1], 'line-opacity': past },
    },
    {
      id: 'gap-line', type: 'line', source: 'gap',
      paint: { 'line-color': c.gap, 'line-width': 1.4, 'line-dasharray': [1.4, 1.8] },
    },
    {
      id: 'bead', type: 'circle', source: 'beads',
      paint: {
        'circle-radius': 2.1,
        'circle-color': ['match', kind, 'income', c.centerIncome, c.bg] as ExpressionSpecification,
        'circle-stroke-color': kindColor,
        'circle-stroke-width': ['match', kind, 'income', 0, 1] as ExpressionSpecification,
        'circle-opacity': past, 'circle-stroke-opacity': past,
      },
    },
    {
      id: 'bead-label', type: 'symbol', source: 'beads', minzoom: 11,
      filter: ['boolean', ['get', 'first'], false] as ExpressionSpecification,
      layout: {
        'text-field': ['to-string', ['get', 'year']] as ExpressionSpecification, 'text-font': FONT_BOLD, 'text-size': 10,
        'text-anchor': ['match', ['get', 'side'], 'left', 'right', 'left'] as ExpressionSpecification,
        'text-offset': ['match', ['get', 'side'], 'left', ['literal', [-0.6, 0]], ['literal', [0.6, 0]]] as ExpressionSpecification,
        'text-allow-overlap': true,
      },
      paint: { 'text-color': kindColor, 'text-halo-color': c.bg, 'text-halo-width': 2 },
    },
    // above-average: hollow square
    {
      id: 'marker-above', type: 'symbol', source: 'markers',
      filter: ['==', kind, 'aboveAvg'] as ExpressionSpecification,
      layout: { 'icon-image': 'above-sq', 'icon-allow-overlap': true },
    },
    // population: hollow ring
    {
      id: 'marker-pop', type: 'circle', source: 'markers',
      filter: ['==', kind, 'pop'] as ExpressionSpecification,
      paint: { 'circle-radius': 5.6, 'circle-color': c.bg, 'circle-stroke-color': c.centerPop, 'circle-stroke-width': 2.8 },
    },
    // income: solid circle with halo
    {
      id: 'marker-income', type: 'circle', source: 'markers',
      filter: ['==', kind, 'income'] as ExpressionSpecification,
      paint: { 'circle-radius': 6, 'circle-color': c.centerIncome, 'circle-stroke-color': c.bg, 'circle-stroke-width': 2.2 },
    },
    {
      id: 'marker-label', type: 'symbol', source: 'markers', minzoom: 11,
      filter: ['!=', kind, 'aboveAvg'] as ExpressionSpecification,
      layout: {
        'text-field': ['get', 'label'], 'text-font': FONT_BOLD, 'text-size': 10.5,
        'text-anchor': ['match', ['get', 'side'], 'left', 'right', 'left'] as ExpressionSpecification,
        'text-offset': ['match', ['get', 'side'], 'left', ['literal', [-1, 0]], ['literal', [1, 0]]] as ExpressionSpecification,
        'text-allow-overlap': true, 'text-ignore-placement': true,
      },
      paint: { 'text-color': kindColor, 'text-halo-color': c.bg, 'text-halo-width': 2.4 },
    },
  ]
}
