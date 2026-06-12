<script setup lang="ts">
// Shared admin console chrome: brand logo, section links, signed-in email + sign out.
// Sticky so it stays put while long admin pages (the tall crisis-draw map) scroll.
// English-literal (operator surface, not the judged reporter/dashboard UI). Pages are
// already staff-gated by middleware; refresh() just populates the email for display.
const { user, signOut, refresh } = useStaff()
const route = useRoute()
onMounted(() => { if (!user.value) refresh() })

const links = [
  { to: '/admin/crises', label: 'Crises' },
  { to: '/admin/staff', label: 'Staff' },
  { to: '/admin/languages', label: 'Languages' },
  // The live map is where moderation happens — staff sessions see exact data there.
  { to: '/dashboard', label: 'Dashboard' },
]
</script>

<template>
  <header class="sticky top-0 z-40 border-b border-parchment-deep bg-parchment">
    <div class="max-w-6xl mx-auto px-5 sm:px-8 h-[56px] flex items-center gap-4 sm:gap-6">
      <!-- Brand logo (crosshair registration mark) — mirrors ReportTopBar/dashboard. -->
      <NuxtLink to="/" class="flex items-center gap-2 no-underline text-ink focus-ring rounded-sm shrink-0">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" class="shrink-0">
          <circle cx="10" cy="10" r="9" stroke="var(--color-accent)" stroke-width="2" fill="none" />
          <line x1="0" y1="10" x2="20" y2="10" stroke="var(--color-accent)" stroke-width="1.5" />
          <line x1="10" y1="0" x2="10" y2="20" stroke="var(--color-accent)" stroke-width="1.5" />
        </svg>
        <span class="font-serif font-semibold text-sm hidden sm:inline">CrisisMapper</span>
        <span class="label hidden sm:inline text-ink-ghost">Staff</span>
      </NuxtLink>

      <nav class="flex items-center gap-1 sm:gap-2">
        <NuxtLink
          v-for="l in links" :key="l.to" :to="l.to"
          class="focus-ring px-2.5 sm:px-3 min-h-[36px] inline-flex items-center rounded-sm font-mono text-[11px] tracking-[0.06em] uppercase"
          :class="route.path === l.to ? 'bg-ink text-parchment' : 'text-ink-mid hover:bg-parchment-mid'"
        >
          {{ l.label }}
        </NuxtLink>
      </nav>

      <div class="ms-auto flex items-center gap-3">
        <span v-if="user" class="hidden md:inline font-mono text-[11px] text-ink-light truncate max-w-[180px]">{{ user.email }}</span>
        <button type="button" class="btn btn-ghost min-h-[36px] text-[12px]" @click="signOut">Sign out</button>
      </div>
    </div>
  </header>
</template>
