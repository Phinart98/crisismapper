import OpenAI from 'openai'
import type { ClassifyResult, PhotoQuality } from '~/utils/aiClassify'
import type { DbSeverity } from '~/utils/severity'

export type { ClassifyResult } from '~/utils/aiClassify'

const SYSTEM_PROMPT =
  'You are a building damage assessment AI for the UN. Classify damage using the Copernicus EMS scale. ' +
  'Always explain your reasoning step by step. Be precise with confidence percentages.'

const USER_PROMPT = `Analyze this building photo from a crisis zone.

Return JSON:
{
  "severity": "negligible" | "moderate" | "severe" | "destroyed" | "unknown",
  "confidence": 0.0-1.0,
  "damage_percentage": 0-100,
  "reasoning": "Step-by-step explanation of what you see and why you classified it this way",
  "damage_indicators": ["list", "of", "specific", "visual", "evidence"],
  "infrastructure_visible": true | false,
  "photo_quality": "good" | "acceptable" | "poor",
  "recommendation": "What additional photos or info would help confirm this assessment"
}`

const VALID_SEVERITIES: DbSeverity[] = ['negligible', 'moderate', 'severe', 'destroyed', 'unknown']
const VALID_QUALITIES: PhotoQuality[] = ['good', 'acceptable', 'poor']

interface ProviderConfig {
  name: 'groq' | 'gemini'
  baseURL: string
  apiKey: string
  model: string
}

const clientCache = new Map<string, OpenAI>()
function getClient(p: ProviderConfig): OpenAI {
  const key = `${p.baseURL}|${p.apiKey}`
  let c = clientCache.get(key)
  if (!c) {
    c = new OpenAI({ baseURL: p.baseURL, apiKey: p.apiKey, maxRetries: 2 })
    clientCache.set(key, c)
  }
  return c
}

function getProviders(): ProviderConfig[] {
  const { groqApiKey, groqVisionModel, geminiApiKey, geminiVisionModel } = useRuntimeConfig()
  const out: ProviderConfig[] = []
  if (groqApiKey) {
    out.push({
      name: 'groq',
      baseURL: 'https://api.groq.com/openai/v1',
      apiKey: groqApiKey,
      model: groqVisionModel || 'meta-llama/llama-4-scout-17b-16e-instruct',
    })
  }
  if (geminiApiKey) {
    out.push({
      name: 'gemini',
      baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai',
      apiKey: geminiApiKey,
      model: geminiVisionModel || 'gemini-2.5-flash',
    })
  }
  return out
}

async function callProvider(p: ProviderConfig, dataUrl: string): Promise<ClassifyResult> {
  const start = Date.now()
  const client = getClient(p)

  const response = await client.chat.completions.create({
    model: p.model,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: dataUrl } },
          { type: 'text', text: USER_PROMPT },
        ],
      },
    ],
  })

  const raw = response.choices[0]?.message?.content
  if (!raw) throw new Error('empty_response')
  const parsed = JSON.parse(raw)

  return {
    severity: VALID_SEVERITIES.includes(parsed.severity) ? parsed.severity : 'unknown',
    confidence: clamp01(Number(parsed.confidence)),
    damage_percentage: clampPercent(Number(parsed.damage_percentage)),
    // Cap reasoning and recommendation lengths. Gemini 2.5 Flash in particular can
    // emit multi-paragraph chain-of-thought reasoning; unbounded strings would bloat
    // ai_raw_response JSONB across thousands of reports and overflow the reasoning
    // accordion in AiClassificationCard.vue.
    reasoning: String(parsed.reasoning ?? '').slice(0, 2000),
    damage_indicators: Array.isArray(parsed.damage_indicators)
      ? parsed.damage_indicators.map((x: unknown) => String(x).slice(0, 80)).slice(0, 12)
      : [],
    infrastructure_visible: Boolean(parsed.infrastructure_visible),
    photo_quality: VALID_QUALITIES.includes(parsed.photo_quality) ? parsed.photo_quality : 'acceptable',
    recommendation: String(parsed.recommendation ?? '').slice(0, 500),
    _meta: {
      provider: p.name,
      model: p.model,
      duration_ms: Date.now() - start,
      fallback_used: false,
    },
  }
}

export async function classifyDamage(buf: Buffer): Promise<ClassifyResult> {
  const providers = getProviders()
  if (providers.length === 0) return degraded(0)

  const dataUrl = `data:image/webp;base64,${buf.toString('base64')}`

  let totalDuration = 0
  for (let i = 0; i < providers.length; i++) {
    const start = Date.now()
    try {
      const result = await callProvider(providers[i]!, dataUrl)
      result._meta.fallback_used = i > 0
      return result
    } catch (err) {
      totalDuration += Date.now() - start
      console.warn(`[aiVision] ${providers[i]!.name} failed:`, err instanceof Error ? err.message : String(err))
    }
  }

  return degraded(totalDuration)
}

function degraded(duration_ms: number): ClassifyResult {
  return {
    severity: 'unknown',
    confidence: 0,
    damage_percentage: 0,
    reasoning: 'AI classification temporarily unavailable. Please rely on reporter judgment.',
    damage_indicators: [],
    infrastructure_visible: false,
    photo_quality: 'acceptable',
    recommendation: 'Submit the report and a human reviewer will assess the photo.',
    _meta: {
      provider: 'degraded',
      model: 'none',
      duration_ms,
      fallback_used: true,
    },
  }
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(1, n))
}

function clampPercent(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(100, Math.round(n)))
}
