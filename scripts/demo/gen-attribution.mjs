#!/usr/bin/env node
// Regenerates the photo-attribution table in docs/DEMO_DATA.md from the curated
// manifest (kept entries only), between the ATTRIBUTION markers. Run after seeding.
import { readFile, writeFile } from 'node:fs/promises'

const manifest = JSON.parse(await readFile('data/demo-photos/manifest.json', 'utf8'))
const kept = manifest.filter(m => m.keep).sort((a, b) => a.file.localeCompare(b.file))

const rows = kept.map((m) => {
  const title = m.title.replace(/^File:/, '').replace(/\|/g, '\\|')
  const artist = (m.artist || 'Unknown').replace(/\|/g, '\\|')
  return `| ${title} | ${artist} | ${m.license} | [Commons](${m.descriptionUrl}) |`
})

const table = [
  `${kept.length} images, all sourced from Wikimedia Commons under the licenses shown. Images were resized to 1280px and re-encoded to WebP for the app; these modifications are noted here as the CC BY-SA license requires.`,
  '',
  '| Image | Author | License | Source |',
  '| --- | --- | --- | --- |',
  ...rows,
].join('\n')

const doc = await readFile('docs/DEMO_DATA.md', 'utf8')
const next = doc.replace(
  /<!-- ATTRIBUTION:START -->[\s\S]*<!-- ATTRIBUTION:END -->/,
  `<!-- ATTRIBUTION:START -->\n${table}\n<!-- ATTRIBUTION:END -->`,
)
await writeFile('docs/DEMO_DATA.md', next)
console.log(`attribution table: ${kept.length} images`)
