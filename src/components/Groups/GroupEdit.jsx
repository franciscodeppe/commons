import { useEffect, useState } from 'react'
import { useNavigate, useParams, Navigate, Link } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../utils/supabaseClient'
import GroupForm from './GroupForm'
import Spinner from '../Shared/Spinner'

export default function GroupEdit() {
  const { id } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [initial, setInitial] = useState(null)
  const [status, setStatus] = useState('loading') // loading | ready | notfound | forbidden

  useEffect(() => {
    ;(async () => {
      const { data: g } = await supabase.from('groups').select('*').eq('id', id).maybeSingle()
      if (!g) return setStatus('notfound')
      if (g.organizer_id !== user.id) return setStatus('forbidden')
      const { data: tagRows } = await supabase.from('group_tags').select('tag, type').eq('group_id', id)
      setInitial({
        ...g,
        tags: (tagRows ?? []).filter((t) => t.type === 'predefined').map((t) => t.tag),
        customTags: (tagRows ?? []).filter((t) => t.type === 'custom').map((t) => t.tag),
        notFor: g.not_for_tags ?? [],
      })
      setStatus('ready')
    })()
  }, [id, user.id])

  async function onSubmit({ fields, predefinedTags, customTags, notFor }) {
    const { error } = await supabase
      .from('groups')
      .update({ ...fields, not_for_tags: notFor })
      .eq('id', id)
    if (error) return error.message

    // Reconcile tags: clear and re-insert (organizer has manage rights).
    await supabase.from('group_tags').delete().eq('group_id', id)
    const tagRows = [
      ...predefinedTags.map((t) => ({ group_id: Number(id), tag: t, type: 'predefined' })),
      ...customTags.map((t) => ({ group_id: Number(id), tag: t, type: 'custom' })),
    ]
    if (tagRows.length) {
      const { error: tErr } = await supabase.from('group_tags').insert(tagRows)
      if (tErr) return tErr.message
    }
    navigate(`/groups/${id}`)
    return null
  }

  if (status === 'forbidden') return <Navigate to={`/groups/${id}`} replace />
  if (status === 'notfound') {
    return <div className="mx-auto max-w-2xl px-6 py-12 text-forest">Group not found. <Link to="/" className="underline">Back to browse</Link></div>
  }
  if (status === 'loading' || !initial) return <Spinner />

  return (
    <GroupForm
      initial={initial}
      onSubmit={onSubmit}
      submitLabel="Save changes"
      busyLabel="Saving…"
      title="Edit group"
      subtitle="Update your group’s details and character."
    />
  )
}
