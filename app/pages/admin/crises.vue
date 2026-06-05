<script setup lang="ts">
// Staff crisis console: create/manage crises by drawing a zone on the map — no SQL.
// A new/edited crisis immediately drives the dashboard extent + reporter point-in-bbox
// attribution (both read /api/crises). Operator-facing, English-literal.
definePageMeta({ middleware: 'staff' })
useHead({ title: 'Crises — CrisisMapper', meta: [{ name: 'robots', content: 'noindex' }] })

import { HAZARD_TYPES, type HazardType } from '~/utils/severity'

interface CrisisRow {
  id: string
  name: string
  crisis_type: string
  is_active: boolean
  created_at: string
  bbox: [number, number, number, number] | null
}

const { data: crises, refresh, pending } = await useFetch<CrisisRow[]>('/api/admin/crises', { default: () => [] })

// Form state — editingId null = creating a new crisis.
const editingId = ref<string | null>(null)
const name = ref('')
const crisisType = ref<HazardType>('earthquake')
const bbox = ref<[number, number, number, number] | null>(null)
const saving = ref(false)
const errorMsg = ref('')

const isEditing = computed(() => editingId.value !== null)

function resetForm() {
  editingId.value = null
  name.value = ''
  crisisType.value = 'earthquake'
  bbox.value = null
  errorMsg.value = ''
}

function editCrisis(c: CrisisRow) {
  editingId.value = c.id
  name.value = c.name
  crisisType.value = (HAZARD_TYPES as readonly string[]).includes(c.crisis_type) ? c.crisis_type as HazardType : 'other'
  bbox.value = c.bbox
  errorMsg.value = ''
  if (import.meta.client) window.scrollTo({ top: 0, behavior: 'smooth' })
}

async function save() {
  errorMsg.value = ''
  if (!name.value.trim()) { errorMsg.value = 'Enter a crisis name.'; return }
  if (!bbox.value) { errorMsg.value = 'Draw the crisis zone on the map.'; return }
  saving.value = true
  try {
    const body = { name: name.value.trim(), crisis_type: crisisType.value, bbox: bbox.value }
    await $fetch(isEditing.value ? `/api/admin/crises/${editingId.value}` : '/api/admin/crises', {
      method: isEditing.value ? 'PATCH' : 'POST',
      body,
    })
    await refresh()
    resetForm()
  } catch (e: unknown) {
    const err = e as { data?: { message?: string }; statusMessage?: string; message?: string }
    errorMsg.value = err?.data?.message || err?.statusMessage || err?.message || 'Could not save the crisis.'
  } finally {
    saving.value = false
  }
}

async function toggleActive(c: CrisisRow) {
  try {
    await $fetch(`/api/admin/crises/${c.id}`, { method: 'PATCH', body: { is_active: !c.is_active } })
    await refresh()
  } catch {
    errorMsg.value = 'Could not update crisis status.'
  }
}
</script>

<template>
  <div class="min-h-[100dvh] bg-parchment text-ink">
    <AdminNav />

    <main class="max-w-6xl mx-auto px-5 sm:px-8 py-6 flex flex-col gap-8">
      <!-- Create / edit form (full width so the draw map gets room) -->
      <section>
        <div class="flex items-center justify-between mb-3">
          <h1 class="font-serif font-bold text-xl sm:text-2xl">{{ isEditing ? 'Edit crisis' : 'New crisis' }}</h1>
          <button v-if="isEditing" type="button" class="btn btn-ghost min-h-[36px] text-[13px]" @click="resetForm">
            + New instead
          </button>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <label class="flex flex-col gap-1.5">
            <span class="label">Name</span>
            <input
              v-model="name" placeholder="Myanmar Earthquake 2026"
              class="focus-ring px-3 min-h-[44px] bg-white border border-parchment-deep rounded-sm text-base"
            >
          </label>
          <label class="flex flex-col gap-1.5">
            <span class="label">Hazard type</span>
            <select
              v-model="crisisType"
              class="focus-ring px-3 min-h-[44px] bg-white border border-parchment-deep rounded-sm text-base cursor-pointer capitalize"
            >
              <option v-for="h in HAZARD_TYPES" :key="h" :value="h" class="capitalize">{{ h }}</option>
            </select>
          </label>
        </div>

        <div class="mb-4">
          <span class="label mb-1.5 block">Zone</span>
          <AdminCrisisMap v-model="bbox" />
        </div>

        <p v-if="errorMsg" class="mb-4 p-3 rounded-sm bg-accent/10 border border-accent/30 text-[13px] text-accent">
          {{ errorMsg }}
        </p>

        <div class="flex items-center gap-3">
          <button type="button" class="btn btn-primary min-h-[44px] text-sm" :disabled="saving" @click="save">
            {{ saving ? 'Saving…' : isEditing ? 'Save changes' : 'Create crisis' }}
          </button>
        </div>
      </section>

      <!-- Existing crises — full-width card grid below the form -->
      <section class="border-t border-parchment-deep pt-6">
        <div class="label mb-3">Crises · {{ crises.length }}</div>
        <div v-if="pending" class="text-sm text-ink-light">Loading…</div>
        <div v-else-if="!crises.length" class="text-sm text-ink-light">No crises yet — create the first one.</div>
        <ul v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <li
            v-for="c in crises" :key="c.id"
            class="border border-parchment-deep rounded-sm p-3 bg-white/40"
            :class="{ 'opacity-55': !c.is_active }"
          >
            <div class="flex items-start justify-between gap-2">
              <button type="button" class="text-start min-w-0 focus-ring" @click="editCrisis(c)">
                <div class="text-[13px] font-medium leading-snug truncate">{{ c.name }}</div>
                <div class="font-mono text-[10px] text-ink-ghost mt-0.5 capitalize">
                  {{ c.crisis_type }} · {{ c.is_active ? 'active' : 'inactive' }}
                </div>
              </button>
              <button
                type="button"
                class="shrink-0 px-2 min-h-[32px] rounded-sm border border-parchment-deep font-mono text-[10px] tracking-[0.06em] uppercase text-ink-mid hover:bg-parchment-mid focus-ring"
                @click="toggleActive(c)"
              >
                {{ c.is_active ? 'Deactivate' : 'Activate' }}
              </button>
            </div>
          </li>
        </ul>
      </section>
    </main>
  </div>
</template>
