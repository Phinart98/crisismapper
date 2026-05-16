<script setup lang="ts">
useHead({
  title: 'Terms of Service · CrisisMapper',
  meta: [{ name: 'description', content: 'Terms of use for the CrisisMapper damage reporting tool.' }],
})
</script>

<template>
  <main class="min-h-screen bg-parchment text-ink">
    <section class="max-w-3xl mx-auto px-5 sm:px-8 py-12 sm:py-16">
      <span class="label">Last updated 2026-05-16</span>
      <h1 class="display text-4xl sm:text-5xl tracking-tight mt-3 mb-6">Terms of Service</h1>

      <p class="text-base sm:text-lg leading-relaxed mb-8">
        CrisisMapper is a non-commercial, open-source humanitarian tool. By using it
        you agree to the following.
      </p>

      <h2 class="font-serif font-semibold text-2xl sm:text-3xl mt-10 mb-4">Purpose</h2>
      <p class="text-base leading-relaxed mb-4">
        This service exists to help affected communities, aid responders, and the
        general public map physical damage during natural disasters and conflicts.
        It is provided free of charge with no commercial use.
      </p>

      <h2 class="font-serif font-semibold text-2xl sm:text-3xl mt-10 mb-4">Acceptable use</h2>
      <ul class="list-disc ps-6 space-y-2 text-base leading-relaxed">
        <li>Submit reports that accurately reflect damage you have observed.</li>
        <li>Do not submit photos containing identifiable people without their consent.</li>
        <li>Do not submit prank, spam, fictional, or politically motivated false reports — they pollute the map and divert aid.</li>
        <li>Do not attempt to overwhelm, attack, or reverse-engineer the system.</li>
      </ul>

      <h2 class="font-serif font-semibold text-2xl sm:text-3xl mt-10 mb-4">Content licence</h2>
      <p class="text-base leading-relaxed mb-4">
        By submitting a damage report you grant CrisisMapper a perpetual, royalty-free
        licence to display, anonymize, aggregate, and share the report (photo and
        metadata) for humanitarian and research purposes.
      </p>

      <h2 class="font-serif font-semibold text-2xl sm:text-3xl mt-10 mb-4">No warranty</h2>
      <p class="text-base leading-relaxed mb-4">
        The service is provided <strong>as-is</strong>. Information shown on the map
        is community-contributed and AI-classified — it is not authoritative, may be
        delayed, and should not be the sole basis for life-or-death decisions.
      </p>

      <h2 class="font-serif font-semibold text-2xl sm:text-3xl mt-10 mb-4">Liability</h2>
      <p class="text-base leading-relaxed mb-4">
        The project maintainer and contributors are not liable for any direct or
        indirect damages arising from use of the service or reliance on its data.
      </p>

      <h2 class="font-serif font-semibold text-2xl sm:text-3xl mt-10 mb-4">Contact</h2>
      <p class="text-base leading-relaxed">
        <a href="mailto:phinart98@gmail.com" class="underline">phinart98@gmail.com</a>
      </p>

      <hr class="rule my-12" />

      <p class="text-sm text-ink-light">
        <NuxtLink to="/" class="underline">← Back to CrisisMapper</NuxtLink>
        &nbsp;·&nbsp;
        <NuxtLink to="/privacy" class="underline">Privacy Policy</NuxtLink>
      </p>
    </section>
  </main>
</template>
