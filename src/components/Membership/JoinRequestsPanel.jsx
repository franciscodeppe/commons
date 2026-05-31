import { useState } from 'react'
import { supabase } from '../../utils/supabaseClient'

// Organizer-only: approve or decline pending requests.
export default function JoinRequestsPanel({ requests, onAction }) {
  const [busyId, setBusyId] = useState(null)

  async function act(member, status) {
    setBusyId(member.id)
    await supabase.from('group_members').update({ status }).eq('id', member.id)
    setBusyId(null)
    onAction()
  }

  if (requests.length === 0) {
    return <p className="text-sm text-forest/60">No pending requests.</p>
  }

  return (
    <ul className="space-y-2">
      {requests.map((r) => (
        <li key={r.id} className="flex items-center justify-between rounded-lg border border-forest/15 bg-white px-4 py-3">
          <span className="font-medium text-forest">{r.display_name || 'Someone'}</span>
          <div className="flex gap-2">
            <button onClick={() => act(r, 'member')} disabled={busyId === r.id} className="rounded-md bg-forest px-3 py-1 text-sm text-cream disabled:opacity-50">Approve</button>
            <button onClick={() => act(r, 'declined')} disabled={busyId === r.id} className="rounded-md border border-forest/30 px-3 py-1 text-sm text-forest disabled:opacity-50">Decline</button>
          </div>
        </li>
      ))}
    </ul>
  )
}
