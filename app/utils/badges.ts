// The 7 gamification badges, in display order (matches the me.html grid). The award
// LOGIC lives in the DB (evaluate_reporter_badges); this is purely the front-end's
// presentation metadata. Names/descriptions/how-to-earn copy go through i18n so the
// keys here are the single source mapping a badge code → its strings.
export interface BadgeMeta {
  code: string
  emoji: string
  name: string  // i18n key
  desc: string  // i18n key
  how: string   // i18n key — shown on locked badges
}

export const BADGES: BadgeMeta[] = [
  { code: 'first_responder', emoji: '🚨', name: 'badgeFirstResponderName', desc: 'badgeFirstResponderDesc', how: 'badgeFirstResponderHow' },
  { code: 'pioneer',         emoji: '🏴', name: 'badgePioneerName',        desc: 'badgePioneerDesc',        how: 'badgePioneerHow' },
  { code: 'verified',        emoji: '✓',  name: 'badgeVerifiedName',       desc: 'badgeVerifiedDesc',       how: 'badgeVerifiedHow' },
  { code: 'coverage_hero',   emoji: '🗺', name: 'badgeCoverageHeroName',   desc: 'badgeCoverageHeroDesc',   how: 'badgeCoverageHeroHow' },
  { code: 'streak',          emoji: '🔥', name: 'badgeStreakName',         desc: 'badgeStreakDesc',         how: 'badgeStreakHow' },
  { code: 'detail_expert',   emoji: '🔬', name: 'badgeDetailExpertName',   desc: 'badgeDetailExpertDesc',   how: 'badgeDetailExpertHow' },
  { code: 'community_voice', emoji: '🤝', name: 'badgeCommunityVoiceName', desc: 'badgeCommunityVoiceDesc', how: 'badgeCommunityVoiceHow' },
]

export const BADGE_COUNT = BADGES.length
