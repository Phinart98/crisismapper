import * as v from 'valibot'
import { getDb } from '../../../../utils/db'
import { requireStaff } from '../../../../utils/requireStaff'

// Report moderation (Phase 10): staff flip the is_verified flag from the dashboard
// modal. 'verify' → true, 'unverify' (the Flag action) → false. Writes go through the
// privileged pooler after the staff JWT is verified by requireStaff.
const Schema = v.object({ action: v.picklist(['verify', 'unverify']) })

export default defineEventHandler(async (event) => {
  await requireStaff(event)

  const idResult = v.safeParse(v.pipe(v.string(), v.uuid()), getRouterParam(event, 'id'))
  if (!idResult.success) {
    throw createError({ statusCode: 400, message: 'Invalid report id' })
  }
  const parsed = v.safeParse(Schema, await readBody(event))
  if (!parsed.success) {
    throw createError({ statusCode: 400, message: 'Invalid moderation action' })
  }
  const verified = parsed.output.action === 'verify'

  const db = getDb()
  const [row] = await db<{ id: string, is_verified: boolean }[]>`
    UPDATE damage_reports SET is_verified = ${verified}
    WHERE id = ${idResult.output}
    RETURNING id, is_verified
  `
  if (!row) {
    throw createError({ statusCode: 404, message: 'Report not found' })
  }
  return { id: row.id, is_verified: row.is_verified }
})
