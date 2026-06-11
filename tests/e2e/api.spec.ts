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
