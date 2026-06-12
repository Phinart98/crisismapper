<script setup lang="ts">
// Custom Language Pack tool (Phase 8 / Q3 extensibility pathway). Operator-facing
// and intentionally English-only — it is not part of the judged reporter/dashboard
// surface. Bootstraps a new locale by machine-translating the English master via
// LibreTranslate, then lets the operator review + download a committable JSON.
// `?raw` bypasses @nuxtjs/i18n's precompile transform (a plain import would hand us
// compiled vue-i18n AST objects, not strings) — we need the literal master text.
import enRaw from '@@/i18n/locales/en.json?raw'

definePageMeta({ middleware: 'staff' })
useHead({
  title: 'Custom Language Pack — CrisisMapper',
  meta: [{ name: 'robots', content: 'noindex' }],
})

interface TranslateResponse {
  translations: Record<string, string>
  engine: string
  failed: string[]
}

const EN = JSON.parse(enRaw) as Record<string, string>
const EN_KEYS = Object.keys(EN).filter((k) => k !== 'dir')

const target = ref('')
const targetName = ref('')
const dir = ref<'ltr' | 'rtl'>('ltr')
const uploaded = ref<Record<string, string>>({})
const uploadName = ref('')

type Origin = 'uploaded' | 'machine' | 'empty'
const rows = ref<{ key: string; en: string; value: string; origin: Origin }[]>([])
const status = ref<'idle' | 'loading' | 'done' | 'error'>('idle')
const errorMsg = ref('')
const failedKeys = ref<string[]>([])

const missingKeys = computed(() => EN_KEYS.filter((k) => !uploaded.value[k]))

function onUpload(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  uploadName.value = file.name
  const reader = new FileReader()
  reader.onload = () => {
    try {
      const json = JSON.parse(String(reader.result)) as Record<string, string>
      uploaded.value = json
      if (json.dir === 'rtl') dir.value = 'rtl'
      errorMsg.value = ''
    } catch {
      errorMsg.value = 'Could not parse that JSON file.'
      uploaded.value = {}
      uploadName.value = ''
    }
  }
  reader.readAsText(file)
}

async function generate() {
  if (!/^[a-z]{2,3}(-[A-Za-z]{2,4})?$/.test(target.value)) {
    errorMsg.value = 'Enter a valid language code (e.g. sw, bn, pt-BR).'
    return
  }
  status.value = 'loading'
  errorMsg.value = ''
  failedKeys.value = []

  const subset: Record<string, string> = {}
  for (const k of missingKeys.value) subset[k] = EN[k]!

  const machine: Record<string, string> = {}
  try {
    if (Object.keys(subset).length) {
      const res = await $fetch<TranslateResponse>('/api/translate', {
        method: 'POST',
        body: { target: target.value, keys: subset },
      })
      Object.assign(machine, res.translations)
      failedKeys.value = res.failed
    }
    status.value = 'done'
  } catch (e: unknown) {
    // Engine unreachable / unauthorized — still build the table so the operator can
    // fill missing keys by hand (manual-upload fallback path).
    const err = e as { data?: { message?: string }; message?: string }
    errorMsg.value = err?.data?.message || err?.message || 'Translation engine error.'
    status.value = 'error'
  }

  rows.value = EN_KEYS.map((k) => {
    const value = uploaded.value[k] ?? machine[k] ?? ''
    const origin: Origin = uploaded.value[k] ? 'uploaded' : machine[k] ? 'machine' : 'empty'
    return { key: k, en: EN[k]!, value, origin }
  })
}

const filledCount = computed(() => rows.value.filter((r) => r.value.trim()).length)

// Representative strings rendered live as the operator edits, so they preview the
// result in real chrome before committing. Only these keys are read, so the preview
// lookup picks just them rather than rebuilding the whole ~180-key map per keystroke.
const PREVIEW_KEYS = ['title', 'landingTagline', 'submit', 'sevComplete', 'dashHeatmap', 'filterSeverity', 'modalVerify', 'feedViewOnMap']
const preview = computed(() => {
  const byKey = new Map(rows.value.map((r) => [r.key, r.value]))
  return Object.fromEntries(PREVIEW_KEYS.map((k) => [k, byKey.get(k) ?? ''])) as Record<string, string>
})

// Copy-pasteable nuxt.config locale entry — folds in the operator's display name + dir
// so the config handoff is complete (not just the downloaded JSON).
const configSnippet = computed(() => {
  const code = target.value || 'xx'
  const name = targetName.value || code
  return `{ code: '${code}', file: '${code}.json', dir: '${dir.value}', name: '${name}', language: '${code}' }`
})

function download() {
  const pack: Record<string, string> = { dir: dir.value }
  for (const r of rows.value) pack[r.key] = r.value
  const blob = new Blob([JSON.stringify(pack, null, 2)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${target.value || 'locale'}.json`
  a.click()
  URL.revokeObjectURL(a.href)
}
</script>

<template>
  <main class="min-h-screen bg-parchment text-ink">
    <AdminNav />
    <header class="border-b border-parchment-deep px-5 sm:px-8 py-5">
      <div class="max-w-5xl mx-auto">
        <span class="label">Phase 8 · Extensibility</span>
        <h1 class="font-serif font-bold text-2xl sm:text-3xl mt-1">Custom Language Pack</h1>
        <p class="text-sm text-ink-light mt-1.5 max-w-2xl">
          Bootstrap a new locale by machine-translating the English master ({{ EN_KEYS.length }} keys)
          via LibreTranslate, review every string, then download a <code class="font-mono text-[12px]">&lt;code&gt;.json</code>
          to commit into <code class="font-mono text-[12px]">i18n/locales/</code>.
        </p>
      </div>
    </header>

    <section class="max-w-5xl mx-auto px-5 sm:px-8 py-6">
      <!-- Setup form -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <label class="flex flex-col gap-1.5">
          <span class="label">Language code</span>
          <input
            v-model="target" placeholder="sw"
            class="focus-ring px-3 min-h-[44px] bg-white border border-parchment-deep rounded-sm text-base"
          >
        </label>
        <label class="flex flex-col gap-1.5">
          <span class="label">Display name</span>
          <input
            v-model="targetName" placeholder="Kiswahili"
            class="focus-ring px-3 min-h-[44px] bg-white border border-parchment-deep rounded-sm text-base"
          >
        </label>
        <label class="flex flex-col gap-1.5">
          <span class="label">Direction</span>
          <select
            v-model="dir"
            class="focus-ring px-3 min-h-[44px] bg-white border border-parchment-deep rounded-sm text-base cursor-pointer"
          >
            <option value="ltr">LTR</option>
            <option value="rtl">RTL</option>
          </select>
        </label>
      </div>

      <div class="flex flex-col sm:flex-row sm:items-center gap-3 mt-4">
        <label class="btn btn-ghost min-h-[44px] cursor-pointer text-sm">
          Upload partial JSON…
          <input type="file" accept="application/json,.json" class="hidden" @change="onUpload">
        </label>
        <span v-if="uploadName" class="font-mono text-[12px] text-ink-light">
          {{ uploadName }} · {{ missingKeys.length }} keys to fill
        </span>
        <button
          type="button"
          class="btn btn-primary min-h-[44px] text-sm sm:ms-auto"
          :disabled="status === 'loading'"
          @click="generate"
        >
          {{ status === 'loading' ? 'Translating…' : 'Generate translation' }}
        </button>
      </div>

      <p v-if="errorMsg" class="mt-4 p-3 rounded-sm bg-accent/10 border border-accent/30 text-[13px] text-accent">
        {{ errorMsg }}
        <span v-if="status === 'error'" class="block mt-1 text-ink-mid">
          You can still fill the empty rows below by hand and download the pack.
        </span>
      </p>

      <!-- The MT engine is self-hosted by design: translations of crisis terminology
           never leave operator infrastructure, and the tool works in air-gapped or
           sanctioned environments with no vendor dependency. -->
      <div v-if="status === 'error'" class="mt-3 p-3 rounded-sm bg-parchment-mid border border-parchment-deep text-[13px] text-ink-mid max-w-3xl leading-relaxed">
        <span class="label block mb-1.5">About the translation engine</span>
        Machine translation runs on a self-hosted
        <a href="https://github.com/LibreTranslate/LibreTranslate" target="_blank" rel="noopener" class="underline">LibreTranslate</a>
        instance (open source, offline-capable) so no text is sent to an external vendor. To enable it,
        run the engine locally:
        <code class="block font-mono text-[11px] bg-white border border-parchment-deep rounded-sm px-2 py-1.5 mt-1.5 mb-1.5 overflow-x-auto">docker run -ti --rm -p 5000:5000 libretranslate/libretranslate</code>
        or point <code class="font-mono text-[11px]">NUXT_LIBRE_TRANSLATE_URL</code> at a hosted instance.
        Without it, machine translation is skipped — the manual workflow below still produces a complete pack.
      </div>

      <!-- Review + preview -->
      <div v-if="rows.length" class="mt-6 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start">
        <!-- Review table -->
        <div>
          <div class="flex items-center justify-between mb-2.5">
            <div class="label">Review · {{ filledCount }}/{{ rows.length }} filled</div>
            <button type="button" class="btn btn-primary min-h-[36px] text-[13px]" :disabled="filledCount < rows.length" @click="download">
              Download {{ target || 'locale' }}.json
            </button>
          </div>
          <div class="border border-parchment-deep rounded-sm overflow-hidden">
            <div
              v-for="r in rows" :key="r.key"
              class="grid grid-cols-1 sm:grid-cols-2 gap-2 px-3 py-2.5 border-b border-parchment-deep last:border-b-0"
              :class="{ 'bg-accent/5': failedKeys.includes(r.key) }"
            >
              <div class="min-w-0">
                <div class="font-mono text-[10px] text-ink-ghost">{{ r.key }}</div>
                <div class="text-[13px] text-ink-mid leading-snug">{{ r.en }}</div>
              </div>
              <input
                v-model="r.value"
                :dir="dir"
                :lang="target || undefined"
                :placeholder="r.origin === 'empty' ? '— needs translation —' : ''"
                class="focus-ring px-2.5 min-h-[40px] bg-white border rounded-sm text-base self-center"
                :class="r.value.trim() ? 'border-parchment-deep' : 'border-accent/40'"
              >
            </div>
          </div>
        </div>

        <!-- Live preview -->
        <aside class="lg:sticky lg:top-6">
          <div class="label mb-2.5">Live preview</div>
          <div :dir="dir" :lang="target || undefined" class="border border-parchment-deep rounded-md overflow-hidden bg-parchment">
            <div class="flex items-center justify-between gap-2 px-4 h-[48px] border-b border-parchment-deep">
              <span class="font-serif font-semibold text-sm truncate">{{ preview.title || '—' }}</span>
              <span class="label">{{ (target || 'xx').toUpperCase() }}</span>
            </div>
            <div class="p-4 space-y-3">
              <p class="text-[13px] text-ink-light leading-relaxed">{{ preview.landingTagline || '—' }}</p>
              <div class="flex flex-wrap gap-2">
                <span class="sev-chip complete">{{ preview.sevComplete || '—' }}</span>
                <span class="label border border-parchment-deep rounded-sm px-2 py-1">{{ preview.dashHeatmap || '—' }}</span>
                <span class="label border border-parchment-deep rounded-sm px-2 py-1">{{ preview.filterSeverity || '—' }}</span>
              </div>
              <button class="btn btn-primary min-h-[44px] w-full text-sm">{{ preview.submit || '—' }}</button>
              <div class="flex items-center justify-between text-[12px]">
                <span class="font-mono text-ink-mid">{{ preview.modalVerify || '—' }}</span>
                <span class="font-mono text-accent">{{ preview.feedViewOnMap || '—' }} <span class="rtl-flip">→</span></span>
              </div>
            </div>
          </div>
          <p class="text-[11px] text-ink-ghost mt-2 leading-relaxed">
            After downloading, add this entry to the <code class="font-mono">i18n.locales</code>
            array in <code class="font-mono">nuxt.config.ts</code> to ship it:
          </p>
          <code class="block font-mono text-[11px] mt-1 p-2 rounded-sm bg-parchment-mid border border-parchment-deep break-all">{{ configSnippet }}</code>
        </aside>
      </div>
    </section>
  </main>
</template>
