// geojson2shp ships no type declarations — minimal ambient shim for the bits we use.
// Root-level so the app/shared tsconfig projects (which include ../*.d.ts) see it; the
// twin under server/ covers the Nitro server project.
declare module 'geojson2shp' {
  import type { Writable } from 'node:stream'
  interface ConvertOptions {
    layer?: string
    targetCrs?: number
  }
  export function convert(
    input: unknown,
    output: string | Writable,
    options?: ConvertOptions,
  ): Promise<void>
  export function createConvertStream(options?: ConvertOptions): Writable
}
