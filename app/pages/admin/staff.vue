<script setup lang="ts">
// Staff management console — add/remove staff through the UI (no SQL). Adding a member
// allowlists their email AND provisions a Supabase login with an initial password the
// operator sets, then relays out-of-band (no reliable email channel). Operator-facing,
// English-literal. Flat model: any staff can manage staff (role tiers are future).
definePageMeta({ middleware: 'staff' })
useHead({ title: 'Staff — CrisisMapper', meta: [{ name: 'robots', content: 'noindex' }] })

interface StaffRow { email: string, created_at: string, has_login: boolean }

const { user } = useStaff()
const { data: staff, refresh, pending } = await useFetch<StaffRow[]>('/api/admin/staff', { default: () => [] })

const email = ref('')
const password = ref('')
const saving = ref(false)
const errorMsg = ref('')
// After a successful add, surface the credentials once so the operator can copy + relay.
const added = ref<{ email: string, password: string, existed: boolean } | null>(null)

// Uniform random index in [0, max) from the Web Crypto CSPRNG. Rejection sampling
// discards the top non-divisible range so there's no modulo bias. Math.random() must
// NOT be used here — it isn't cryptographically secure, and these are login credentials.
function randIndex(max: number): number {
  const limit = Math.floor(0xFFFFFFFF / max) * max
  const buf = new Uint32Array(1)
  let x: number
  do { crypto.getRandomValues(buf); x = buf[0]! } while (x >= limit)
  return x % max
}

function generatePassword() {
  const sets = ['ABCDEFGHJKLMNPQRSTUVWXYZ', 'abcdefghijkmnpqrstuvwxyz', '23456789', '!@#$%^&*?']
  const all = sets.join('')
  const chars = sets.map(s => s[randIndex(s.length)]!) // guarantee one of each class
  while (chars.length < 16) chars.push(all[randIndex(all.length)]!)
  // Crypto-driven Fisher–Yates shuffle (not Array.sort with a random comparator, which
  // is biased and also Math.random-based).
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randIndex(i + 1)
    ;[chars[i], chars[j]] = [chars[j]!, chars[i]!]
  }
  password.value = chars.join('')
}

async function addStaff() {
  errorMsg.value = ''
  added.value = null
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.value.trim())) { errorMsg.value = 'Enter a valid email.'; return }
  if (password.value.length < 8) { errorMsg.value = 'Password must be at least 8 characters.'; return }
  saving.value = true
  try {
    const res = await $fetch<{ existed: boolean }>('/api/admin/staff', { method: 'POST', body: { email: email.value.trim(), password: password.value } })
    added.value = { email: email.value.trim().toLowerCase(), password: password.value, existed: res.existed }
    email.value = ''
    password.value = ''
    await refresh()
  } catch (e: unknown) {
    const err = e as { data?: { message?: string }, statusMessage?: string }
    errorMsg.value = err?.data?.message || err?.statusMessage || 'Could not add the staff member.'
  } finally {
    saving.value = false
  }
}

async function removeStaff(target: string) {
  errorMsg.value = ''
  try {
    await $fetch('/api/admin/staff', { method: 'DELETE', body: { email: target } })
    await refresh()
  } catch (e: unknown) {
    const err = e as { data?: { message?: string } }
    errorMsg.value = err?.data?.message || 'Could not remove the staff member.'
  }
}
</script>

<template>
  <div class="min-h-[100dvh] bg-parchment text-ink">
    <AdminNav />

    <main class="max-w-6xl mx-auto px-5 sm:px-8 py-6 flex flex-col gap-8">
      <!-- Add staff -->
      <section>
        <h1 class="font-serif font-bold text-xl sm:text-2xl mb-1">Staff access</h1>
        <p class="text-sm text-ink-light mb-4 max-w-2xl">
          Add a UNDP operator by email and set an initial password to share with them securely.
          Removing someone revokes their access immediately.
        </p>

        <div class="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-3 items-end max-w-3xl">
          <label class="flex flex-col gap-1.5">
            <span class="label">Email</span>
            <input
              v-model="email" type="email" autocomplete="off" placeholder="operator@undp.org"
              class="focus-ring px-3 min-h-[44px] bg-white border border-parchment-deep rounded-sm text-base"
            >
          </label>
          <label class="flex flex-col gap-1.5">
            <span class="label">Initial password</span>
            <div class="flex gap-2">
              <input
                v-model="password" type="text" autocomplete="off" placeholder="min 8 chars"
                class="focus-ring flex-1 min-w-0 px-3 min-h-[44px] bg-white border border-parchment-deep rounded-sm text-base"
              >
              <button type="button" class="btn btn-ghost min-h-[44px] text-[12px] shrink-0" @click="generatePassword">Generate</button>
            </div>
          </label>
          <button type="button" class="btn btn-primary min-h-[44px] text-sm" :disabled="saving" @click="addStaff">
            {{ saving ? 'Adding…' : 'Add staff' }}
          </button>
        </div>

        <p v-if="errorMsg" class="mt-3 p-3 rounded-sm bg-accent/10 border border-accent/30 text-[13px] text-accent max-w-3xl">
          {{ errorMsg }}
        </p>

        <!-- Credentials to relay (shown once after a successful add) -->
        <div v-if="added" class="mt-3 p-3 rounded-sm bg-sev-partial/10 border border-sev-partial/40 max-w-3xl">
          <div class="label mb-1">Share these credentials securely</div>
          <p v-if="added.existed" class="text-[11px] text-accent mb-1">
            An account for this email already existed — its password was reset to the value below.
          </p>
          <p class="font-mono text-[13px] text-ink break-all">{{ added.email }} · {{ added.password }}</p>
          <p class="text-[11px] text-ink-light mt-1">They can change the password after signing in. This won’t be shown again.</p>
        </div>
      </section>

      <!-- Current staff -->
      <section class="border-t border-parchment-deep pt-6">
        <div class="label mb-3">Current staff · {{ staff.length }}</div>
        <div v-if="pending" class="text-sm text-ink-light">Loading…</div>
        <ul v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <li v-for="s in staff" :key="s.email" class="border border-parchment-deep rounded-sm p-3 bg-white/40">
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0">
                <div class="text-[13px] font-medium leading-snug truncate">{{ s.email }}</div>
                <div class="font-mono text-[10px] mt-0.5" :class="s.has_login ? 'text-ink-ghost' : 'text-accent'">
                  {{ s.has_login ? 'has login' : 'no login yet' }}
                  <span v-if="user && s.email.toLowerCase() === user.email.toLowerCase()" class="text-ink-ghost"> · you</span>
                </div>
              </div>
              <button
                v-if="!user || s.email.toLowerCase() !== user.email.toLowerCase()"
                type="button"
                class="shrink-0 px-2 min-h-[32px] rounded-sm border border-parchment-deep font-mono text-[10px] tracking-[0.06em] uppercase text-ink-mid hover:bg-accent/10 hover:text-accent hover:border-accent/40 focus-ring"
                @click="removeStaff(s.email)"
              >
                Remove
              </button>
            </div>
          </li>
        </ul>
      </section>
    </main>
  </div>
</template>
