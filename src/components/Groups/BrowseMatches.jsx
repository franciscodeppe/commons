import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../utils/supabaseClient'
import { useAuth } from '../../hooks/useAuth'
import { useProfile } from '../../hooks/useProfile'
import { rankGroups, scoreGroup } from '../../utils/matchingLogic'
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
  const [tagsByGroup, setTagsByGroup] = useState({})
  const [eventsByGroup, setEventsByGroup] = useState({})
  const [memberIds, setMemberIds] = useState(new Set())
  const [tab, setTab] = useState('search')
  const [filter, setFilter] = useState('')
  const [query, setQuery] = useState('')

  useEffect(() => {
    ;(async () => {
      const [{ data: gs }, { data: tags }, { data: evs }, { data: mem }] = await Promise.all([
        supabase.from('groups').select('*').order('created_at', { ascending: false }),
        supabase.from('group_tags').select('group_id, tag'),
        supabase.from('events').select('group_id, title, description'),
        supabase.from('group_members').select('group_id, status').eq('user_id', user.id),
      ])
      const tg = {}
      ;(tags ?? []).forEach((t) => { (tg[t.group_id] ||= []).push(t.tag) })
      const eg = {}
      ;(evs ?? []).forEach((e) => { (eg[e.group_id] ||= []).push(`${e.title} ${e.description ?? ''}`) })
      setTagsByGroup(tg)
      setEventsByGroup(eg)
      setMemberIds(new Set((mem ?? []).filter((m) => m.status === 'member').map((m) => m.group_id)))
      setGroups(gs ?? [])
    })()
  }, [user.id])

  if (groups === null || profileLoading) return <Spinner />

  const onboarded = !!profile?.onboarded
  const owned = groups.filter((g) => g.organizer_id === user.id)
  const joined = groups.filter((g) => g.organizer_id !== user.id && memberIds.has(g.id))
  const discoverable = groups.filter((g) => g.organizer_id !== user.id)

  const term = query.trim().toLowerCase()
  function matchesQuery(g) {
    if (!term) return true
    const hay = [g.name, g.description, g.area_name, ...(tagsByGroup[g.id] ?? []), ...(eventsByGroup[g.id] ?? [])]
      .join(' ')
      .toLowerCase()
    return hay.includes(term)
  }

  const filtered = discoverable.filter((g) => (!filter || g.primary_category === filter) && matchesQuery(g))
  const ranked = onboarded
    ? rankGroups(profile, filtered)
    : filtered.map((g) => ({ group: g, score: null, tier: null }))

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      {!onboarded && (
        <div className="mb-6 rounded-lg border border-gold/40 bg-gold/10 px-4 py-3 text-sm text-forest">
          Finish your profile to see how well each group fits you.{' '}
          <Link to="/onboarding" className="font-semibold underline">Set it up</Link>.
        </div>
      )}

      <h1 className="mb-4 text-2xl font-semibold text-forest">Commons</h1>

      <div className="mb-8 flex gap-1 border-b border-forest/15">
        <Tab active={tab === 'search'} onClick={() => setTab('search')}>Search</Tab>
        <Tab active={tab === 'mine'} onClick={() => setTab('mine')}>Your groups</Tab>
      </div>

      {tab === 'search' ? (
        <>
          <section className="mb-8">
            <CategoryTiles active={filter} onSelect={setFilter} />
            <div className="mt-4">
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search groups and events…"
                className="w-full rounded-lg border border-forest/20 bg-white px-4 py-2.5 outline-none focus:border-forest"
              />
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-forest/60">
              {onboarded ? 'Matches' : 'Groups'}
              {(filter || term) && <span className="ml-2 font-normal text-forest/40">{ranked.length} result{ranked.length === 1 ? '' : 's'}</span>}
            </h2>
            <CardGrid
              items={ranked}
              empty={term || filter ? 'No groups match your search.' : 'No other groups yet.'}
            />
          </section>
        </>
      ) : (
        <>
          <section className="mb-10">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-forest/60">Groups you organize</h2>
            {owned.length === 0 ? (
              <p className="text-forest/60">You don’t organize any groups yet. <Link to="/groups/new" className="font-medium underline">Start one</Link>.</p>
            ) : (
              <ul className="grid gap-4 sm:grid-cols-2">
                {owned.map((g) => <GroupCard key={g.id} g={g} owned />)}
              </ul>
            )}
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-forest/60">Matched groups</h2>
            {joined.length === 0 ? (
              <p className="text-forest/60">You haven’t joined any groups yet — find your fit in Search.</p>
            ) : (
              <ul className="grid gap-4 sm:grid-cols-2">
                {joined.map((g) => {
                  const { score, tier } = onboarded ? scoreGroup(profile, g) : { score: null, tier: null }
                  return <GroupCard key={g.id} g={g} score={score} tier={tier} />
                })}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  )
}

function CardGrid({ items, empty }) {
  if (items.length === 0) return <p className="text-forest/60">{empty}</p>
  return (
    <ul className="grid gap-4 sm:grid-cols-2">
      {items.map(({ group: g, score, tier }) => <GroupCard key={g.id} g={g} score={score} tier={tier} />)}
    </ul>
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

function Tab({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${
        active ? 'border-forest text-forest' : 'border-transparent text-forest/50 hover:text-forest'
      }`}
    >
      {children}
    </button>
  )
}
