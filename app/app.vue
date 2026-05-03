<script setup lang="ts">
useHead({ title: 'CrisisMapper — Phase 1 Foundation' })
</script>

<template>
  <main class="min-h-screen flex items-center justify-center px-6">
    <div class="max-w-xl text-center">
      <!-- Topographic crosshair — signature visual element -->
      <div class="flex justify-center mb-8">
        <div class="relative">
          <div class="crosshair" style="width:40px;height:40px" />
          <div class="crosshair-ring" style="width:18px;height:18px" />
        </div>
      </div>

      <span class="label">Phase 1 · Foundation</span>
      <h1 class="display text-5xl mt-3 mb-5">CrisisMapper</h1>
      <p class="text-lg leading-relaxed text-ink-light">
        Report damage from any phone, anywhere — even without internet.
      </p>

      <hr class="rule my-8" />

      <!-- Token smoke test -->
      <div class="flex justify-center gap-3 mb-8">
        <button class="btn btn-primary">Report damage</button>
        <button class="btn btn-ghost">View map</button>
      </div>

      <!-- Severity chip smoke test -->
      <div class="flex justify-center gap-2">
        <span class="sev-chip minimal">Minimal</span>
        <span class="sev-chip partial">Partial</span>
        <span class="sev-chip complete">Complete</span>
      </div>
    </div>
  </main>
</template>
