import { test, expect } from 'playwright/test'
import { DEMO_CRISIS_ID } from './helpers/fixtures'

// Direct API assertions — no browser. Read-only against the live dev server.

test.describe('health + validation', () => {
  test('GET /api/health reports a reachable DB', async ({ request }) => {
    const res = await request.get('/api/health')
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.db).toBe('connected')
  })

  test('malformed crisis_id is rejected with 400', async ({ request }) => {
    const res = await request.get('/api/map/reports?crisis_id=not-a-uuid')
    expect(res.status()).toBe(400)
  })

  test('POST /api/reports rejects free-text electricity_status', async ({ request }) => {
    // Regression guard for the step-5 schema-mismatch bug: prose must 400 (never
    // reach the DB CHECK), and the structured values must be the only accepted shape.
    // NOTE: this is the suite's one unguarded real mutation attempt — it relies on the
    // 400. If the Valibot picklist were ever loosened, the DB CHECK constraint on
    // electricity_status (20260501000000_init.sql) still blocks the insert.
    const res = await request.post('/api/reports', {
      data: {
        crisis_id: DEMO_CRISIS_ID,
        severity: 'partial',
        infrastructure_type: 'building',
        location: [96.08, 21.97],
        location_method: 'gps',
        electricity_status: 'No power for 3 days',
      },
    })
    expect(res.status()).toBe(400)
  })
})

test.describe('geofencing', () => {
  // Both rejections happen before any INSERT — no prod rows are created.
  const VALID = {
    severity: 'partial',
    infrastructure_type: 'building',
    location: [-150, -40], // mid-Pacific — outside every crisis zone
    location_method: 'gps',
  }

  test('out-of-zone report is rejected with 422', async ({ request }) => {
    const res = await request.post('/api/reports', { data: { ...VALID, crisis_id: DEMO_CRISIS_ID } })
    expect(res.status()).toBe(422)
  })

  test('unknown crisis is rejected with 422', async ({ request }) => {
    const res = await request.post('/api/reports', { data: { ...VALID, crisis_id: '00000000-0000-7000-8000-0000000000ff' } })
    expect(res.status()).toBe(422)
  })

  test('no worldwide catch-all crisis exists (the no-crisis path is reachable)', async ({ request }) => {
    const crises = await (await request.get('/api/crises')).json()
    for (const c of crises) {
      const [w, , e] = c.bbox ?? [0, 0, 0, 0]
      expect(e - w, `${c.name} bbox spans the globe`).toBeLessThan(300)
    }
  })
})

test.describe('anon privacy redaction (Q&A #16/#18)', () => {
  test('map reports snap coords to the 0.001° grid and truncate timestamps to the hour', async ({ request }) => {
    const res = await request.get(`/api/map/reports?crisis_id=${DEMO_CRISIS_ID}&limit=50`)
    expect(res.status()).toBe(200)
    const fc = await res.json()
    expect(fc.type).toBe('FeatureCollection')
    expect(fc.features.length).toBeGreaterThan(0)
    for (const f of fc.features) {
      const [lng, lat] = f.geometry.coordinates
      // ST_SnapToGrid(0.001): coord*1000 must be integer-close.
      expect(Math.abs(lng * 1000 - Math.round(lng * 1000))).toBeLessThan(1e-6)
      expect(Math.abs(lat * 1000 - Math.round(lat * 1000))).toBeLessThan(1e-6)
      const t = new Date(f.properties.submitted_at)
      expect(t.getMinutes()).toBe(0)
      expect(t.getSeconds()).toBe(0)
      // No precise/PII fields on the anon projection.
      expect(f.properties.description).toBeUndefined()
      expect(f.properties.photo_url).toBeUndefined()
    }
  })

  test('anon report detail is redacted too', async ({ request }) => {
    const list = await (await request.get(`/api/map/reports?crisis_id=${DEMO_CRISIS_ID}&limit=1`)).json()
    const id = list.features[0]?.properties.id
    test.skip(!id, 'no reports seeded')
    const detail = await (await request.get(`/api/reports/${id}`)).json()
    const t = new Date(detail.submitted_at)
    expect(t.getMinutes()).toBe(0)
    expect(detail.photo_url ?? null).toBeNull()
  })
})

test.describe('auth boundary', () => {
  for (const path of ['/api/auth/me', '/api/admin/staff', '/api/admin/crises', `/api/export?crisis_id=${DEMO_CRISIS_ID}&format=geojson`]) {
    test(`GET ${path} → 401 without a session`, async ({ request }) => {
      const res = await request.get(path)
      expect(res.status()).toBe(401)
    })
  }

  test('POST /api/translate → 401 without a session', async ({ request }) => {
    const res = await request.post('/api/translate', { data: { target: 'xx', keys: {} } })
    expect(res.status()).toBe(401)
  })
})
