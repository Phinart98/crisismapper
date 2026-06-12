<script setup lang="ts">
// Staff sign-in via email + password. Accounts are admin-provisioned (no public signup);
// the staff_emails allowlist gates authorization (requireStaff/is_staff). Password is the
// pragmatic primitive here — no email delivery, no domain, no external IdP — and a real
// deployment swaps this control for the org's SSO (UN Azure AD / SAML) behind the same
// server boundary.
const { t } = useI18n()
useHead({ title: () => `${t('loginTitle')} — CrisisMapper`, meta: [{ name: 'robots', content: 'noindex' }] })

const supabase = useSupabaseBrowserClient()
const route = useRoute()
const isDev = import.meta.dev

const email = ref('')
const password = ref('')
const busy = ref(false)
const errorMsg = ref('')

const queryError = computed(() => {
  if (route.query.error === 'not_staff') return t('loginErrorNotStaff')
  if (route.query.error === 'session_expired') return t('loginErrorExpired')
  return ''
})

async function signIn() {
  if (!email.value || !password.value) {
    errorMsg.value = t('loginErrorMissing')
    return
  }
  busy.value = true
  errorMsg.value = ''

  const { error } = await supabase.auth.signInWithPassword({
    email: email.value.trim().toLowerCase(),
    password: password.value,
  })
  if (error) {
    busy.value = false
    errorMsg.value = t('loginErrorInvalid')
    return
  }

  // Session cookie is set. Enforce the staff allowlist server-side; a valid Supabase
  // account whose email isn't on the allowlist is signed out and bounced.
  try {
    await $fetch('/api/auth/me')
  } catch {
    await supabase.auth.signOut()
    busy.value = false
    errorMsg.value = t('loginErrorNotStaff')
    return
  }

  await navigateTo('/admin/crises')
}
</script>

<template>
  <main class="min-h-[100dvh] bg-parchment text-ink flex items-center justify-center px-5 sm:px-8 py-10">
    <div class="w-full max-w-sm">
      <NuxtLink
        to="/"
        class="inline-flex items-center min-h-[44px] font-mono text-xs text-ink-light no-underline hover:text-ink transition-colors focus-ring rounded-sm"
      >
        <span class="rtl-flip">←</span>&nbsp;{{ $t('loginBack') }}
      </NuxtLink>
      <div class="text-center mb-8">
        <span class="label">CrisisMapper</span>
        <h1 class="font-serif font-bold text-2xl sm:text-3xl mt-1">{{ $t('loginTitle') }}</h1>
        <p class="text-sm text-ink-light mt-2 leading-relaxed">
          {{ $t('loginSub') }}
        </p>
      </div>

      <form class="flex flex-col gap-3" @submit.prevent="signIn">
        <label class="flex flex-col gap-1.5">
          <span class="label">{{ $t('loginEmail') }}</span>
          <input
            v-model="email" type="email" autocomplete="username" inputmode="email"
            placeholder="you@undp.org"
            class="focus-ring px-3 min-h-[48px] bg-white border border-parchment-deep rounded-sm text-base"
          >
        </label>
        <label class="flex flex-col gap-1.5">
          <span class="label">{{ $t('loginPassword') }}</span>
          <input
            v-model="password" type="password" autocomplete="current-password"
            class="focus-ring px-3 min-h-[48px] bg-white border border-parchment-deep rounded-sm text-base"
          >
        </label>
        <button type="submit" class="btn btn-primary btn-full min-h-[48px] text-sm" :disabled="busy">
          {{ busy ? $t('loginSubmitting') : $t('loginSubmit') }}
        </button>
        <p v-if="errorMsg || queryError" class="p-3 rounded-sm bg-accent/10 border border-accent/30 text-[13px] text-accent">
          {{ errorMsg || queryError }}
        </p>
      </form>

      <!-- Dev-only convenience: the demo credentials, so local testing is one glance away.
           Never rendered in production (judges get these from the submission notes). -->
      <p v-if="isDev" class="mt-4 font-mono text-[10px] text-ink-ghost text-center leading-relaxed">
        demo@crisismapper.app · CrisisMapper#Demo2026
      </p>
    </div>
  </main>
</template>
