import { liveQuery } from 'dexie'
import { getDb, type PendingReport } from '~/utils/db'
import { drainQueue, type DrainResult } from '~/utils/drainQueue'

// Singleton state — one Dexie subscription shared by all callers
const _pendingCount = ref(0)
const _isFlushing = ref(false)
const _lastResult = ref<DrainResult | null>(null)
let _initialized = false

function ensureInitialized() {
  if (_initialized) return
  _initialized = true
  const db = getDb()
  liveQuery(() => db.pending_reports.count()).subscribe({
    next: (n) => { _pendingCount.value = n },
  })
}

export function useOfflineQueue() {
  ensureInitialized()
  const db = getDb()
  const pendingCount = _pendingCount
  const isFlushing = _isFlushing
  const lastResult = _lastResult

  async function enqueue(row: Omit<PendingReport, 'id' | 'created_at' | 'retries'>): Promise<number> {
    return db.pending_reports.add({
      ...row,
      created_at: Date.now(),
      retries: 0,
    })
  }

  async function flush(): Promise<DrainResult> {
    _isFlushing.value = true
    try {
      const result = await drainQueue(db)
      _lastResult.value = result
      return result
    } catch (err: any) {
      _lastResult.value = err.result ?? { drained: 0, failed: 1, remaining: _pendingCount.value }
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
