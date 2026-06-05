// Reactive staff-session state shared across the app (admin chrome + the dashboard
// modal's Verify/Flag gating). useState hydrates the value across SSR→client. The
// server-side requireStaff (via /api/auth/me) is the real boundary; this is UX glue.
export function useStaff() {
  const user = useState<{ email: string } | null>('cm_staff', () => null)
  const isStaff = computed(() => !!user.value)

  // Re-fetch the staff session and return it (or null) so callers like the route
  // middleware can branch on the result without re-implementing the fetch.
  async function refresh() {
    try {
      user.value = await useRequestFetch()('/api/auth/me')
    } catch {
      user.value = null
    }
    return user.value
  }

  async function signOut() {
    await useSupabaseBrowserClient().auth.signOut()
    user.value = null
    await navigateTo('/login')
  }

  return { user, isStaff, refresh, signOut }
}
