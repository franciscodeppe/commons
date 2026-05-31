// ============================================================
// Provisional sort → axis derivation (MVP placeholder).
// Matching itself is Phase 2; this just turns the five sorts into
// the six axis values stored on the profile. The real, tuned scorer
// replaces this once we validate against synthetic data.
// ============================================================

// Each axis pulls from specific sort items. Entry: [sortKey, itemIndex, weight].
// A positive weight pushes the axis toward +1. Item scores are 0,1,2 (1 = neutral).
const AXIS_SOURCES = {
  energy: [['sort_taste', 2, +1], ['sort_social', 1, +1], ['sort_taste', 0, -1], ['sort_social', 4, -1]],
  drinking: [['sort_taste', 2, +1], ['sort_taste', 1, +0.4], ['sort_taste', 0, -1]],
  size: [['sort_social', 1, +1], ['sort_social', 2, -1], ['sort_social', 0, -1]],
  // +1 = drop-in, -1 = regulars
  commitment: [['sort_rhythm', 1, +1], ['sort_rhythm', 3, +1], ['sort_rhythm', 0, -1]],
  // -1 = outdoors, +1 = venue
  setting: [['sort_taste', 4, -1], ['sort_taste', 1, +1]],
}

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n))
}

function round2(n) {
  return Math.round(n * 100) / 100
}

// sorts: { sort_taste: {"0":2,...}, ... }
export function deriveAxes(sorts) {
  const axis = {}
  for (const [name, sources] of Object.entries(AXIS_SOURCES)) {
    let total = 0
    let weightSum = 0
    for (const [sortKey, idx, weight] of sources) {
      const score = Number(sorts?.[sortKey]?.[idx] ?? 1) // default neutral
      total += weight * (score - 1) // -1..+1 per item
      weightSum += Math.abs(weight)
    }
    axis[name] = weightSum ? round2(clamp(total / weightSum, -1, 1)) : 0
  }

  // worldview is categorical, read from the politics sort
  const pol = sorts?.sort_politics ?? {}
  const aligned = Number(pol[0] ?? 0) // "I want shared values"
  const aside = Number(pol[2] ?? 0) // "Leave politics at the door"
  let worldview = 'mixed'
  if (aligned >= 2 && aligned > aside) worldview = 'aligned'
  else if (aside >= 2 && aside > aligned) worldview = 'aside'

  return {
    axis_energy: axis.energy,
    axis_drinking: axis.drinking,
    axis_size: axis.size,
    axis_commitment: axis.commitment,
    axis_setting: axis.setting,
    axis_worldview: worldview,
  }
}

// ============================================================
// MATCH SCORING (Phase 2)
// Maps a group's categorical character onto the same -1..+1 axis
// space as the user's profile, then scores closeness per axis.
// Dislikes weigh ~2.2x more than likes. A dealbreaker that collides
// with the group's actual declared character hard-gates the score.
// ============================================================

const DISLIKE_WEIGHT = 2.2
const BASE_SCORE = 70
const GATE_MULTIPLIER = 0.2
// Sharpens the spread: higher = great matches climb, mediocre ones fall.
const WEIGHT_SCALE = 1.8

// Per-axis: profile field, group field, like-weight, and how each
// categorical group value maps onto -1..+1.
const AXES = [
  { key: 'energy', profile: 'axis_energy', group: 'char_energy', weight: 10, map: { low: -1, balanced: 0, high: 1 } },
  { key: 'drinking', profile: 'axis_drinking', group: 'char_drinking', weight: 9, map: { sober: -1, social: 0, heavy: 1 } },
  { key: 'size', profile: 'axis_size', group: 'char_size', weight: 8, map: { small: -1, large: 1 } },
  { key: 'commitment', profile: 'axis_commitment', group: 'char_commitment', weight: 6, map: { regulars: -1, dropin: 1 } },
  { key: 'setting', profile: 'axis_setting', group: 'char_setting', weight: 7, map: { outdoors: -1, indoors: 0, venue: 1 } },
]

const WORLDVIEW_WEIGHT = 8

// dealbreaker token `${axis}:${value}` collides when the group's char
// on that axis equals `value`.
const DEALBREAKER_FIELD = {
  drinking: 'char_drinking',
  size: 'char_size',
  energy: 'char_energy',
  commitment: 'char_commitment',
  setting: 'char_setting',
  worldview: 'char_worldview',
}

export const TIERS = [
  { key: 'strong', label: 'Strong fit', min: 90 },
  { key: 'good', label: 'Good fit', min: 68 },
  { key: 'loose', label: 'Also nearby', min: 50 },
  { key: 'poor', label: 'Poor fit', min: 0 },
]

export function tierFor(score) {
  return TIERS.find((t) => score >= t.min) ?? TIERS[TIERS.length - 1]
}

function worldviewPoints(userView, groupView) {
  if (!userView || !groupView) return 0
  if (userView === groupView) return WORLDVIEW_WEIGHT
  // 'mixed' is broadly compatible
  if (userView === 'mixed' || groupView === 'mixed') return WORLDVIEW_WEIGHT * 0.3
  // aligned vs aside = direct clash
  return -WORLDVIEW_WEIGHT * DISLIKE_WEIGHT
}

function isGated(profile, group) {
  const dbs = profile?.dealbreakers ?? []
  for (const token of dbs) {
    const [axis, value] = token.split(':')
    const field = DEALBREAKER_FIELD[axis]
    if (field && group[field] === value) return true
  }
  return false
}

// Returns { score, soft, gated, tier, breakdown }
export function scoreGroup(profile, group) {
  let soft = BASE_SCORE
  const breakdown = []

  for (const axis of AXES) {
    const u = profile?.[axis.profile]
    const g = group[axis.group]
    if (u === null || u === undefined || g === null || g === undefined) continue
    const gv = axis.map[g]
    if (gv === undefined) continue

    const sim = 1 - Math.abs(Number(u) - gv) / 2 // 0..1
    let pts = axis.weight * WEIGHT_SCALE * (2 * sim - 1) // -w..+w
    if (pts < 0) pts *= DISLIKE_WEIGHT
    soft += pts
    breakdown.push({ axis: axis.key, points: round2(pts) })
  }

  const wv = worldviewPoints(profile?.axis_worldview, group.char_worldview) * WEIGHT_SCALE
  if (wv !== 0) {
    soft += wv
    breakdown.push({ axis: 'worldview', points: round2(wv) })
  }

  const gated = isGated(profile, group)
  let score = gated ? soft * GATE_MULTIPLIER : soft
  score = Math.max(0, Math.min(100, Math.round(score)))

  return { score, soft: round2(soft), gated, tier: tierFor(score), breakdown }
}

// Score and rank a list of groups for a user, best-first.
export function rankGroups(profile, groups) {
  return groups
    .map((g) => ({ group: g, ...scoreGroup(profile, g) }))
    .sort((a, b) => b.score - a.score)
}
