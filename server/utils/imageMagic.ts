// Magic-byte sniff for image MIME types. Don't trust client-supplied Content-Type
// alone — a malicious client can label any blob as image/webp.
export function hasImageMagicBytes(buf: Buffer, mime: string): boolean {
  if (buf.length < 12) return false
  if (mime === 'image/jpeg') return buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff
  if (mime === 'image/png') return buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47
  if (mime === 'image/webp') {
    return buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP'
  }
  return false
}

export const ALLOWED_IMAGE_MIMES = ['image/webp', 'image/jpeg', 'image/png'] as const
