export const DEFAULT_CARD_LAYOUT = 'wave-particle'
export const FALLBACK_CARD_LAYOUT = 'classic'

export const cardLayoutIds = [
  'classic',
  'wave-particle',
  'quantum-spin',
  'cyber',
  'archive',
  'android',
  'berserk',
  'tanzaku',
  'exsicata',
  'dunas',
]

export function resolveCardLayout(layout) {
  if (!layout) return DEFAULT_CARD_LAYOUT
  return cardLayoutIds.includes(layout) ? layout : FALLBACK_CARD_LAYOUT
}
