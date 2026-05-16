import type { WaSession, WaState } from './waSession'
import type { WaImageMessage, WaInboundMessage, WaTextMessage } from './waTypes'

export interface Transition {
  state: WaState
  currentReportId: string | null
  context: Record<string, unknown>
  reply: string
}

const WELCOME =
  'CrisisMapper 🗺️ — Report damage in your area.\nPlease send a photo of the damage.'

const RESTART_RE = /^(hi|hello|start|report|menu)$/i

function textBody(msg: WaInboundMessage): string {
  if (msg.type !== 'text') return ''
  return (msg as WaTextMessage).text?.body?.trim() ?? ''
}

export function transition(session: WaSession, msg: WaInboundMessage): Transition {
  const baseContext = { ...session.context }
  const currentReportId = session.current_report_id

  if (RESTART_RE.test(textBody(msg))) {
    return { state: 'AWAITING_PHOTO', currentReportId: null, context: {}, reply: WELCOME }
  }

  switch (session.state) {
    case 'IDLE':
      return { state: 'AWAITING_PHOTO', currentReportId: null, context: {}, reply: WELCOME }

    case 'AWAITING_PHOTO': {
      if (msg.type === 'image') {
        const mediaId = (msg as WaImageMessage).image?.id
        return {
          state: 'AWAITING_CONFIRM',
          currentReportId,
          context: { ...baseContext, last_media_id: mediaId },
          reply:
            '📸 Got it.\n(Phase 5 stub — AI verdict in Phase 6.)\n' +
            "Reply '1' to continue, or '4' if this isn't a building.",
        }
      }
      return {
        state: session.state,
        currentReportId,
        context: baseContext,
        reply: 'Please send a photo of the damage (tap 📎 → Camera).',
      }
    }

    case 'AWAITING_CONFIRM': {
      const t = textBody(msg).toLowerCase()
      if (t === '1' || t === 'yes' || t === 'y') {
        return {
          state: 'AWAITING_LOCATION',
          currentReportId,
          context: { ...baseContext, severity_confirmed: true },
          reply:
            'Got it. Now share your location:\n📎 → Location → Send Current Location.\nOr type a nearby landmark.',
        }
      }
      if (t === '2' || t === '3' || t === '4') {
        return {
          state: 'AWAITING_LOCATION',
          currentReportId,
          context: { ...baseContext, severity_correction: t },
          reply: 'Noted (Phase 6 will record the correction). Now share your location.',
        }
      }
      return {
        state: session.state,
        currentReportId,
        context: baseContext,
        reply: 'Reply 1 (yes), 2 (minimal), 3 (complete), or 4 (not a building).',
      }
    }

    case 'AWAITING_LOCATION': {
      if (msg.type === 'location' || msg.type === 'text') {
        return {
          state: 'DONE',
          currentReportId,
          context: baseContext,
          reply:
            "✅ Report saved (Phase 5 stub — DB write in Phase 6).\nReply 'report' to submit another.",
        }
      }
      return {
        state: session.state,
        currentReportId,
        context: baseContext,
        reply: 'Share your location (📎 → Location) or type a landmark.',
      }
    }

    case 'DONE':
      return { state: 'AWAITING_PHOTO', currentReportId: null, context: {}, reply: WELCOME }
  }
}
