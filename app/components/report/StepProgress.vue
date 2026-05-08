<script setup lang="ts">
defineProps<{ current: number; total?: number }>()
</script>

<template>
  <div class="flex gap-1 px-5 sm:px-7 md:px-6 pt-3">
    <div
      v-for="s in (total ?? 5)"
      :key="s"
      class="flex-1 h-[3px] rounded-sm transition-colors duration-300"
      :class="s <= current ? 'bg-accent' : 'bg-parchment-deep'"
    />
  </div>
</template>
