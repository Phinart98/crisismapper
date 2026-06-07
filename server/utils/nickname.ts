// Deterministic, privacy-safe display name for a pseudonymous reporter.
//
// A reporter is only ever a random UUID + a one-way device hash — no name is stored.
// For /me and the leaderboard we still want a stable, human-friendly handle, so we DERIVE
// one from the UUID: same id → same `anon_<adjective>_<animal>` every time, with no way to
// run it backwards to an identity. Mirrors the me.html/leaderboard mockups' auto-generated
// nicknames ("anon_swift_owl"). Two independent indices come from two different byte spans
// of the UUID hex so the adjective and animal vary independently.

const ADJECTIVES = [
  'swift', 'red', 'grey', 'brave', 'blue', 'calm', 'dusk', 'pale', 'iron', 'deep',
  'noon', 'field', 'river', 'ash', 'tide', 'bright', 'quiet', 'bold', 'amber', 'slate',
  'north', 'still', 'lone', 'keen', 'dawn', 'green', 'gold', 'storm', 'frost', 'clay',
  'rust', 'sage',
]

const ANIMALS = [
  'owl', 'crane', 'swift', 'ibis', 'finch', 'heron', 'eagle', 'kestrel', 'sparrow', 'cormorant',
  'plover', 'martin', 'tern', 'wagtail', 'snipe', 'falcon', 'lark', 'robin', 'raven', 'wren',
  'hawk', 'egret', 'osprey', 'merlin', 'curlew', 'dove', 'swallow', 'magpie', 'starling', 'shrike',
  'thrush', 'godwit',
]

// FNV-1a over a string slice → unsigned 32-bit. Cheap and stable across runtimes.
function hash32(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

export function nicknameForReporter(reporterId: string): string {
  const hex = reporterId.replace(/-/g, '')
  const adj = ADJECTIVES[hash32(hex.slice(0, 16)) % ADJECTIVES.length]
  const animal = ANIMALS[hash32(hex.slice(16)) % ANIMALS.length]
  return `anon_${adj}_${animal}`
}
