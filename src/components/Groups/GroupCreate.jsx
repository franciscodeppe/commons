import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../utils/supabaseClient'
import GroupForm from './GroupForm'

export default function GroupCreate() {
  const { user } = useAuth()
  const navigate = useNavigate()

  async function onSubmit({ fields, predefinedTags, customTags, notFor }) {
    const { data: group, error } = await supabase
      .from('groups')
      .insert({ ...fields, organizer_id: user.id, not_for_tags: notFor })
      .select()
      .single()
    if (error) return error.message

    const tagRows = [
      ...predefinedTags.map((t) => ({ group_id: group.id, tag: t, type: 'predefined' })),
      ...customTags.map((t) => ({ group_id: group.id, tag: t, type: 'custom' })),
    ]
    if (tagRows.length) {
      const { error: tErr } = await supabase.from('group_tags').insert(tagRows)
      if (tErr) return tErr.message
    }
    navigate(`/groups/${group.id}`)
    return null
  }

  return (
    <GroupForm
      onSubmit={onSubmit}
      submitLabel="Create group"
      busyLabel="Creating…"
      title="Start a group"
      subtitle="Declare who it’s for. Honesty here is what makes the matching honest."
    />
  )
}
