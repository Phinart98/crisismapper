// geojson2shp ships no type declarations — minimal ambient shim for the bits we use.
// Duplicated at the repo root for the app/shared tsconfig projects; this copy covers the
// Nitro server project (its own tsconfig program, where /api/export.get.ts is checked).
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
