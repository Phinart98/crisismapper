import sharp from 'sharp'

// Strip ALL EXIF/IPTC/XMP/ICC metadata by piping through a transform.
// `.rotate()` bakes EXIF orientation into pixels BEFORE the strip so phone-captured
// portraits render correctly downstream. `.resize({ withoutEnlargement: true })`
// caps width at 1024 px — a no-op for already-compressed 200KB inputs and a safety
// net against any larger upload.
//
// Default Sharp behavior is to NOT preserve metadata on encode. Do NOT add
// `.withMetadata()`, `.keepExif()`, or `.keepMetadata()` here — any of those
// would re-introduce GPS coordinates and defeat the entire point of this helper.
export async function stripExif(buf: Buffer): Promise<Buffer> {
  return await sharp(buf)
    .rotate()
    .resize({ width: 1024, withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer()
}
