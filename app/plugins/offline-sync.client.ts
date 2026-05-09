export default defineNuxtPlugin(() => {
  if (typeof window === 'undefined') return

  let queue: ReturnType<typeof useOfflineQueue> | null = null
  const ensure = () => (queue ??= useOfflineQueue())

  const flush = () => {
    const q = ensure()
    if (q.pendingCount.value > 0) q.flush()
  }

  window.addEventListener('online', flush)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') flush()
  })

  // The SW posts to BroadcastChannel('crisismapper-sync') after a Background Sync
  // drain so the page can react. We don't subscribe yet — Dexie's liveQuery already
  // keeps pendingCount reactive — but the SW broadcast is in place for future telemetry.

  // Initial flush on app boot — covers: user opens app online after submitting offline yesterday.
  if (navigator.onLine) flush()
})
