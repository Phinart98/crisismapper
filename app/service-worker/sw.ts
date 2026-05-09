/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching'
import { getDb } from '../utils/db'
import { drainQueue } from '../utils/drainQueue'

declare let self: ServiceWorkerGlobalScope

cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)

self.addEventListener('message', (e) => {
  if (e.data?.type === 'SKIP_WAITING') self.skipWaiting()
})

// Background Sync (Android Chrome). iOS Safari ignores 'sync.register' so
// this listener simply never fires there — foreground loop covers iOS.
self.addEventListener('sync', (event: any) => {
  if (event.tag !== 'crisismapper-drain') return
  event.waitUntil(handleDrain())
})

async function handleDrain(): Promise<void> {
  const db = getDb()
  try {
    const result = await drainQueue(db)
    // Notify any open page so its pendingCount + UI updates without polling
    const channel = new BroadcastChannel('crisismapper-sync')
    channel.postMessage({ type: 'drained', ...result })
    channel.close()
  } catch {
    // drainQueue threw → re-throw so the OS keeps the sync registration alive
    throw new Error('drain_failed_retry_later')
  }
}
