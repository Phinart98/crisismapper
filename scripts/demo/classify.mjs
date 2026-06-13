// Model-authored demo damage classifications. The LIVE reporter path classifies
// real photos with Groq/Gemini vision; this generator dresses the SYNTHETIC demo
// seed so we never burn the (daily-capped) vision quota on fake reports. The text
// here is hand-authored to read like a damage-assessment model's output, varied
// per hazard x infrastructure x severity. _meta.provider is 'demo' — honest in the
// audit trail, invisible in the UI (no surface shows the provider string).

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]
const between = (lo, hi) => lo + Math.random() * (hi - lo)
const round = (n) => Math.round(n)

// crisis_type (DB) → photo/reasoning bucket.
export function bucketForHazard(crisisType) {
  if (crisisType === 'flood') return 'flood'
  if (crisisType === 'cyclone' || crisisType === 'hurricane') return 'wind'
  return 'earthquake' // earthquake / conflict / other → generic structural
}

// DbSeverity → 3-tier band used to select the reasoning bank.
const BAND = { negligible: 'minimal', moderate: 'partial', severe: 'complete', destroyed: 'complete' }

const NOUN = {
  building: 'building', road: 'roadway', bridge: 'bridge', school: 'school building',
  hospital: 'health facility', utility: 'utility installation', other: 'structure',
}

const DAMAGE_PCT = { negligible: [5, 18], moderate: [28, 52], severe: [58, 78], destroyed: [84, 97] }
const CONFIDENCE = { negligible: [0.78, 0.92], moderate: [0.70, 0.86], severe: [0.80, 0.93], destroyed: [0.88, 0.97] }

const REASONING = {
  earthquake: {
    minimal: [
      'Hairline and surface cracking visible on the {n}, but primary load-bearing elements appear intact and plumb. No displacement of columns or beams.',
      'Minor render and plaster damage to the {n}; the structural frame shows no signs of distress or settlement.',
      'Superficial cracking around openings of the {n}. Integrity appears preserved; monitoring recommended after aftershocks.',
    ],
    partial: [
      'Pronounced diagonal shear cracking across the masonry of the {n}, with localized spalling exposing reinforcement. The structure should be treated as unsafe to occupy pending engineering assessment.',
      'Significant cracking and partial separation of wall sections on the {n}; out-of-plane movement is visible at one corner.',
      'The {n} shows substantial structural cracking and a leaning section. Occupants have evacuated; re-entry is not advised.',
    ],
    complete: [
      'The {n} has suffered partial-to-total collapse, with at least one floor or wall fully failed and a debris field extending into the street.',
      'Catastrophic failure of the {n} — pancaked floors and collapsed masonry. No safe access to the interior.',
      'The {n} is reduced largely to rubble; only fragments of the perimeter walls remain standing.',
    ],
  },
  flood: {
    minimal: [
      'Floodwater has reached the base of the {n}; a shallow inundation line and silt staining are visible. No structural movement observed.',
      'Standing water surrounds the {n} at a low level. The structure appears sound; contents at ground level are at risk.',
      'Minor flooding around the {n}, water below floor level. No scouring of foundations evident.',
    ],
    partial: [
      'Floodwater has risen above the ground level of the {n}, with visible scouring, debris accumulation, and a high silt line. Contents and finishes are likely a write-off.',
      'The {n} is partly inundated; the current has deposited debris against the structure and undercut the approach.',
      'Significant flood damage to the {n} — water well above floor level and erosion around the base.',
    ],
    complete: [
      'The {n} is substantially submerged or has been undermined by the current; the foundation appears scoured and structural integrity is compromised.',
      'The {n} has been overtopped and partially washed away, with severe erosion of supporting ground.',
      'Floodwaters have destroyed the {n} — sections collapsed or carried off by the flow.',
    ],
  },
  wind: {
    minimal: [
      'Cladding and roofing of the {n} show minor wind damage — a few displaced panels — but the frame is sound and the envelope largely intact.',
      'Superficial wind damage to the {n}: lost roof tiles and debris impact marks. Structure undamaged.',
      'Light storm damage to the {n}, limited to roofing edges and external fittings.',
    ],
    partial: [
      'The {n} has lost a substantial area of roofing and sustained envelope breaches; the interior is exposed to weather and water ingress is likely.',
      'Wind has stripped roofing and damaged the upper walls of the {n}; partial structural exposure is visible.',
      'The {n} shows major storm damage — roof partly gone, windows blown in, debris through the envelope.',
    ],
    complete: [
      'The {n} is largely destroyed — roof removed and walls failed, leaving only the frame or a debris pile.',
      'Catastrophic wind/surge damage: the {n} has been flattened, with structural members scattered across the site.',
      'The {n} is a total loss; storm forces have collapsed the structure entirely.',
    ],
  },
}

const INDICATORS = {
  earthquake: {
    minimal: ['surface cracking', 'plaster damage', 'intact frame'],
    partial: ['diagonal shear cracks', 'exposed reinforcement', 'out-of-plane movement', 'wall separation'],
    complete: ['collapsed floor', 'pancaked structure', 'masonry rubble', 'exposed rebar'],
  },
  flood: {
    minimal: ['shallow inundation', 'silt staining', 'standing water'],
    partial: ['high water line', 'debris accumulation', 'foundation scour', 'submerged ground floor'],
    complete: ['structural undermining', 'washed-out section', 'severe erosion', 'collapse'],
  },
  wind: {
    minimal: ['displaced roofing', 'debris impact', 'intact frame'],
    partial: ['roof loss', 'envelope breach', 'blown-in windows', 'exposed interior'],
    complete: ['roof removed', 'wall failure', 'scattered debris', 'total collapse'],
  },
}

const RECOMMENDATION = {
  minimal: ['Document and monitor; no immediate structural intervention indicated.', 'Flag for routine follow-up assessment.'],
  partial: ['Restrict access and prioritize an engineering inspection.', 'Cordon the area; structure unsafe pending assessment.'],
  complete: ['Treat as a search-and-rescue / debris-clearance priority; no safe entry.', 'Immediate cordon; coordinate heavy-rescue resources.'],
}

// Generate a ClassifyResult whose ai_severity matches the report's stored DbSeverity.
export function generate(bucket, infra, dbSeverity) {
  const band = BAND[dbSeverity] ?? 'partial'
  const n = NOUN[infra] ?? 'structure'
  const [plo, phi] = DAMAGE_PCT[dbSeverity] ?? [30, 50]
  const [clo, chi] = CONFIDENCE[dbSeverity] ?? [0.7, 0.85]
  const inds = INDICATORS[bucket][band]
  const indicators = [...inds].sort(() => Math.random() - 0.5).slice(0, 2 + Math.floor(Math.random() * 2))
  return {
    severity: dbSeverity,
    confidence: +between(clo, chi).toFixed(2),
    damage_percentage: round(between(plo, phi)),
    reasoning: pick(REASONING[bucket][band]).replaceAll('{n}', n),
    damage_indicators: indicators,
    infrastructure_visible: true,
    photo_quality: Math.random() < 0.8 ? 'good' : 'acceptable',
    recommendation: pick(RECOMMENDATION[band]),
    _meta: { provider: 'demo', model: 'demo-generated', duration_ms: round(between(180, 520)), fallback_used: false },
  }
}
