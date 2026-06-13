#!/usr/bin/env node
// Sources real, freely-licensed disaster damage photos from Wikimedia Commons for
// the demo seed (scripts/demo/seed.mjs). Downloads 1280px renditions (never the
// multi-MB originals) into data/demo-photos/<bucket>/ and records full attribution
// in data/demo-photos/manifest.json, which the operator then curates (keep/infra)
// and gen-attribution.mjs renders into docs/DEMO_DATA.md.
//
// Run:  node scripts/demo/fetch-photos.mjs
// Re-running skips already-downloaded titles, so quota shortfalls can be filled
// by adding queries.

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'

// Wikimedia API policy: anonymous/default user agents get throttled.
const UA = 'CrisisMapperDemoSeed/1.0 (UNDP Crisis Mapping Challenge demo; contact: phinart98@gmail.com)'
const API = 'https://commons.wikimedia.org/w/api.php'
const OUT_DIR = path.resolve('data/demo-photos')
const MANIFEST = path.join(OUT_DIR, 'manifest.json')

// Commons hosts no NC/ND material, but verify per-file anyway. PD/CC0 preferred
// (no attribution burden), CC BY / CC BY-SA accepted (attribution embedded in the
// seeded report descriptions + docs/DEMO_DATA.md).
const LICENSE_ALLOW = /^(Public domain|PDM|CC0|CC BY(-SA)? \d\.\d)/i
const PER_QUERY_LIMIT = 14

// Ground-level building/road damage queries per hazard bucket.
const QUERIES = [
  { bucket: 'earthquake', q: 'haslicense:unrestricted 2010 Haiti earthquake rubble building' },
  { bucket: 'earthquake', q: '2023 Turkey earthquake collapsed building' },
  { bucket: 'earthquake', q: '2015 Nepal earthquake damaged building Kathmandu' },
  { bucket: 'earthquake', q: '2009 L\'Aquila earthquake damaged building' },
  { bucket: 'earthquake', q: '2016 Amatrice earthquake damage' },
  { bucket: 'earthquake', q: 'haslicense:unrestricted Christchurch earthquake 2011 building damage' },
  { bucket: 'flood', q: 'incategory:"July 2021 floods in Ahrweiler, Germany"' },
  { bucket: 'flood', q: 'haslicense:unrestricted 2022 Pakistan floods damaged road' },
  { bucket: 'flood', q: 'Hurricane Harvey flooded street Houston' },
  { bucket: 'flood', q: '2018 Kerala floods damage' },
  { bucket: 'flood', q: '2011 Thailand floods street Bangkok' },
  { bucket: 'flood', q: 'haslicense:unrestricted flood damaged bridge road washout' },
  { bucket: 'flood', q: '2013 Colorado floods road damage' },
  { bucket: 'wind', q: 'Hurricane Katrina house damage' },
  { bucket: 'wind', q: 'Hurricane Sandy damage house' },
  { bucket: 'wind', q: 'Typhoon Haiyan Tacloban' },
  { bucket: 'wind', q: 'Hurricane Maria damage Puerto Rico' },
  { bucket: 'wind', q: 'tornado damaged house' },
  { bucket: 'wind', q: 'Hurricane Ike damage Galveston' },
  { bucket: 'wind', q: 'hurricane destroyed building' },
  { bucket: 'fire', q: 'wildfire burned house' },
  { bucket: 'fire', q: 'bushfire damage house Australia' },
  { bucket: 'fire', q: 'Black Saturday bushfires' },
  { bucket: 'fire', q: 'burned building fire aftermath ruins' },
  { bucket: 'fire', q: 'wildfire destroyed neighborhood California' },
]

const sleep = (ms) => new Promise(r => setTimeout(r, ms))
const stripHtml = (s) => s.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
const slug = (title) => title
  .replace(/^File:/, '').replace(/\.[a-z]+$/i, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 60)

async function search(query) {
  const qs = new URLSearchParams({
    action: 'query', format: 'json', formatversion: '2',
    generator: 'search', gsrnamespace: '6', gsrlimit: String(PER_QUERY_LIMIT),
    gsrsearch: `filetype:bitmap ${query}`,
    prop: 'imageinfo', iiprop: 'url|extmetadata|mime|size', iiurlwidth: '1280',
  })
  const res = await fetch(`${API}?${qs}`, { headers: { 'User-Agent': UA } })
  if (!res.ok) throw new Error(`Commons API ${res.status} for: ${query}`)
  return (await res.json()).query?.pages ?? []
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true })
  let manifest = []
  if (existsSync(MANIFEST)) manifest = JSON.parse(await readFile(MANIFEST, 'utf8'))
  const seen = new Set(manifest.map(m => m.title))
  const counters = {}

  for (const { bucket, q } of QUERIES) {
    await mkdir(path.join(OUT_DIR, bucket), { recursive: true })
    let kept = 0
    let pages = []
    try {
      pages = await search(q)
    } catch (e) {
      console.warn(`  query failed: ${q} — ${e.message}`)
      continue
    }
    for (const p of pages) {
      const ii = p.imageinfo?.[0]
      if (!ii || seen.has(p.title)) continue
      const md = ii.extmetadata ?? {}
      const license = md.LicenseShortName?.value ?? ''
      if (!LICENSE_ALLOW.test(license)) continue
      if (md.Restrictions?.value) continue
      if (!/^image\/(jpeg|png)$/.test(ii.mime)) continue
      const dl = ii.thumburl ?? ii.url
      if (!dl) continue

      counters[bucket] = (counters[bucket] ?? 0) + 1
      const file = `${bucket}/${String(counters[bucket]).padStart(2, '0')}-${slug(p.title)}.jpg`
      try {
        const res = await fetch(dl, { headers: { 'User-Agent': UA } })
        if (!res.ok) { counters[bucket]--; continue }
        await writeFile(path.join(OUT_DIR, file), Buffer.from(await res.arrayBuffer()))
      } catch {
        counters[bucket]--
        continue
      }

      seen.add(p.title)
      manifest.push({
        file,
        title: p.title,
        descriptionUrl: ii.descriptionurl,
        artist: stripHtml(md.Artist?.value ?? 'Unknown'),
        license,
        attributionRequired: md.AttributionRequired?.value === 'true',
        keep: true,
        infra: null,
      })
      kept++
      await sleep(300)
    }
    console.log(`[${bucket}] "${q}" → ${kept} downloaded`)
  }

  manifest.sort((a, b) => a.file.localeCompare(b.file))
  await writeFile(MANIFEST, JSON.stringify(manifest, null, 2) + '\n')
  const totals = manifest.reduce((acc, m) => {
    const b = m.file.split('/')[0]
    acc[b] = (acc[b] ?? 0) + 1
    return acc
  }, {})
  console.log('\nManifest totals:', totals, `(${manifest.length} files)`)
}

main()
