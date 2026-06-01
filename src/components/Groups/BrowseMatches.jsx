import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../utils/supabaseClient'
import { useAuth } from '../../hooks/useAuth'
import { useProfile } from '../../hooks/useProfile'
import { rankGroups } from '../../utils/matchingLogic'
import { CATEGORIES } from '../../utils/constants'
import Spinner from '../Shared/Spinner'
import CategoryTiles from './CategoryTiles'

const CAT_LABEL = Object.fromEntries(CATEGORIES.map((c) => [c.key, c.label]))

const TIER_STYLE = {
  strong: 'bg-forest text-cream',
  good: 'bg-gold/30 text-forest',
  loose: 'bg-forest/10 text-forest/80',
  poor: 'bg-forest/5 text-forest/40',
}

export default function BrowseMatches() {
  const { user } = useAuth()
  const { profile, loading: profileLoading } = useProfile()
  const [groups, setGroups] = useState(null)
  const [filter, setFilter] = useState('')

  useEffect(() => {
    ;(async () => {
      const { data } = await supabase.from('groups').select('*').order('created_at', { ascending: false })
      setGroups(data ?? [])
    })()
  }, [])

  if (groups === null || profileLoading) return <Spinner />

  const owned = groups.filter((g) => g.organizer_id === user.id)
  const others = groups.filter((g) => g.organizer_id !== user.id)

  const onboarded = !!profile?.onboarded
  // Rank only groups you don't run; yours don't get a match score.
  const ranked = onboarded
    ? rankGroups(profile, others)
    : others.map((g) => ({ group: g, score: null, tier: null }))

  const shown = filter ? ranked.filter((r) => r.group.primary_category === filter) : ranked

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      {!onboarded && (
        <div className="mb-6 rounded-lg border border-gold/40 bg-gold/10 px-4 py-3 text-sm text-forest">
          Finish your profile to see how well each group fits you.{' '}
          <Link to="/onboarding" className="font-semibold underline">Set it up</Link>.
        </div>
      )}

      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-forest">Commons</h1>
        <Link to="/groups/new" className="rounded-lg bg-forest px-4 py-2 text-sm font-medium text-cream">Start a group</Link>
      </div>

      {owned.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-forest/60">Your groups</h2>
          <ul className="grid gap-4 sm:grid-cols-2">
            {owned.map((g) => (
              <GroupCard key={g.id} g={g} owned />
            ))}
          </ul>
        </section>
      )}

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-forest/60">
            {onboarded ? 'Your matches' : 'Groups near you'}
          </h2>
        </div>

        <div className="mb-6">
          <CategoryTiles active={filter} onSelect={setFilter} />
        </div>

        {shown.length === 0 ? (
          <p className="text-forest/60">
            {others.length === 0 ? 'No other groups yet.' : 'No groups in this category.'}
          </p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {shown.map(({ group: g, score, tier }) => (
              <GroupCard key={g.id} g={g} score={score} tier={tier} />
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function GroupCard({ g, score, tier, owned }) {
  return (
    <li>
      <Link to={`/groups/${g.id}`} className="block h-full rounded-xl border border-forest/15 bg-white p-5 hover:border-forest/40">
        <div className="mb-2 flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-forest/10 px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-forest">{CAT_LABEL[g.primary_category]}</span>
            {g.area_name && <span className="text-xs text-forest/50">{g.area_name}</span>}
          </div>
          {owned ? (
            <span className="shrink-0 rounded-full bg-gold/20 px-2.5 py-0.5 text-xs font-semibold text-forest">Organizer</span>
          ) : tier ? (
            <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${TIER_STYLE[tier.key]}`}>
              {tier.label}{tier.key !== 'poor' ? ` · ${score}` : ''}
            </span>
          ) : null}
        </div>
        <h2 className="text-lg font-semibold text-forest">{g.name}</h2>
        {g.description && <p className="mt-1 line-clamp-2 text-sm text-forest/70">{g.description}</p>}
        <p className="mt-3 text-xs text-forest/50">{g.member_count} member{g.member_count === 1 ? '' : 's'}</p>
      </Link>
    </li>
  )
}

