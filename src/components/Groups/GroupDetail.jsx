import { useCallback, useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../../utils/supabaseClient'
import { useAuth } from '../../hooks/useAuth'
import { useProfile } from '../../hooks/useProfile'
import { scoreGroup, driftedCharacter } from '../../utils/matchingLogic'
import { fetchNames } from '../../utils/names'
import { CATEGORIES, CHARACTER_AXES, DEALBREAKERS } from '../../utils/constants'
import Spinner from '../Shared/Spinner'
import JoinRequestFlow from '../Membership/JoinRequestFlow'
import JoinRequestsPanel from '../Membership/JoinRequestsPanel'
import MemberList from '../Membership/MemberList'
import EventList from '../Events/EventList'

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
  const [friendRel, setFriendRel] = useState({})
  const [drift, setDrift] = useState([])
  const [attendanceN, setAttendanceN] = useState(0)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  // Recompute drift from the people who've actually attended.
  const loadDrift = useCallback(async (g) => {
    const { data } = await supabase.rpc('group_attendance_axes', { p_group_id: Number(id) })
    const row = Array.isArray(data) ? data[0] : data
    const n = row?.n ?? 0
    setAttendanceN(n)
    setDrift(driftedCharacter(g, row ?? {}, n))
  }, [id])

  const load = useCallback(async () => {
    const { data: g } = await supabase.from('groups').select('*').eq('id', id).maybeSingle()
    if (!g) { setNotFound(true); setLoading(false); return }
    setGroup(g)

    const [{ data: t }, { data: m }] = await Promise.all([
      supabase.from('group_tags').select('*').eq('group_id', id),
      supabase.from('group_members').select('*').eq('group_id', id),
    ])
    setTags(t ?? [])

    // resolve usernames (+ real names where permitted) for these members
    const names = await fetchNames((m ?? []).map((row) => row.user_id))
    setMembers((m ?? []).map((row) => ({
      ...row,
      username: names[row.user_id]?.username,
      realName: names[row.user_id]?.realName,
    })))

    // friendship status between me and these members
    const { data: fr } = await supabase
      .from('friendships')
      .select('*')
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
    const rel = {}
    ;(fr ?? []).forEach((f) => {
      const other = f.requester_id === user.id ? f.addressee_id : f.requester_id
      rel[other] = f.status === 'accepted'
        ? { kind: 'friend', row: f }
        : { kind: f.addressee_id === user.id ? 'incoming' : 'outgoing', row: f }
    })
    setFriendRel(rel)

    await loadDrift(g)
    setLoading(false)
  }, [id, loadDrift])

  useEffect(() => { load() }, [load])

  if (loading) return <Spinner />
  if (notFound) return <div className="mx-auto max-w-2xl px-6 py-12 text-forest">Group not found. <Link to="/" className="underline">Back to browse</Link></div>

  const isOrganizer = group.organizer_id === user.id
  const myMembership = members.find((m) => m.user_id === user.id) || null
  const myRole = myMembership?.status === 'member' ? myMembership.role : null
  const isGod = !!profile?.is_god
  const isOwner = isOrganizer || isGod || myRole === 'organizer'
  const canManage = isOwner || myRole === 'manager'
  const pending = members.filter((m) => m.status === 'pending')
  const active = members.filter((m) => m.status === 'member')

  async function setRole(member, role) {
    await supabase.from('group_members').update({ role }).eq('id', member.id)
    load()
  }

  async function removeMember(member) {
    if (!window.confirm(`Remove ${member.username || 'this member'} from the group?`)) return
    await supabase.from('group_members').delete().eq('id', member.id)
    load()
  }

  async function addFriend(id) {
    await supabase.from('friendships').insert({ requester_id: user.id, addressee_id: id, status: 'pending' })
    load()
  }
  async function acceptFriend(row) {
    await supabase.from('friendships').update({ status: 'accepted' }).eq('id', row.id)
    load()
  }

  const axisLabel = (axisKey) => CHARACTER_AXES.find((a) => a.key === `char_${axisKey}`)?.label
  const charRows = drift.filter((d) => group[`char_${d.key}`])

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

      {!isOwner && !canManage && profile?.onboarded && (() => {
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
        {isOwner ? (
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-gold/20 px-3 py-1 text-sm font-medium text-forest">You organize this group</span>
            <Link to={`/groups/${group.id}/edit`} className="rounded-md border border-forest/30 px-3 py-1 text-sm text-forest hover:bg-forest hover:text-cream">Edit group</Link>
          </div>
        ) : canManage ? (
          <span className="rounded-full bg-gold/20 px-3 py-1 text-sm font-medium text-forest">You manage this group</span>
        ) : (
          <JoinRequestFlow group={group} membership={myMembership} onChange={load} isGod={profile?.is_god} />
        )}
      </div>

      {tags.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-forest/60">Tags</h2>
          <div className="flex flex-wrap gap-2">
            {tags.map((t) => <span key={t.id} className="rounded-full border border-forest/20 px-3 py-1 text-sm text-forest">{t.tag}</span>)}
          </div>
        </div>
      )}

      {charRows.length > 0 && (
        <div className="mt-8">
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-forest/60">Character</h2>
            {attendanceN > 0 && (
              <span className="text-xs text-forest/45">drifting with {attendanceN} attendance{attendanceN === 1 ? '' : 's'}</span>
            )}
          </div>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2">
            {charRows.map((d) => (
              <div key={d.key} className="flex items-center justify-between border-b border-forest/10 py-1">
                <dt className="text-forest/60">{axisLabel(d.key)}</dt>
                <dd className="font-medium text-forest">
                  {d.shifted ? (
                    <span title="declared → where the group actually is now">
                      <span className="text-forest/40 line-through">{charLabel(`char_${d.key}`, d.declared)}</span>
                      {' '}
                      <span className="text-gold">→ {charLabel(`char_${d.key}`, d.current)}</span>
                    </span>
                  ) : (
                    charLabel(`char_${d.key}`, d.declared)
                  )}
                </dd>
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
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-forest/60">Events</h2>
          {canManage && (
            <Link to={`/groups/${group.id}/events/new`} className="rounded-md border border-forest/30 px-3 py-1 text-sm text-forest hover:bg-forest hover:text-cream">
              + Add event
            </Link>
          )}
        </div>
        <EventList groupId={group.id} isOrganizer={canManage} userId={user.id} onAttendanceChange={() => loadDrift(group)} />
      </div>

      <div className="mt-10">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-forest/60">Members ({active.length})</h2>
        <MemberList members={active} isOwner={isOwner} canManage={canManage} currentUserId={user.id} onSetRole={setRole} onRemove={removeMember} friendRel={friendRel} onAddFriend={addFriend} onAcceptFriend={acceptFriend} />
      </div>

      {canManage && (
        <div className="mt-10 rounded-xl border border-forest/15 bg-forest/[0.03] p-5">
          <h2 className="mb-3 text-lg font-semibold text-forest">Join requests</h2>
          <JoinRequestsPanel requests={pending} onAction={load} />
        </div>
      )}
    </div>
  )
}
