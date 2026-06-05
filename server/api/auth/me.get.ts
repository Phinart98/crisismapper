import { requireStaff } from '../../utils/requireStaff'

// Single source of truth for "is the caller staff?" — consumed by the route
// middleware (app/middleware/staff.ts) and the useStaff() composable. 401/403 from
// requireStaff signals "not staff"; a 200 with the email means authenticated staff.
export default defineEventHandler(async (event) => {
  const staff = await requireStaff(event)
  return { email: staff.email }
})
