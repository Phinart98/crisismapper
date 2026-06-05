// Route guard for /admin/* pages. Delegates to useStaff().refresh() → /api/auth/me
// (requireStaff) — the single server-side source of truth — so the client never trusts
// local state. refresh() uses useRequestFetch() internally, which forwards the inbound
// Cookie header during SSR (a bare $fetch would drop it on a hard reload and falsely
// bounce logged-in staff), and it populates the shared cm_staff state the admin chrome
// reads — so the console doesn't re-validate the session.
export default defineNuxtRouteMiddleware(async () => {
  const { refresh } = useStaff()
  if (!(await refresh())) return navigateTo('/login')
})
