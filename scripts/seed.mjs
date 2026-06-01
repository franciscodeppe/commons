// ============================================================
// Commons — dev data seeder
// Bulk-creates users, profiles, groups, members, events, and
// attendance in a Supabase project using the service_role key.
//
// Usage (Node 20.6+):
//   node --env-file=.env.seed.local scripts/seed.mjs
// or via the npm script:
//   npm run seed
//
// Required env (in .env.seed.local):
//   SUPABASE_URL=https://YOUR_DEV_PROJECT.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY=eyJ...            (Settings → API → service_role)
// Optional:
//   SEED_USERS=200  SEED_GROUPS=40  SEED_PASSWORD=commons-dev  SEED_RESET=1
//
// ⚠️  NEVER point this at your production project.
// ============================================================

import { createClient } from '@supabase/supabase-js'
import { CATEGORIES, PREDEFINED_TAGS, DEALBREAKERS } from '../src/utils/constants.js'

const URL = process.env.SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL || !KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.\nRun: node --env-file=.env.seed.local scripts/seed.mjs')
  process.exit(1)
}
if (/localhost/.test(URL)) { console.error('Refusing to seed localhost.'); process.exit(1) }

const N_USERS = Number(process.env.SEED_USERS ?? 200)
const N_GROUPS = Number(process.env.SEED_GROUPS ?? 40)
const PASSWORD = process.env.SEED_PASSWORD ?? 'commons-dev'
const RESET = process.env.SEED_RESET === '1'
const DOMAIN = 'seed.commons.dev'

const db = createClient(URL, KEY, { auth: { autoRefreshToken: false, persistSession: false } })

// ---- helpers ----
const rand = (arr) => arr[Math.floor(Math.random() * arr.length)]
const randInt = (lo, hi) => lo + Math.floor(Math.random() * (hi - lo + 1))
const uniform = () => Math.round((Math.random() * 2 - 1) * 100) / 100
const sample = (arr, k) => [...arr].sort(() => Math.random() - 0.5).slice(0, Math.min(k, arr.length))
const chance = (p) => Math.random() < p

async function pool(items, size, fn) {
  const out = []
  for (let i = 0; i < items.length; i += size) {
    out.push(...(await Promise.all(items.slice(i, i + size).map(fn))))
  }
  return out
}

const FIRST = ['Ava', 'Ben', 'Cara', 'Dan', 'Eli', 'Fia', 'Gus', 'Hana', 'Ivo', 'Jo', 'Kai', 'Lena', 'Max', 'Nia', 'Omar', 'Pia', 'Quinn', 'Rae', 'Sam', 'Tess', 'Uma', 'Vik', 'Wren', 'Xan', 'Yas', 'Zoe']
const LAST = ['Reed', 'Park', 'Lowe', 'Vance', 'Nash', 'Cole', 'Diaz', 'Frey', 'Goh', 'Hsu', 'Ito', 'Jain', 'Kerr', 'Luna', 'Moss', 'Ng', 'Ott', 'Pace', 'Roy', 'Stone']
const AREAS = ['Pasadena', 'South Pasadena', 'Alhambra', 'San Gabriel', 'Arcadia', 'Monrovia', 'Sierra Madre', 'Eagle Rock', 'Highland Park', 'Altadena']
const WORLDVIEWS = ['aligned', 'mixed', 'aside']
const CHAR = {
  char_energy: ['low', 'balanced', 'high'],
  char_drinking: ['sober', 'social', 'heavy'],
  char_size: ['small', 'large'],
  char_commitment: ['regulars', 'dropin'],
  char_setting: ['outdoors', 'indoors', 'venue'],
  char_worldview: ['aligned', 'mixed', 'aside'],
}
const CAT_KEYS = CATEGORIES.map((c) => c.key)
const DB_TOKENS = DEALBREAKERS.map((d) => d.token)

function dealbreakers() {
  const r = Math.random()
  const k = r < 0.4 ? 0 : r < 0.75 ? 1 : r < 0.93 ? 2 : 3
  return sample(DB_TOKENS, k)
}

async function reset() {
  console.log('Reset: removing previously seeded users…')
  let removed = 0
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    if (!data.users.length) break
    const ours = data.users.filter((u) => u.email?.endsWith('@' + DOMAIN))
    await pool(ours, 10, (u) => db.auth.admin.deleteUser(u.id))
    removed += ours.length
    if (data.users.length < 200) break
  }
  console.log(`  removed ${removed} seeded users (cascades to their data).`)
}

async function main() {
  console.log(`Seeding ${URL}\n  ${N_USERS} users, ${N_GROUPS} groups\n`)
  if (RESET) await reset()

  // 1. Users (auth.users → trigger creates profile rows)
  console.log('Creating users…')
  const users = await pool(
    Array.from({ length: N_USERS }, (_, i) => i),
    12,
    async (i) => {
      const name = `${rand(FIRST)} ${rand(LAST)} ${i}`
      const username = `user${i}`
      const { data, error } = await db.auth.admin.createUser({
        email: `user${i}@${DOMAIN}`,
        password: PASSWORD,
        email_confirm: true,
        user_metadata: { display_name: name, username },
      })
      if (error) { console.error(`  user${i}: ${error.message}`); return null }
      return { id: data.user.id, name, username }
    },
  )
  const valid = users.filter(Boolean)
  console.log(`  created ${valid.length} users (password: "${PASSWORD}")`)

  // 2. Profiles (upsert axes onto the trigger-created rows)
  console.log('Writing profiles…')
  const profiles = valid.map((u) => ({
    user_id: u.id,
    display_name: u.name,
    username: u.username,
    axis_energy: uniform(), axis_drinking: uniform(), axis_size: uniform(),
    axis_commitment: uniform(), axis_setting: uniform(),
    axis_worldview: rand(WORLDVIEWS),
    dealbreakers: dealbreakers(),
    onboarded: true,
  }))
  for (let i = 0; i < profiles.length; i += 500) {
    const { error } = await db.from('profiles').upsert(profiles.slice(i, i + 500), { onConflict: 'user_id' })
    if (error) throw error
  }
  console.log(`  wrote ${profiles.length} profiles`)

  // 3. Groups
  console.log('Creating groups…')
  const groupRows = Array.from({ length: N_GROUPS }, () => {
    const primary = rand(CAT_KEYS)
    const secondary = chance(0.4) ? rand(CAT_KEYS.filter((c) => c !== primary)) : null
    return {
      organizer_id: rand(valid).id,
      name: `${rand(['Sunrise', 'Eastside', 'Foothill', 'Riverbend', 'Old Town', 'Maple', 'Civic', 'Canyon', 'Lantern', 'Granite'])} ${rand(['Walkers', 'Circle', 'Club', 'Collective', 'Crew', 'Society', 'Guild', 'League'])}`,
      description: 'A seeded group for testing.',
      primary_category: primary,
      secondary_category: secondary,
      area_name: rand(AREAS),
      char_energy: rand(CHAR.char_energy), char_drinking: rand(CHAR.char_drinking),
      char_size: rand(CHAR.char_size), char_commitment: rand(CHAR.char_commitment),
      char_setting: rand(CHAR.char_setting), char_worldview: rand(CHAR.char_worldview),
      not_for_tags: sample(DB_TOKENS, randInt(0, 2)),
    }
  })
  const { data: groups, error: gErr } = await db.from('groups').insert(groupRows).select('id, primary_category, organizer_id')
  if (gErr) throw gErr
  console.log(`  created ${groups.length} groups`)

  // 4. Tags
  const tagRows = groups.flatMap((g) =>
    sample(PREDEFINED_TAGS[g.primary_category], randInt(1, 3)).map((tag) => ({ group_id: g.id, tag, type: 'predefined' })),
  )
  if (tagRows.length) { const { error } = await db.from('group_tags').insert(tagRows); if (error) throw error }
  console.log(`  added ${tagRows.length} tags`)

  // 5. Members (random members + a few pending), trigger maintains member_count
  console.log('Adding members…')
  const memberRows = []
  for (const g of groups) {
    const pickable = valid.filter((u) => u.id !== g.organizer_id)
    const members = sample(pickable, randInt(3, 15))
    members.forEach((m) => memberRows.push({ group_id: g.id, user_id: m.id, status: 'member' }))
    sample(pickable.filter((u) => !members.includes(u)), randInt(0, 3))
      .forEach((m) => memberRows.push({ group_id: g.id, user_id: m.id, status: 'pending' }))
  }
  for (let i = 0; i < memberRows.length; i += 500) {
    const { error } = await db.from('group_members').upsert(memberRows.slice(i, i + 500), { onConflict: 'group_id,user_id' })
    if (error) throw error
  }
  console.log(`  added ${memberRows.length} memberships`)

  // 6. Events + attendance (some attended → drives character drift)
  console.log('Creating events + attendance…')
  const today = new Date()
  const eventRows = groups.flatMap((g) =>
    Array.from({ length: randInt(1, 2) }, () => {
      const d = new Date(today); d.setDate(d.getDate() + randInt(-20, 20))
      return {
        group_id: g.id,
        title: rand(['Saturday Meetup', 'Evening Session', 'Morning Hangout', 'Monthly Gathering']),
        description: 'Seeded event.',
        event_date: d.toISOString().slice(0, 10),
        event_time: `${String(randInt(8, 19)).padStart(2, '0')}:00`,
        location: g.area_name ?? 'TBD',
        capacity: randInt(8, 30),
      }
    }),
  )
  const { data: events, error: eErr } = await db.from('events').insert(eventRows).select('id, group_id')
  if (eErr) throw eErr

  const membersByGroup = new Map()
  memberRows.filter((m) => m.status === 'member').forEach((m) => {
    if (!membersByGroup.has(m.group_id)) membersByGroup.set(m.group_id, [])
    membersByGroup.get(m.group_id).push(m.user_id)
  })
  const attRows = []
  for (const e of events) {
    const gm = membersByGroup.get(e.group_id) ?? []
    sample(gm, Math.ceil(gm.length * 0.6)).forEach((uid) => {
      attRows.push({ event_id: e.id, user_id: uid, status: chance(0.7) ? 'attended' : 'rsvp_yes' })
    })
  }
  for (let i = 0; i < attRows.length; i += 500) {
    const { error } = await db.from('event_attendance').upsert(attRows.slice(i, i + 500), { onConflict: 'event_id,user_id' })
    if (error) throw error
  }
  console.log(`  created ${events.length} events, ${attRows.length} attendance rows`)

  console.log('\nDone. Log in as any seeded user:')
  console.log(`  email:    user0@${DOMAIN}  (through user${N_USERS - 1}@${DOMAIN})`)
  console.log(`  password: ${PASSWORD}`)
}

main().catch((e) => { console.error('\nSeed failed:', e.message ?? e); process.exit(1) })
