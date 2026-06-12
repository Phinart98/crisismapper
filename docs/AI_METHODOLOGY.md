# How CrisisMapper AI Works

This document describes the AI pipeline that classifies building damage from a single
reporter-submitted photo. It is the public-facing methodology page referenced from
the UNDP proposal (Section 9: AI decision documentation).

## Principle

**The AI assists; the reporter decides.** Every classification surfaces both the
machine's call and a confirm/correct affordance. The final `severity` stored in
`damage_reports` is always the reporter's chosen value. The model's call lives
beside it as `ai_severity` so the divergence is auditable forever.

## Pipeline

```
reporter captures photo
        ↓
client compresses to WebP, max 1024 px, ~200 KB
        ↓
POST /api/ai/classify (multipart)
        ↓
server: Sharp strips EXIF + safety resize
        ↓
unified vision client:
   1. try Groq Llama 4 Scout (primary)
   2. on failure → try Gemini 2.5 Flash (fallback)
   3. on both failures → graceful degradation
        ↓
returns chain-of-thought JSON to the client
        ↓
reporter sees damage %, confidence, reasoning, indicators
        ↓
reporter confirms or overrides severity
        ↓
on submit: both ai_* fields and final severity stored
```

## Severity scale (Copernicus EMS-aligned)

| Internal (4-tier) | Export (3-tier, per UNDP Q&A #14) | Description |
| --- | --- | --- |
| `negligible` | `minimal` | No visible damage |
| `moderate` | `partial` | Visible damage, structure intact |
| `severe` | `complete` | Heavy damage, structure compromised |
| `destroyed` | `complete` | Collapsed or unusable |
| `unknown` | `NULL` (excluded from export) | Photo insufficient to classify |

The DB column `damage_classification` is `GENERATED ALWAYS AS ... STORED` and
collapses the internal 4-tier severity to the 3-tier export bucket automatically.

## Prompt (verbatim)

**System message:**

> You are a building damage assessment AI for the UN. Classify damage using the
> Copernicus EMS scale. Always explain your reasoning step by step. Be precise
> with confidence percentages.

**User message:**

> Analyze this building photo from a crisis zone.
>
> Return JSON:
> ```
> {
>   "severity": "negligible" | "moderate" | "severe" | "destroyed" | "unknown",
>   "confidence": 0.0-1.0,
>   "damage_percentage": 0-100,
>   "reasoning": "Step-by-step explanation of what you see and why you classified it this way",
>   "damage_indicators": ["list", "of", "specific", "visual", "evidence"],
>   "infrastructure_visible": true | false,
>   "photo_quality": "good" | "acceptable" | "poor",
>   "recommendation": "What additional photos or info would help confirm this assessment"
> }
> ```

Both providers run in OpenAI-compatible JSON mode (`response_format: { type:
'json_object' }`), so the response is guaranteed parseable JSON. Server-side
clamping enforces enum values and numeric bounds before the result is returned
or persisted.

## Provider chain

| Position | Provider | Model | Endpoint |
| --- | --- | --- | --- |
| 1 (primary) | Groq | `meta-llama/llama-4-scout-17b-16e-instruct` | `api.groq.com/openai/v1` |
| 2 (fallback) | Google | `gemini-2.5-flash` | `generativelanguage.googleapis.com/v1beta/openai` |
| 3 (degraded) | none | — | returns synthetic envelope, reporter takes over |

Both providers expose an OpenAI-compatible chat completions API, so a single
`openai` Node SDK serves both — only the `baseURL` and `apiKey` differ.

The fallback runs only on hard failure of the primary (HTTP 5xx, network drop,
malformed JSON). The `openai` SDK auto-retries twice within a single provider
before the fallback engages.

> **Note on Llama 4 Maverick:** the original plan named Maverick as the Groq
> vision fallback. Groq deprecated Maverick on 2026-03-09 and there is currently
> no second Groq vision model, so Gemini 2.5 Flash takes that slot instead. If
> Groq introduces a new vision model, swap it in via `NUXT_GROQ_VISION_MODEL`.

## Privacy

EXIF metadata (including GPS coordinates baked into the photo file) is stripped
twice before any persistence:

1. The client's `browser-image-compression` library re-encodes JPEG/PNG/HEIC to
   WebP, which discards most metadata as a side effect of re-encoding.
2. The server's `stripExif()` helper (Sharp) pipes the bytes through
   `.rotate().resize().webp()` once more before either classification or
   Storage write — defense in depth in case any client ever uploads an image
   that still carries EXIF GPS.

Sharp's default behavior on encode is to drop all metadata. `withMetadata()`,
`keepExif()`, and `keepMetadata()` are not called anywhere in the pipeline.

## Confidence in the analyst workflow

The model's confidence is stored per report (`ai_confidence`) and surfaced in
the dashboard's report detail view, so analysts can weigh low-confidence
classifications accordingly. Confidence at or above 0.80 also feeds the
report quality score and the reporter trust score (see
[ARCHITECTURE.md](./ARCHITECTURE.md)).

There is deliberately no automatic accept/reject threshold: human verification
is a staff action (the verify/flag moderation flow), and the AI's role stops at
suggesting. A hard threshold should only be introduced once the validation
report below provides a misclassification breakdown to justify it.

## Audit trail

Every classification call writes its provenance into `damage_reports.ai_raw_response`
(JSONB). The envelope includes:

- The full model response (severity, confidence, damage_percentage, reasoning,
  damage_indicators, infrastructure_visible, photo_quality, recommendation)
- `_meta.provider` (`groq` | `gemini` | `degraded`)
- `_meta.model` (exact model id used)
- `_meta.duration_ms`
- `_meta.fallback_used` (true if the primary failed)

This means every report's row carries proof of which model decided what, with
what latency, and whether the primary succeeded. Useful both for retraining and
for the UNDP evaluation phase if reviewers want to audit specific calls.

## Dataset assumptions

The validation harness scores the prompt against external damage photos. Source
selection per UNDP Q&A #15 ("solvers are encouraged to use external datasets…
with thorough documentation and a clear description of any underlying
assumptions"):

- **Primary source:** xBD dataset (DigitalGlobe/Maxar building damage labels,
  academic license)
- **Secondary source:** Copernicus EMS Activations (publicly released rapid
  mapping products)

Assumptions documented in [`AI_VALIDATION.md`](./AI_VALIDATION.md):

- Photos are ground-level or near-ground angles where building façade damage is
  visually assessable. Satellite top-down views are NOT in scope — CrisisMapper
  is a ground-truth complement to satellite assessment, not a satellite
  classifier.
- Ground-truth labels mapped to the 4-tier Copernicus EMS scale.
- Photos compressed to ≤200 KB WebP before classification, matching what a real
  reporter's device sends.

## Failure modes documented

| Failure | Behavior |
| --- | --- |
| Primary (Groq) rate-limited | SDK auto-retries twice; on continued 429, falls back to Gemini |
| Primary returns malformed JSON | Caught; falls back to Gemini |
| Both providers fail | Returns degraded envelope; reporter completes form manually; `ai_*` columns stored as NULL |
| Photo is non-infrastructure (e.g. animal, landscape) | Model returns `severity: 'unknown'` with low confidence; flagged for manual review |
| Photo too blurry / low-light | Model returns `photo_quality: 'poor'`; surfaced under the reasoning accordion |
| Reporter is offline | Classify request fails on the network; UI shows "AI offline — your call"; reporter still submits with their own severity |

## Out of scope

- Per-call audit logs in a dedicated table — `ai_raw_response._meta` carries
  the audit trail per report instead. A dedicated table can be added later if
  cost or debugging needs justify it.
- Retraining or fine-tuning. We use foundation models off-the-shelf with
  prompt-only steering, per the cost-effectiveness and 48-hour deployability
  judging criteria.
