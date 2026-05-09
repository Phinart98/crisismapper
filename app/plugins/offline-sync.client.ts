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

  // SW finished a drain → liveQuery already keeps the count reactive,
  // but this hook is here for future telemetry / toast notifications.
  const channel = new BroadcastChannel('crisismapper-sync')
  channel.addEventListener('message', (e) => {
    if (e.data?.type === 'drained') {
      // No-op for now.
    }
  })

  // Initial flush on app boot — covers: user opens app online after submitting offline yesterday.
  if (navigator.onLine) flush()
})
