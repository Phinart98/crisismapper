// Meta Cloud API webhook verification handshake.
// Meta calls this once when you click "Verify and save" in the App Dashboard.
// Must return the hub.challenge value as plaintext if hub.verify_token matches.
export default defineEventHandler((event) => {
  const { metaVerifyToken } = useRuntimeConfig()
  const q = getQuery(event)
  const mode = String(q['hub.mode'] ?? '')
  const token = String(q['hub.verify_token'] ?? '')
  const challenge = String(q['hub.challenge'] ?? '')

  if (mode === 'subscribe' && metaVerifyToken && token === metaVerifyToken) {
    setResponseHeader(event, 'content-type', 'text/plain')
    return challenge
  }
  throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
})
