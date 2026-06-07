import type { getDb } from './db'

type Db = ReturnType<typeof getDb>

// Single source of truth for the public-aggregation privacy policy (UNDP Q16/Q18 data
// minimization). The dashboard's server endpoints read the base table directly via the
// pooler (bypassing the crisis_reports_public view), so the same snap/fuzz must be applied
// here in SQL — these helpers keep the ~100m grid + hour truncation from drifting across
// /api/map/reports, /api/reports/[id], and /api/me.
//
// NOTE: the DB-side equivalent is the `privacy_snap(geometry)` SQL function (Phase 11
// migration) used by the view + realtime trigger + badge evaluator. Keep both in sync.
export const PRIVACY_GRID = 0.001
// One grid cell ≈ 100m × 100m ≈ 0.01 km² (at the crisis latitudes ~21°N). Lives beside
// PRIVACY_GRID so the cell-area constant can't drift from the grid it's derived from.
export const CELL_KM2 = 0.01

// Geometry snapped to the privacy grid centroid. Defaults to the `location` column.
export const snappedLocation = (db: Db, col = db`location`) =>
  db`ST_SnapToGrid(${col}, ${PRIVACY_GRID}, ${PRIVACY_GRID})`

// Timestamp fuzzed to the hour. Defaults to the `submitted_at` column.
export const fuzzedTime = (db: Db, col = db`submitted_at`) =>
  db`date_trunc('hour', ${col})`
