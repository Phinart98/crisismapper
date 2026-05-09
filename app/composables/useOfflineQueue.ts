import { liveQuery } from 'dexie'
import { getDb, type PendingReport } from '~/utils/db'
import { drainQueue, type DrainResult } from '~/utils/drainQueue'

// Singleton state — one Dexie subscription shared by all callers
const _pendingCount = ref(0)
const _isFlushing = ref(false)
const _lastResult = ref<DrainResult | null>(null)
let _initialized = false

function ensureInitialized() {
  if (!import.meta.client || _initialized) return
  _initialized = true
  const db = getDb()
  liveQuery(() => db.pending_reports.count()).subscribe({
    next: (n) => { _pendingCount.value = n },
    error: (err) => console.warn('[useOfflineQueue] liveQuery error', err),
  })
}

export function useOfflineQueue() {
  ensureInitialized()
  const pendingCount = _pendingCount
  const isFlushing = _isFlushing
  const lastResult = _lastResult

  async function enqueue(row: Omit<PendingReport, 'id' | 'created_at' | 'retries'>): Promise<number> {
    if (!import.meta.client) throw new Error('enqueue called during SSR')
    return getDb().pending_reports.add({
      ...row,
      created_at: Date.now(),
      retries: 0,
    })
  }

  async function flush(): Promise<DrainResult> {
    if (!import.meta.client) return { drained: 0, failed: 0, remaining: 0, drainedIds: [] }
    _isFlushing.value = true
    try {
      const result = await drainQueue(getDb())
      _lastResult.value = result
      return result
    } catch (err: any) {
      _lastResult.value = err.result ?? { drained: 0, failed: 1, remaining: _pendingCount.value, drainedIds: [] }
      return _lastResult.value!
    } finally {
      _isFlushing.value = false
    }
  }

  // Try to register Background Sync (Android). Silently no-op on iOS.
  async function registerBackgroundSync(): Promise<void> {
    if (!('serviceWorker' in navigator)) return
    const reg = await navigator.serviceWorker.ready
    if (!('sync' in reg)) return
    try {
      await (reg as any).sync.register('crisismapper-drain')
    } catch {
      // Permissions denied or unsupported — fall back to foreground
    }
  }

  return { pendingCount, isFlushing, lastResult, enqueue, flush, registerBackgroundSync }
}
