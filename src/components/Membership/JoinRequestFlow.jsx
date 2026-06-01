import { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../utils/supabaseClient'

// Shows the right join control based on the viewer's current membership row.
// A god user (isGod) joins straight to 'member', skipping approval.
export default function JoinRequestFlow({ group, membership, onChange, isGod }) {
  const { user } = useAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function request() {
    setBusy(true); setError(null)
    const { error } = await supabase.from('group_members').insert({
      group_id: group.id,
      user_id: user.id,
      status: isGod ? 'member' : 'pending',
      ...(isGod ? { role: 'organizer' } : {}),
    })
    setBusy(false)
    if (error) return setError(error.message)
    onChange()
  }

  async function withdraw() {
    setBusy(true); setError(null)
    const { error } = await supabase.from('group_members').delete().eq('id', membership.id)
    setBusy(false)
    if (error) return setError(error.message)
    onChange()
  }

  const status = membership?.status

  return (
    <div>
      {!membership && (
        <button onClick={request} disabled={busy} className="rounded-lg bg-forest px-5 py-2.5 font-medium text-cream disabled:opacity-50">
          {busy ? 'Joining…' : isGod ? 'Join instantly ⚡' : 'Request to join'}
        </button>
      )}
      {status === 'pending' && (
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-gold/20 px-3 py-1 text-sm font-medium text-forest">Request pending</span>
          <button onClick={withdraw} disabled={busy} className="text-sm text-forest/70 underline">Withdraw</button>
        </div>
      )}
      {status === 'member' && (
        <span className="rounded-full bg-forest/10 px-3 py-1 text-sm font-medium text-forest">You’re a member ✓</span>
      )}
      {status === 'declined' && (
        <span className="rounded-full bg-red-100 px-3 py-1 text-sm font-medium text-red-700">Request declined</span>
      )}
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
    </div>
  )
}
