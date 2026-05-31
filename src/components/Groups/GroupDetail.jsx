import { useCallback, useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../../utils/supabaseClient'
import { useAuth } from '../../hooks/useAuth'
import { useProfile } from '../../hooks/useProfile'
import { scoreGroup } from '../../utils/matchingLogic'
import { CATEGORIES, CHARACTER_AXES, DEALBREAKERS } from '../../utils/constants'
import Spinner from '../Shared/Spinner'
import JoinRequestFlow from '../Membership/JoinRequestFlow'
import JoinRequestsPanel from '../Membership/JoinRequestsPanel'
import MemberList from '../Membership/MemberList'

const CAT_LABEL = Object.fromEntries(CATEGORIES.map((c) => [c.key, c.label]))
const NOT_FOR_LABEL = Object.fromEntries(DEALBREAKERS.map((d) => [d.token, d.label]))

function charLabel(axisKey, value) {
  const axis = CHARACTER_AXES.find((a) => a.key === axisKey)
  return axis?.options.find((o) => o.value === value)?.label
}

export default function GroupDetail() {
  const { id } = useParams()
  const { user } = useAuth()
  const { profile } = useProfile()
  const [group, setGroup] = useState(null)
  const [tags, setTags] = useState([])
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const load = useCallback(async () => {
    const { data: g } = await supabase.from('groups').select('*').eq('id', id).maybeSingle()
    if (!g) { setNotFound(true); setLoading(false); return }
    setGroup(g)

    const [{ data: t }, { data: m }] = await Promise.all([
      supabase.from('group_tags').select('*').eq('group_id', id),
      supabase.from('group_members').select('*').eq('group_id', id),
    ])
    setTags(t ?? [])

    // attach display names (separate fetch; no FK between members and profiles)
    const ids = [...new Set((m ?? []).map((row) => row.user_id))]
    let names = {}
    if (ids.length) {
      const { data: profs } = await supabase.from('profiles').select('user_id, display_name').in('user_id', ids)
      names = Object.fromEntries((profs ?? []).map((p) => [p.user_id, p.display_name]))
    }
    setMembers((m ?? []).map((row) => ({ ...row, display_name: names[row.user_id] })))
    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])

  if (loading) return <Spinner />
  if (notFound) return <div className="mx-auto max-w-2xl px-6 py-12 text-forest">Group not found. <Link to="/" className="underline">Back to browse</Link></div>

  const isOrganizer = group.organizer_id === user.id
  const myMembership = members.find((m) => m.user_id === user.id) || null
  const pending = members.filter((m) => m.status === 'pending')
  const active = members.filter((m) => m.status === 'member')

  const declared = CHARACTER_AXES
    .map((a) => ({ label: a.label, value: charLabel(a.key, group[a.key]) }))
    .filter((x) => x.value)

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <Link to="/" className="text-sm text-forest/60 hover:text-forest">← Browse</Link>

      <div className="mt-3 mb-2 flex items-center gap-2">
        <span className="rounded-full bg-forest/10 px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-forest">{CAT_LABEL[group.primary_category]}</span>
        {group.secondary_category && <span className="rounded-full bg-forest/5 px-2 py-0.5 text-xs text-forest/70">{CAT_LABEL[group.secondary_category]}</span>}
        {group.area_name && <span className="text-xs text-forest/50">{group.area_name}</span>}
      </div>
      <h1 className="text-2xl font-semibold text-forest">{group.name}</h1>
      {group.description && <p className="mt-2 text-forest/80">{group.description}</p>}

      {!isOrganizer && profile?.onboarded && (() => {
        const { score, tier, gated } = scoreGroup(profile, group)
        return (
          <p className="mt-4 text-sm text-forest/70">
            Your fit: <span className="font-semibold text-forest">{tier.label}</span>
            {tier.key !== 'poor' && <> · {score}/100</>}
            {gated && <span className="ml-2 rounded bg-red-50 px-2 py-0.5 text-xs text-red-700">dealbreaker</span>}
          </p>
        )
      })()}

      <div className="mt-6">
        {isOrganizer
          ? <span className="rounded-full bg-gold/20 px-3 py-1 text-sm font-medium text-forest">You organize this group</span>
          : <JoinRequestFlow group={group} membership={myMembership} onChange={load} />}
      </div>

      {tags.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-forest/60">Tags</h2>
          <div className="flex flex-wrap gap-2">
            {tags.map((t) => <span key={t.id} className="rounded-full border border-forest/20 px-3 py-1 text-sm text-forest">{t.tag}</span>)}
          </div>
        </div>
      )}

      {declared.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-forest/60">Character</h2>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2">
            {declared.map((d) => (
              <div key={d.label} className="flex justify-between border-b border-forest/10 py-1">
                <dt className="text-forest/60">{d.label}</dt>
                <dd className="font-medium text-forest">{d.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {group.not_for_tags?.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-forest/60">Not for</h2>
          <div className="flex flex-wrap gap-2">
            {group.not_for_tags.map((t) => <span key={t} className="rounded-full bg-red-50 px-3 py-1 text-sm text-red-700">{NOT_FOR_LABEL[t] || t}</span>)}
          </div>
        </div>
      )}

      <div className="mt-10">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-forest/60">Members ({active.length})</h2>
        <MemberList members={active} />
      </div>

      {isOrganizer && (
        <div className="mt-10 rounded-xl border border-forest/15 bg-forest/[0.03] p-5">
          <h2 className="mb-3 text-lg font-semibold text-forest">Join requests</h2>
          <JoinRequestsPanel requests={pending} onAction={load} />
        </div>
      )}
    </div>
  )
}
