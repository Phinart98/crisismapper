import sharp from 'sharp'
import { mkdirSync } from 'node:fs'

mkdirSync('public/icons', { recursive: true })

const SVG = (size, padding = 0) => Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="#f4eee2"/>
  <g transform="translate(${size/2},${size/2})">
    <text x="0" y="0" font-family="monospace" font-weight="700"
          font-size="${(size - padding * 2) * 0.42}" fill="#0e1116"
          text-anchor="middle" dominant-baseline="central">CM</text>
  </g>
</svg>
`)

await sharp(SVG(192)).png().toFile('public/icons/icon-192.png')
await sharp(SVG(512)).png().toFile('public/icons/icon-512.png')
// Maskable: keep wordmark inside the safe zone (~80% of canvas)
await sharp(SVG(512, 64)).png().toFile('public/icons/icon-512-maskable.png')
console.log('Icons written to public/icons/')
