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
