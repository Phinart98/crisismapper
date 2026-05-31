import type { Ref } from 'vue'

// Client side of the GIS export (Phase 9). Exact ground-truth is staff data (Q&A #18),
// so /api/export is admin-key gated; we collect the key once and keep it in sessionStorage
// (mirrors the /admin/languages pattern). We fetch → Blob → anchor-download so the key
// travels as a header (not a URL query that would leak into logs). Server-side streaming
// keeps *server* memory bounded; the staff browser buffering the finished file is fine.
const SESSION_KEY = 'cm_admin_key'

// UI label → API format param.
const FORMAT_PARAM: Record<string, string> = {
  GeoJSON: 'geojson', CSV: 'csv', GPKG: 'gpkg', Shapefile: 'shapefile',
}

export function useExport(crisisId: Ref<string>) {
  const adminKey = ref('')
  if (import.meta.client) adminKey.value = sessionStorage.getItem(SESSION_KEY) ?? ''
  watch(adminKey, (v) => { if (import.meta.client) sessionStorage.setItem(SESSION_KEY, v) })

  const busy = ref<string | null>(null) // UI label of the format currently downloading
  const error = ref(false)

  async function download(uiFormat: string) {
    const format = FORMAT_PARAM[uiFormat]
    if (!format || busy.value) return
    busy.value = uiFormat
    error.value = false
    try {
      const res = await fetch(
        `/api/export?crisis_id=${encodeURIComponent(crisisId.value)}&format=${format}`,
        { headers: adminKey.value ? { 'x-admin-key': adminKey.value } : {} },
      )
      if (!res.ok) throw new Error(String(res.status))
      // Blob URLs carry no HTTP headers, so the browser can't honor the server's
      // content-disposition — pull the authoritative filename out of it ourselves.
      const filename = res.headers.get('content-disposition')?.match(/filename="([^"]+)"/)?.[1]
        ?? `export-${format}`
      const url = URL.createObjectURL(await res.blob())
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch {
      error.value = true
    } finally {
      busy.value = null
    }
  }

  return { adminKey, busy, error, download }
}
