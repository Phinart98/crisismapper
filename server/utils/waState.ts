import type { WaContext, WaSession, WaState } from './waSession'
import type {
  WaImageMessage,
  WaInboundMessage,
  WaInteractiveMessage,
  WaLocationMessage,
  WaTextMessage,
} from './waTypes'
import type { DbSeverity } from '~/utils/severity'
import { PLUSCODE_RE } from '~/utils/pluscode'
import type { WaInfraType, WaLocationMethod } from './waReport'

export type Effect =
  | { kind: 'process_image'; mediaId: string }
  | {
      kind: 'insert_report'
      severity: DbSeverity
      infrastructureType: WaInfraType
      locationMethod: WaLocationMethod
      lng: number | null
      lat: number | null
      plusCode: string | null
      landmark: string | null
      rawTextForDecode: string | null
    }
  | { kind: 'status_digest' }
  | {
      kind: 'more_step'
      reportId: string
      step: 'electricity' | 'health' | 'needs'
      choice: string
    }

export interface Transition {
  state: WaState
  currentReportId: string | null
  context: WaContext
  reply: string | null
  listReply: {
    body: string
    button: string
    rows: Array<{ id: string; title: string; description?: string }>
  } | null
  effects: Effect[]
}

const WELCOME =
  'CrisisMapper 🗺️ — Report damage in your area.\nPlease send a photo of the damage.'

const RESTART_RE = /^(hi|hello|start|report|menu)$/i

function textBody(msg: WaInboundMessage): string {
  if (msg.type !== 'text') return ''
  return (msg as WaTextMessage).text?.body?.trim() ?? ''
}

function interactiveReplyId(msg: WaInboundMessage): string | null {
  if (msg.type !== 'interactive') return null
  const i = (msg as WaInteractiveMessage).interactive
  return i?.list_reply?.id ?? i?.button_reply?.id ?? null
}

function aiSeverityLabel(severity: DbSeverity): string {
  switch (severity) {
    case 'negligible': return 'minimal'
    case 'moderate': return 'partial'
    case 'severe': return 'severe'
    case 'destroyed': return 'complete'
    default: return 'uncertain'
  }
}

function severityConfirmList(
  body: string
): NonNullable<Transition['listReply']> {
  return {
    body,
    button: 'Pick one',
    rows: [
      { id: 'sev_yes', title: '✅ Yes, correct' },
      { id: 'sev_minimal', title: '🟡 Minimal' },
      { id: 'sev_complete', title: '🔴 Complete' },
      { id: 'sev_other', title: '🛣️ Not a building' },
    ],
  }
}

const RESTART: () => Transition = () => ({
  state: 'AWAITING_PHOTO',
  currentReportId: null,
  context: {},
  reply: WELCOME,
  listReply: null,
  effects: [],
})

export function transition(session: WaSession, msg: WaInboundMessage): Transition {
  const baseContext = { ...session.context }
  const currentReportId = session.current_report_id
  const text = textBody(msg)
  const textLower = text.toLowerCase()

  // Global commands work from any state.
  if (textLower === 'status') {
    return {
      state: session.state,
      currentReportId,
      context: baseContext,
      reply: null,
      listReply: null,
      effects: [{ kind: 'status_digest' }],
    }
  }

  // 'more' opens the extended-details sub-flow. Stay in DB state DONE and
  // track the step in context.more_step — keeps the state CHECK constraint clean.
  if (textLower === 'more' && session.state === 'DONE' && currentReportId) {
    return {
      state: 'DONE',
      currentReportId,
      context: { ...baseContext, more_step: 'electricity' },
      reply:
        'Optional extra details — reply with a number.\n' +
        'Electricity: 1) Working  2) Partial  3) Out  4) Unknown\n' +
        '(or "skip")',
      listReply: null,
      effects: [],
    }
  }

  // Sub-flow choice handling for 'more': stays in DONE, advances more_step.
  // 'skip' is handled inside handleMoreStep — it advances one step at a time
  // (the prompts say "or skip" per step, not "or skip to exit"). The user
  // can always type 'report' to restart entirely.
  if (session.state === 'DONE' && typeof baseContext.more_step === 'string' && currentReportId) {
    return handleMoreStep(baseContext, currentReportId, textLower)
  }

  if (RESTART_RE.test(text)) return RESTART()

  switch (session.state) {
    case 'IDLE':
      return RESTART()

    case 'AWAITING_PHOTO': {
      if (msg.type === 'image') {
        const mediaId = (msg as WaImageMessage).image?.id
        if (!mediaId) {
          return {
            state: session.state,
            currentReportId,
            context: baseContext,
            reply: 'I couldn\'t read that photo — try sending it again.',
            listReply: null,
            effects: [],
          }
        }
        return {
          state: 'AWAITING_CONFIRM',
          currentReportId,
          context: baseContext,
          reply: '📸 Got it — analyzing the photo, give me a few seconds…',
          listReply: null,
          effects: [{ kind: 'process_image', mediaId }],
        }
      }
      return {
        state: session.state,
        currentReportId,
        context: baseContext,
        reply: 'Please send a photo of the damage (tap 📎 → Camera).',
        listReply: null,
        effects: [],
      }
    }

    case 'AWAITING_CONFIRM': {
      const aiSeverity: DbSeverity = baseContext.ai?.severity ?? 'moderate'
      const interactiveId = interactiveReplyId(msg)
      const choice = interactiveId ?? textLower

      // 1 / yes / sev_yes → use AI's severity
      if (choice === '1' || choice === 'y' || choice === 'yes' || choice === 'sev_yes') {
        return advanceToLocation(baseContext, currentReportId, aiSeverity, 'building')
      }
      if (choice === '2' || choice === 'sev_minimal') {
        return advanceToLocation(baseContext, currentReportId, 'negligible', 'building')
      }
      if (choice === '3' || choice === 'sev_complete') {
        // "Complete / total damage" → catastrophic. 'destroyed' rather than
        // 'severe'; both export to the 3-tier 'complete' bucket but the
        // 4-tier internal value should match the user's word choice.
        return advanceToLocation(baseContext, currentReportId, 'destroyed', 'building')
      }
      if (choice === '4' || choice === 'sev_other') {
        // "Not a building" — clamp severity away from 'unknown' so the row
        // still appears in exports (damage_classification GENERATED column
        // returns NULL for 'unknown', which export queries filter out).
        const safe = aiSeverity === 'unknown' ? 'moderate' : aiSeverity
        return advanceToLocation(baseContext, currentReportId, safe, 'other')
      }

      return {
        state: session.state,
        currentReportId,
        context: baseContext,
        reply: 'Reply 1 (yes), 2 (minimal), 3 (complete), or 4 (not a building).',
        listReply: null,
        effects: [],
      }
    }

    case 'AWAITING_LOCATION': {
      const severity = baseContext.confirmed_severity ?? 'moderate'
      const infra = baseContext.confirmed_infra ?? 'building'

      if (msg.type === 'location') {
        const loc = (msg as WaLocationMessage).location
        if (loc && typeof loc.latitude === 'number' && typeof loc.longitude === 'number') {
          return buildInsertReport(baseContext, currentReportId, severity, infra, {
            locationMethod: 'whatsapp_share',
            lng: loc.longitude,
            lat: loc.latitude,
          })
        }
      }

      if (msg.type === 'text') {
        const trimmed = text.trim()
        if (PLUSCODE_RE.test(trimmed)) {
          return buildInsertReport(baseContext, currentReportId, severity, infra, {
            locationMethod: 'plus_code',
            plusCode: trimmed.toUpperCase(),
            rawTextForDecode: trimmed.toUpperCase(),
          })
        }
        if (trimmed.length > 2) {
          return buildInsertReport(baseContext, currentReportId, severity, infra, {
            locationMethod: 'landmark_text',
            landmark: trimmed.slice(0, 240),
          })
        }
      }

      return {
        state: session.state,
        currentReportId,
        context: baseContext,
        reply:
          'Share your location:\n📎 → Location → Send Current Location.\n' +
          'Or type a nearby landmark, street name, or Plus Code (e.g. 6FX4+MR).',
        listReply: null,
        effects: [],
      }
    }

    case 'DONE':
      // Any unrelated message after DONE restarts the flow.
      return RESTART()
  }
}

function advanceToLocation(
  baseContext: WaContext,
  currentReportId: string | null,
  severity: DbSeverity,
  infra: WaInfraType
): Transition {
  return {
    state: 'AWAITING_LOCATION',
    currentReportId,
    context: { ...baseContext, confirmed_severity: severity, confirmed_infra: infra },
    reply:
      'Got it. Now share your location:\n📎 → Location → Send Current Location.\n' +
      'Or type a nearby landmark, street name, or Plus Code (e.g. 6FX4+MR).',
    listReply: null,
    effects: [],
  }
}

interface InsertReportLocation {
  locationMethod: WaLocationMethod
  lng?: number
  lat?: number
  plusCode?: string
  landmark?: string
  rawTextForDecode?: string
}

function buildInsertReport(
  baseContext: WaContext,
  currentReportId: string | null,
  severity: DbSeverity,
  infra: WaInfraType,
  loc: InsertReportLocation
): Transition {
  return {
    state: 'DONE',
    currentReportId,
    context: { ...baseContext, more_step: null },
    reply: null,
    listReply: null,
    effects: [{
      kind: 'insert_report',
      severity,
      infrastructureType: infra,
      locationMethod: loc.locationMethod,
      lng: loc.lng ?? null,
      lat: loc.lat ?? null,
      plusCode: loc.plusCode ?? null,
      landmark: loc.landmark ?? null,
      rawTextForDecode: loc.rawTextForDecode ?? null,
    }],
  }
}

function handleMoreStep(
  baseContext: WaContext,
  reportId: string,
  textLower: string
): Transition {
  const step = baseContext.more_step as 'electricity' | 'health' | 'needs'

  if (textLower === 'skip') {
    return advanceMoreStep(baseContext, reportId, step, null)
  }

  if (step === 'electricity' || step === 'health') {
    if (!['1', '2', '3', '4'].includes(textLower)) {
      const opts = step === 'electricity'
        ? 'Electricity: 1) Working  2) Partial  3) Out  4) Unknown'
        : 'Health services: 1) Open  2) Partially open  3) Closed  4) Unknown'
      return {
        state: 'DONE',
        currentReportId: reportId,
        context: baseContext,
        reply: `Reply with 1/2/3/4 or "skip".\n${opts}`,
        listReply: null,
        effects: [],
      }
    }
  }
  return advanceMoreStep(baseContext, reportId, step, textLower)
}

function advanceMoreStep(
  baseContext: WaContext,
  reportId: string,
  step: 'electricity' | 'health' | 'needs',
  choice: string | null
): Transition {
  const effects: Effect[] = choice
    ? [{ kind: 'more_step', reportId, step, choice }]
    : []

  if (step === 'electricity') {
    return {
      state: 'DONE',
      currentReportId: reportId,
      context: { ...baseContext, more_step: 'health' },
      reply: 'Health services nearby?\n1) Open  2) Partially open  3) Closed  4) Unknown\n(or "skip")',
      listReply: null,
      effects,
    }
  }
  if (step === 'health') {
    return {
      state: 'DONE',
      currentReportId: reportId,
      context: { ...baseContext, more_step: 'needs' },
      reply:
        'What does the community most need right now?\n' +
        'Reply any/all: water food shelter medical search\n(or "skip")',
      listReply: null,
      effects,
    }
  }
  // needs — last step, close the sub-flow
  return {
    state: 'DONE',
    currentReportId: reportId,
    context: { ...baseContext, more_step: null },
    reply: '✅ Details added to your report. Thank you — this helps aid teams prioritize.',
    listReply: null,
    effects,
  }
}

export function buildConfirmList(aiSeverity: DbSeverity, aiConfidence: number): NonNullable<Transition['listReply']> {
  const label = aiSeverityLabel(aiSeverity)
  const pct = Math.round(aiConfidence * 100)
  const body =
    aiSeverity === 'unknown'
      ? 'I couldn\'t analyze the photo confidently. What damage level?'
      : `I see: ${label} building damage (${pct}% confident).\nIs that right?`
  return severityConfirmList(body)
}
