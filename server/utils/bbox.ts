// Shared bbox query-param helpers for the map/buildings routes.
// Format: "minLng,minLat,maxLng,maxLat" (west,south,east,north).
export const BBOX_REGEX = /^-?\d+(\.\d+)?(,-?\d+(\.\d+)?){3}$/

export interface BBox { w: number; s: number; e: number; n: number }

export function parseBbox(bbox: string): BBox {
  const [w, s, e, n] = bbox.split(',').map(Number) as [number, number, number, number]
  return { w, s, e, n }
}
