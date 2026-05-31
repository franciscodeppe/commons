import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../utils/supabaseClient'
import { useProfile } from '../../hooks/useProfile'
import { CATEGORIES } from '../../utils/constants'
import Spinner from '../Shared/Spinner'

const CAT_LABEL = Object.fromEntries(CATEGORIES.map((c) => [c.key, c.label]))

export default function GroupList() {
  const { profile } = useProfile()
  const [groups, setGroups] = useState(null)
  const [filter, setFilter] = useState('')

  useEffect(() => {
    ;(async () => {
      const { data } = await supabase.from('groups').select('*').order('created_at', { ascending: false })
      setGroups(data ?? [])
    })()
  }, [])

  if (groups === null) return <Spinner />

  const shown = filter ? groups.filter((g) => g.primary_category === filter) : groups

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      {profile && !profile.onboarded && (
        <div className="mb-6 rounded-lg border border-gold/40 bg-gold/10 px-4 py-3 text-sm text-forest">
          Your profile isn’t set up yet.{' '}
          <Link to="/onboarding" className="font-semibold underline">Finish it</Link> so groups can match you.
        </div>
      )}

      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-forest">Groups near you</h1>
        <Link to="/groups/new" className="rounded-lg bg-forest px-4 py-2 text-sm font-medium text-cream">Start a group</Link>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        <Chip active={filter === ''} onClick={() => setFilter('')}>All</Chip>
        {CATEGORIES.map((c) => (
          <Chip key={c.key} active={filter === c.key} onClick={() => setFilter(c.key)}>{c.label}</Chip>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="text-forest/60">No groups yet. Be the first to start one.</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {shown.map((g) => (
            <li key={g.id}>
              <Link to={`/groups/${g.id}`} className="block rounded-xl border border-forest/15 bg-white p-5 hover:border-forest/40">
                <div className="mb-1 flex items-center gap-2">
                  <span className="rounded-full bg-forest/10 px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-forest">{CAT_LABEL[g.primary_category]}</span>
                  {g.area_name && <span className="text-xs text-forest/50">{g.area_name}</span>}
                </div>
                <h2 className="text-lg font-semibold text-forest">{g.name}</h2>
                {g.description && <p className="mt-1 line-clamp-2 text-sm text-forest/70">{g.description}</p>}
                <p className="mt-3 text-xs text-forest/50">{g.member_count} member{g.member_count === 1 ? '' : 's'}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Chip({ active, onClick, children }) {
  return (
    <button onClick={onClick} className={`rounded-full border px-3 py-1 text-sm ${active ? 'border-forest bg-forest text-cream' : 'border-forest/25 text-forest'}`}>
      {children}
    </button>
  )
}
