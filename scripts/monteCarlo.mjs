// Monte-Carlo validation of the matching scorer.
// Run: node scripts/monteCarlo.mjs
// Generates synthetic users + groups, scores all pairs, reports the
// distribution against the spec's expectations.

import { scoreGroup, tierFor } from '../src/utils/matchingLogic.js'

const N_USERS = 500
const N_GROUPS = 80

const rand = (arr) => arr[Math.floor(Math.random() * arr.length)]
const uniform = () => Math.round((Math.random() * 2 - 1) * 100) / 100

const WORLDVIEWS = ['aligned', 'mixed', 'aside']
const DEALBREAKER_TOKENS = [
  'drinking:heavy', 'size:large', 'energy:high', 'commitment:regulars', 'setting:venue', 'worldview:aligned',
]

const GROUP_OPTS = {
  char_energy: ['low', 'balanced', 'high'],
  char_drinking: ['sober', 'social', 'heavy'],
  char_size: ['small', 'large'],
  char_commitment: ['regulars', 'dropin'],
  char_setting: ['outdoors', 'indoors', 'venue'],
  char_worldview: ['aligned', 'mixed', 'aside'],
}

// Realistic dealbreaker counts: most people have few hard no's.
function dealbreakerCount() {
  const r = Math.random()
  if (r < 0.4) return 0
  if (r < 0.75) return 1
  if (r < 0.93) return 2
  return 3
}

function makeUser() {
  const k = dealbreakerCount()
  const dbs = [...DEALBREAKER_TOKENS].sort(() => Math.random() - 0.5).slice(0, k)
  return {
    axis_energy: uniform(),
    axis_drinking: uniform(),
    axis_size: uniform(),
    axis_commitment: uniform(),
    axis_setting: uniform(),
    axis_worldview: rand(WORLDVIEWS),
    dealbreakers: dbs,
  }
}

function makeGroup(id) {
  const g = { id }
  for (const [field, opts] of Object.entries(GROUP_OPTS)) g[field] = rand(opts)
  return g
}

const users = Array.from({ length: N_USERS }, makeUser)
const groups = Array.from({ length: N_GROUPS }, (_, i) => makeGroup(i + 1))

const tierCounts = { strong: 0, good: 0, loose: 0, poor: 0 }
let gatedPairs = 0
let usersWithGood = 0
let usersWithStrong = 0
const scoreHistogram = []

for (const u of users) {
  let best = -1
  for (const g of groups) {
    const { score, gated, tier } = scoreGroup(u, g)
    tierCounts[tier.key]++
    if (gated) gatedPairs++
    if (score > best) best = score
    scoreHistogram.push(score)
  }
  const bestTier = tierFor(best).key
  if (bestTier === 'good' || bestTier === 'strong') usersWithGood++
  if (bestTier === 'strong') usersWithStrong++
}

const totalPairs = N_USERS * N_GROUPS
const pct = (n, d) => ((n / d) * 100).toFixed(1) + '%'
const mean = (scoreHistogram.reduce((a, b) => a + b, 0) / scoreHistogram.length).toFixed(1)

console.log(`\n=== Monte-Carlo: ${N_USERS} users x ${N_GROUPS} groups = ${totalPairs} pairs ===\n`)
console.log('Tier distribution (all pairs):')
for (const k of ['strong', 'good', 'loose', 'poor']) {
  console.log(`  ${k.padEnd(7)} ${pct(tierCounts[k], totalPairs).padStart(6)}  (${tierCounts[k]})`)
}
console.log(`\n  gated pairs:   ${pct(gatedPairs, totalPairs)}`)
console.log(`  mean score:    ${mean}`)
console.log('\nPer-user catalog coverage:')
console.log(`  >=1 good-or-better:  ${pct(usersWithGood, N_USERS)}   (spec target ~100%)`)
console.log(`  >=1 strong option:   ${pct(usersWithStrong, N_USERS)}   (spec target ~99%+)`)
console.log(`\n  poor share:          ${pct(tierCounts.poor, totalPairs)}   (spec target ~58%)\n`)

// Eyeball a few strong-fit pairs
console.log('Sample strong-fit pairs:')
let shown = 0
for (const u of users) {
  for (const g of groups) {
    const r = scoreGroup(u, g)
    if (r.tier.key === 'strong' && shown < 3) {
      console.log(`  score ${r.score} | user{e:${u.axis_energy} d:${u.axis_drinking} sz:${u.axis_size} wv:${u.axis_worldview} db:[${u.dealbreakers}]}`)
      console.log(`              group{${g.char_energy}/${g.char_drinking}/${g.char_size}/${g.char_commitment}/${g.char_setting}/${g.char_worldview}}`)
      shown++
    }
  }
  if (shown >= 3) break
}
console.log('')
