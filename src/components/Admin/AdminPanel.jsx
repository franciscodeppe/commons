import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../utils/supabaseClient'
import { scoreGroup, tierFor, TIERS } from '../../utils/matchingLogic'
import { CATEGORIES, DEALBREAKERS } from '../../utils/constants'
import { Stat, Bars, Section } from './Charts'
import Spinner from '../Shared/Spinner'

const CAT_LABEL = Object.fromEntries(CATEGORIES.map((c) => [c.key, c.label]))
const NUMERIC_AXES = [
  { key: 'axis_energy', label: 'Energy', lo: 'low-key', hi: 'high' },
  { key: 'axis_drinking', label: 'Drinking', lo: 'sober', hi: 'heavy' },
  { key: 'axis_size', label: 'Size', lo: 'small', hi: 'large' },
  { key: 'axis_commitment', label: 'Commitment', lo: 'regulars', hi: 'drop-in' },
  { key: 'axis_setting', label: 'Setting', lo: 'outdoors', hi: 'venue' },
]
const BINS = [
  { label: '−1.0…−0.6', min: -1.01, max: -0.6 },
  { label: '−0.6…−0.2', min: -0.6, max: -0.2 },
  { label: '−0.2…0.2', min: -0.2, max: 0.2 },
  { label: '0.2…0.6', min: 0.2, max: 0.6 },
  { label: '0.6…1.0', min: 0.6, max: 1.01 },
]

function histogram(values) {
  return BINS.map((b) => ({
    label: b.label,
    value: values.filter((v) => v >= b.min && v < b.max).length,
  }))
}

export default function AdminPanel() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    ;(async () => {
      const [profiles, groups, members] = await Promise.all([
        supabase.from('profiles').select('*'),
        supabase.from('groups').select('*'),
        supabase.from('group_members').select('*'),
      ])
      if (profiles.error) return setError(profiles.error.message)
      setData({
        profiles: profiles.data ?? [],
        groups: groups.data ?? [],
        members: members.data ?? [],
      })
    })()
  }, [])

  const stats = useMemo(() => {
    if (!data) return null
    const { profiles, groups, members } = data
    const onboarded = profiles.filter((p) => p.onboarded)

    // Dealbreaker frequency
    const dbCounts = DEALBREAKERS.map((d) => ({
      label: d.label,
      value: profiles.filter((p) => (p.dealbreakers ?? []).includes(d.token)).length,
    })).sort((a, b) => b.value - a.value)

    // Worldview split
    const worldview = ['aligned', 'mixed', 'aside'].map((w) => ({
      label: w,
      value: onboarded.filter((p) => p.axis_worldview === w).length,
    }))

    // Groups per category
    const perCategory = CATEGORIES.map((c) => ({
      label: c.label,
      value: groups.filter((g) => g.primary_category === c.key).length,
    }))

    // Top groups by members
    const topGroups = [...groups]
      .sort((a, b) => (b.member_count ?? 0) - (a.member_count ?? 0))
      .slice(0, 6)
      .map((g) => ({ label: g.name, value: g.member_count ?? 0 }))

    // Match/tier distribution over all (onboarded user × group) pairs
    const tierCounts = Object.fromEntries(TIERS.map((t) => [t.key, 0]))
    let usersWithStrong = 0
    let usersWithGood = 0
    for (const p of onboarded) {
      let best = -1
      for (const g of groups) {
        const { score, tier } = scoreGroup(p, g)
        tierCounts[tier.key]++
        if (score > best) best = score
      }
      if (groups.length) {
        const bt = tierFor(best).key
        if (bt === 'strong' || bt === 'good') usersWithGood++
        if (bt === 'strong') usersWithStrong++
      }
    }
    const tierBars = TIERS.map((t) => ({ label: t.label, value: tierCounts[t.key] }))

    return {
      totalUsers: profiles.length,
      onboardedCount: onboarded.length,
      admins: profiles.filter((p) => p.is_admin).length,
      totalGroups: groups.length,
      activeMembers: members.filter((m) => m.status === 'member').length,
      pending: members.filter((m) => m.status === 'pending').length,
      dbCounts,
      worldview,
      perCategory,
      topGroups,
      tierBars,
      usersWithGood,
      usersWithStrong,
      onboarded,
    }
  }, [data])

  if (error) return <div className="mx-auto max-w-2xl px-6 py-12 text-red-700">Error: {error}</div>
  if (!stats) return <Spinner />

  const pct = (n, d) => (d ? Math.round((n / d) * 100) + '%' : '—')

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="text-2xl font-semibold text-forest">Admin</h1>
      <p className="mb-8 text-forest/60">Population &amp; matching reports.</p>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Users" value={stats.totalUsers} />
        <Stat label="Onboarded" value={stats.onboardedCount} sub={`${pct(stats.onboardedCount, stats.totalUsers)} completion`} />
        <Stat label="Admins" value={stats.admins} />
        <Stat label="Groups" value={stats.totalGroups} />
        <Stat label="Active members" value={stats.activeMembers} />
        <Stat label="Pending requests" value={stats.pending} />
      </div>

      <Section title="Profile axis distributions">
        <div className="space-y-6">
          {NUMERIC_AXES.map((axis) => {
            const vals = stats.onboarded
              .map((p) => p[axis.key])
              .filter((v) => v !== null && v !== undefined)
              .map(Number)
            return (
              <div key={axis.key}>
                <p className="mb-2 text-sm font-medium text-forest">
                  {axis.label} <span className="font-normal text-forest/45">({axis.lo} → {axis.hi})</span>
                </p>
                <Bars data={histogram(vals)} accent="bg-forest" empty="No onboarded profiles yet." />
              </div>
            )
          })}
          <div>
            <p className="mb-2 text-sm font-medium text-forest">Worldview</p>
            <Bars data={stats.worldview} accent="bg-gold" />
          </div>
        </div>
      </Section>

      <Section title="Dealbreaker frequency">
        <Bars data={stats.dbCounts} accent="bg-gold" />
      </Section>

      <Section title="Groups & membership">
        <p className="mb-2 text-sm font-medium text-forest">By category</p>
        <Bars data={stats.perCategory} accent="bg-forest" />
        <p className="mb-2 mt-6 text-sm font-medium text-forest">Largest groups</p>
        <Bars data={stats.topGroups} accent="bg-forest" empty="No groups yet." />
      </Section>

      <Section title="Match / tier distribution">
        <p className="mb-3 text-sm text-forest/60">
          Across all onboarded-user × group pairs. Of {stats.onboardedCount} onboarded users:{' '}
          <span className="font-medium text-forest">{pct(stats.usersWithGood, stats.onboardedCount)}</span> have a good-or-better option,{' '}
          <span className="font-medium text-forest">{pct(stats.usersWithStrong, stats.onboardedCount)}</span> have a strong one.
        </p>
        <Bars data={stats.tierBars} accent="bg-forest" empty="Need onboarded users and groups." />
      </Section>
    </div>
  )
}
