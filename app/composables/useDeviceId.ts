// Pseudonymous reporter identity (Phase 9). A random, client-generated UUID kept in
// localStorage — the server HMACs it before storing, so nothing here is PII or reversible
// (Webinar Q&A #16/#18 data minimization). It's a soft, per-device identity: clearing
// storage or switching devices yields a new one, and that's an accepted trade-off — every
// new identity starts at the neutral 0.5 trust score and has to earn its way up.
const KEY = 'cm_device_id'

export function useDeviceId(): string | null {
  if (!import.meta.client) return null
  let id = localStorage.getItem(KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(KEY, id)
  }
  return id
}
