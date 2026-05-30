<script setup lang="ts">
// i18n drives <html lang> + <html dir> — flipping dir to "rtl" for Arabic is what
// makes every logical utility (ms-/me-/ps-/pe-) mirror the layout. useLocaleHead()
// returns correctly-typed htmlAttrs; merge it with our static title.
useHead({ title: 'CrisisMapper' })
useHead(useLocaleHead())
</script>

<template>
  <NuxtPage />
  <OfflinePendingSyncTray />
  <OfflinePwaUpdateToast />
  <OfflineInstallPrompt />
</template>
