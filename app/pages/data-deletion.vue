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
        CrisisMapper is built with privacy-by-design: we do not store personal information
        that identifies you. Your WhatsApp ID is one-way HMAC-SHA256 hashed before any
        write to disk, photo EXIF metadata is stripped server-side, and we never collect
        names, addresses, advertising IDs, or browser fingerprints. As a result, there is
        nothing to delete on a per-user basis in the conventional sense — we cannot
        reverse a hash to find your records.
      </p>

      <h2 class="font-serif font-semibold text-2xl sm:text-3xl mt-10 mb-4">If you still want your contributions removed</h2>
      <p class="text-base leading-relaxed mb-4">
        Email
        <a href="mailto:phinart98@gmail.com?subject=Data%20deletion%20request" class="underline">phinart98@gmail.com</a>
        with the subject line <strong>"Data deletion request"</strong> and the WhatsApp
        number you used to send reports. We will:
      </p>
      <ol class="list-decimal ps-6 space-y-3 text-base leading-relaxed mb-6">
        <li>
          Compute the HMAC-SHA256 hash of your number in memory (the same one-way hash
          used to identify your session) — your raw number is never written to disk or
          logs during this process.
        </li>
        <li>
          Delete all damage reports associated with that hash within 7 days.
        </li>
        <li>
          Reply to your email to confirm the deletion is complete, then discard the
          temporary in-memory hash.
        </li>
      </ol>

      <h2 class="font-serif font-semibold text-2xl sm:text-3xl mt-10 mb-4">Bulk deletion</h2>
      <p class="text-base leading-relaxed mb-4">
        If you used the web reporter (not WhatsApp) and want offline-queued reports
        removed before they sync, clear your browser's site data for
        <code class="bg-ink/5 px-2 py-0.5 rounded text-sm">crisismapper.vercel.app</code>
        in your browser settings. Any reports already submitted server-side require the
        email request above.
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
