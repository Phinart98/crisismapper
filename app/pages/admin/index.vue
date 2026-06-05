<script setup lang="ts">
// /admin → crises console. Staff-gated like the rest of the console.
definePageMeta({ middleware: 'staff' })
await navigateTo('/admin/crises', { redirectCode: 302 })
</script>

<template>
  <div />
</template>
