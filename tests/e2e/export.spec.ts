import { test, expect } from 'playwright/test'
import { STAFF_STATE, DEMO_CRISIS_ID } from './helpers/fixtures'

// Staff-gated GIS exports (Q&A #14). Read-only against real data; page.request
// shares the staff session cookies from storageState.
test.use({ storageState: STAFF_STATE })

test('GeoJSON export streams a FeatureCollection with the mandatory schema', async ({ page }) => {
  const res = await page.request.get(`/api/export?crisis_id=${DEMO_CRISIS_ID}&format=geojson`)
  expect(res.status()).toBe(200)
  expect(res.headers()['content-disposition']).toContain('attachment')
  expect(res.headers()['content-disposition']).toContain('.geojson')
  const body = await res.text()
  expect(body.startsWith('{"type":"FeatureCollection","features":[')).toBe(true)
  const fc = JSON.parse(body)
  expect(fc.features.length).toBeGreaterThan(0)
  const props = fc.features[0].properties
  // Q&A #14 mandatory fields + Core Questions extension.
  expect(['Minimal', 'Partial', 'Complete']).toContain(props.damage_classification)
  expect(props.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  expect(props).toHaveProperty('infrastructure_type')
  expect(props).toHaveProperty('hazard_type')
  expect(props).toHaveProperty('affected_population')
  const [lng, lat] = fc.features[0].geometry.coordinates
  expect(typeof lng).toBe('number')
  expect(Math.abs(lat)).toBeLessThanOrEqual(90)
})

test('CSV export has the Q&A #14 column set', async ({ page }) => {
  const res = await page.request.get(`/api/export?crisis_id=${DEMO_CRISIS_ID}&format=csv`)
  expect(res.status()).toBe(200)
  expect(res.headers()['content-type']).toContain('text/csv')
  const text = await res.text()
  const header = text.split('\r\n')[0]
  for (const col of ['latitude', 'longitude', 'timestamp', 'damage_classification', 'infrastructure_type', 'hazard_type', 'affected_population']) {
    expect(header).toContain(col)
  }
  expect(text.split('\r\n').length).toBeGreaterThan(1)
})

test('GPKG export produces a SQLite container', async ({ page }) => {
  test.setTimeout(120_000) // builds to a temp file before streaming
  const res = await page.request.get(`/api/export?crisis_id=${DEMO_CRISIS_ID}&format=gpkg`)
  expect(res.status()).toBe(200)
  expect(res.headers()['content-disposition']).toContain('.gpkg')
  const buf = await res.body()
  expect(buf.length).toBeGreaterThan(1000)
  expect(buf.subarray(0, 15).toString()).toContain('SQLite format 3')
})

test('Shapefile export produces a zip', async ({ page }) => {
  test.setTimeout(120_000)
  const res = await page.request.get(`/api/export?crisis_id=${DEMO_CRISIS_ID}&format=shapefile`)
  expect(res.status()).toBe(200)
  expect(res.headers()['content-disposition']).toContain('.zip')
  const buf = await res.body()
  expect(buf.length).toBeGreaterThan(500)
  expect(buf.subarray(0, 2).toString()).toBe('PK') // zip magic
})

test('unknown format is rejected', async ({ page }) => {
  const res = await page.request.get(`/api/export?crisis_id=${DEMO_CRISIS_ID}&format=kml`)
  expect(res.status()).toBe(400)
})
