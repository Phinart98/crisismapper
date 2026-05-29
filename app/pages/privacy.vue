<script setup lang="ts">
useHead({
  title: 'Privacy Policy · CrisisMapper',
  meta: [{ name: 'description', content: 'How CrisisMapper handles data — anonymous reports, no PII, EXIF-stripped photos.' }],
})
</script>

<template>
  <main class="min-h-screen bg-parchment text-ink">
    <section class="max-w-3xl mx-auto px-5 sm:px-8 py-12 sm:py-16">
      <span class="label">Last updated 2026-05-16</span>
      <h1 class="display text-4xl sm:text-5xl tracking-tight mt-3 mb-6">Privacy Policy</h1>

      <p class="text-base sm:text-lg leading-relaxed mb-8">
        CrisisMapper is a non-commercial humanitarian project built for the UNDP
        <em>Build the Future of Crisis Mapping</em> challenge. We collect the minimum
        data needed to map damage during a crisis, with a privacy-by-design architecture
        that prevents personal identification.
      </p>

      <h2 class="font-serif font-semibold text-2xl sm:text-3xl mt-10 mb-4">What we collect</h2>
      <ul class="list-disc ps-6 space-y-2 text-base leading-relaxed">
        <li><strong>Damage photos</strong> — EXIF metadata (camera serial, GPS, timestamps) is stripped server-side before storage.</li>
        <li><strong>Approximate location</strong> — GPS coordinates from the device or a Plus Code. Stored at the report level only.</li>
        <li><strong>Severity classification</strong> — produced by an AI vision model (Groq Llama 4 Scout, with Google Gemini as automatic fallback if Groq is unavailable) and optionally confirmed by the reporter. Only the photo bytes are sent to these providers — no identifiers travel with the request.</li>
        <li><strong>Free-text descriptions</strong> — optional notes you provide.</li>
      </ul>

      <h2 class="font-serif font-semibold text-2xl sm:text-3xl mt-10 mb-4">What we do NOT collect</h2>
      <ul class="list-disc ps-6 space-y-2 text-base leading-relaxed">
        <li>Real names, addresses, or any other personally identifying information.</li>
        <li>Device identifiers, advertising IDs, or browser fingerprints.</li>
        <li>Contact lists or social-graph data.</li>
        <li>Location outside the active crisis report (we do not track movement).</li>
      </ul>

      <h2 class="font-serif font-semibold text-2xl sm:text-3xl mt-10 mb-4">Who sees the data</h2>
      <p class="text-base leading-relaxed mb-4">
        The aggregated, anonymized damage reports are published on a public map so aid
        organizations and the public can see where help is needed. The underlying database
        is operated by the project maintainer for the duration of the competition and is
        not shared with any commercial third party.
      </p>

      <h2 class="font-serif font-semibold text-2xl sm:text-3xl mt-10 mb-4">Data deletion</h2>
      <p class="text-base leading-relaxed mb-4">
        Web reports are submitted anonymously — we store no account, phone number, or
        any identifier that links a report back to you, so there is nothing user-specific
        to delete. Reports you queued offline but have not yet synced can be removed by
        clearing your browser's site data for the app. See the
        <NuxtLink to="/data-deletion" class="underline">data deletion</NuxtLink> page for details.
      </p>

      <h2 class="font-serif font-semibold text-2xl sm:text-3xl mt-10 mb-4">Contact</h2>
      <p class="text-base leading-relaxed">
        Questions, deletion requests, or security disclosures:
        <a href="mailto:phinart98@gmail.com" class="underline">phinart98@gmail.com</a>.
      </p>

      <hr class="rule my-12" />

      <p class="text-sm text-ink-light">
        <NuxtLink to="/" class="underline">← Back to CrisisMapper</NuxtLink>
        &nbsp;·&nbsp;
        <NuxtLink to="/terms" class="underline">Terms of Service</NuxtLink>
      </p>
    </section>
  </main>
</template>
