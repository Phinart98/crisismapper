// Route guard for /admin/* pages. Delegates to useStaff().refresh() → /api/auth/me
// (requireStaff) — the single server-side source of truth — so the client never trusts
// local state. refresh() uses useRequestFetch() internally, which forwards the inbound
// Cookie header during SSR (a bare $fetch would drop it on a hard reload and falsely
// bounce logged-in staff), and it populates the shared cm_staff state the admin chrome
// reads — so the console doesn't re-validate the session.
export default defineNuxtRouteMiddleware(async (to) => {
  const { user, refresh } = useStaff()
  // Already-validated session in this app instance → skip the round-trip on
  // client-side navigations (the admin nav felt sluggish re-fetching /api/auth/me
  // per click). Every /api/admin/* call is still independently guarded server-side
  // by requireStaff, and a stale session just 401s there → sign-out path.
  if (user.value) return
  if (!(await refresh())) return navigateTo(`/login?redirect=${encodeURIComponent(to.fullPath)}`)
})
