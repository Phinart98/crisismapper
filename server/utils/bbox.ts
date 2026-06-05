import * as v from 'valibot'

// Shared bbox query-param helpers for the map/buildings routes.
// Format: "minLng,minLat,maxLng,maxLat" (west,south,east,north).
export const BBOX_REGEX = /^-?\d+(\.\d+)?(,-?\d+(\.\d+)?){3}$/

export interface BBox { w: number; s: number; e: number; n: number }

export function parseBbox(bbox: string): BBox {
  const [w, s, e, n] = bbox.split(',').map(Number) as [number, number, number, number]
  return { w, s, e, n }
}

// Shared coordinate validators (decimal degrees) + a [west,south,east,north] tuple that
// also enforces west<east and south<north — reused by the admin crisis create/patch routes.
export const Lng = v.pipe(v.number(), v.minValue(-180), v.maxValue(180))
export const Lat = v.pipe(v.number(), v.minValue(-90), v.maxValue(90))
export const BboxTuple = v.pipe(
  v.tuple([Lng, Lat, Lng, Lat]),
  v.check(([w, s, e, n]) => w < e && s < n, 'bbox must satisfy west<east and south<north'),
)
