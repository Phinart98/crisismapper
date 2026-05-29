<script setup lang="ts">
useHead({
  title: 'Data Deletion · CrisisMapper',
  meta: [{ name: 'description', content: 'How to request deletion of your CrisisMapper contributions.' }],
})
</script>

<template>
  <main class="min-h-screen bg-parchment text-ink">
    <section class="max-w-3xl mx-auto px-5 sm:px-8 py-12 sm:py-16">
      <span class="label">Last updated 2026-05-16</span>
      <h1 class="display text-4xl sm:text-5xl tracking-tight mt-3 mb-6">Data Deletion</h1>

      <p class="text-base sm:text-lg leading-relaxed mb-8">
        CrisisMapper is built with privacy-by-design: web reports are submitted
        anonymously. We store no account, name, address, phone number, advertising ID,
        or browser fingerprint, and photo EXIF metadata is stripped server-side before
        storage. Because nothing identifies you, there is no personal profile to delete.
      </p>

      <h2 class="font-serif font-semibold text-2xl sm:text-3xl mt-10 mb-4">Reports queued offline (not yet synced)</h2>
      <p class="text-base leading-relaxed mb-4">
        Reports you created offline live only in your browser until they sync. To remove
        them before they are sent, clear your browser's site data for
        <code class="bg-ink/5 px-2 py-0.5 rounded text-sm">crisismapper.vercel.app</code>
        in your browser settings.
      </p>

      <h2 class="font-serif font-semibold text-2xl sm:text-3xl mt-10 mb-4">A specific report you submitted</h2>
      <p class="text-base leading-relaxed mb-4">
        Because submitted reports carry no identifier, we cannot look them up by user. If a
        report was posted in error or contains something that should not be public, email
        <a href="mailto:phinart98@gmail.com?subject=Report%20removal%20request" class="underline">phinart98@gmail.com</a>
        with the subject line <strong>"Report removal request"</strong> and the approximate
        location and time of the report so we can identify and remove it.
      </p>

      <h2 class="font-serif font-semibold text-2xl sm:text-3xl mt-10 mb-4">Questions</h2>
      <p class="text-base leading-relaxed">
        For privacy or deletion questions, contact
        <a href="mailto:phinart98@gmail.com" class="underline">phinart98@gmail.com</a>.
      </p>

      <hr class="rule my-12" />

      <p class="text-sm text-ink-light">
        <NuxtLink to="/" class="underline">← Back to CrisisMapper</NuxtLink>
        &nbsp;·&nbsp;
        <NuxtLink to="/privacy" class="underline">Privacy Policy</NuxtLink>
        &nbsp;·&nbsp;
        <NuxtLink to="/terms" class="underline">Terms of Service</NuxtLink>
      </p>
    </section>
  </main>
</template>
