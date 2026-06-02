import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../utils/supabaseClient'
import { useAuth } from '../../hooks/useAuth'
import { fetchNames, formatName } from '../../utils/names'
import Spinner from '../Shared/Spinner'

export default function FriendsPage() {
  const { user } = useAuth()
  const [rows, setRows] = useState(null)
  const [names, setNames] = useState({})
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [error, setError] = useState(null)

  const otherId = useCallback((f) => (f.requester_id === user.id ? f.addressee_id : f.requester_id), [user.id])

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('friendships')
      .select('*')
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
    const list = data ?? []
    setRows(list)
    setNames(await fetchNames(list.map(otherId)))
  }, [user.id, otherId])

  useEffect(() => { load() }, [load])

  // Relationship of the current user to some other user id.
  function relOf(id) {
    const f = (rows ?? []).find((r) => otherId(r) === id)
    if (!f) return { kind: 'none' }
    if (f.status === 'accepted') return { kind: 'friend', row: f }
    return { kind: f.addressee_id === user.id ? 'incoming' : 'outgoing', row: f }
  }

  async function runSearch(q) {
    setQuery(q)
    const term = q.trim().toLowerCase()
    if (term.length < 2) return setResults([])
    const { data } = await supabase
      .from('member_directory')
      .select('user_id, username')
      .ilike('username', `%${term}%`)
      .neq('user_id', user.id)
      .limit(20)
    setResults(data ?? [])
  }

  async function sendRequest(id) {
    setError(null)
    const { error } = await supabase.from('friendships').insert({ requester_id: user.id, addressee_id: id, status: 'pending' })
    if (error) return setError('Could not send request — you may already have one with this person.')
    await load()
  }
  async function accept(row) { await supabase.from('friendships').update({ status: 'accepted' }).eq('id', row.id); await load() }
  async function remove(row) { await supabase.from('friendships').delete().eq('id', row.id); await load() }

  if (rows === null) return <Spinner />

  const incoming = rows.filter((r) => r.status === 'pending' && r.addressee_id === user.id)
  const friends = rows.filter((r) => r.status === 'accepted')

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="mb-6 text-2xl font-semibold text-forest">Friends</h1>

      {/* Search */}
      <section className="mb-10">
        <input
          type="search"
          value={query}
          onChange={(e) => runSearch(e.target.value)}
          placeholder="Search by username…"
          className="w-full rounded-lg border border-forest/20 bg-white px-4 py-2.5 outline-none focus:border-forest"
        />
        {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
        {results.length > 0 && (
          <ul className="mt-3 space-y-2">
            {results.map((r) => {
              const rel = relOf(r.user_id)
              return (
                <li key={r.user_id} className="flex items-center justify-between rounded-lg border border-forest/15 bg-white px-4 py-2">
                  <span className="text-sm font-medium text-forest">{r.username}</span>
                  {rel.kind === 'friend' ? (
                    <span className="text-xs text-forest/50">Friends ✓</span>
                  ) : rel.kind === 'outgoing' ? (
                    <span className="text-xs text-forest/50">Requested</span>
                  ) : rel.kind === 'incoming' ? (
                    <button onClick={() => accept(rel.row)} className="rounded-md bg-forest px-3 py-1 text-xs text-cream">Accept</button>
                  ) : (
                    <button onClick={() => sendRequest(r.user_id)} className="rounded-md border border-forest/30 px-3 py-1 text-xs text-forest hover:bg-forest hover:text-cream">Add friend</button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
        {query.trim().length >= 2 && results.length === 0 && <p className="mt-3 text-sm text-forest/50">No users match “{query.trim()}”.</p>}
      </section>

      {/* Incoming requests */}
      <section className="mb-10">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-forest/60">Requests ({incoming.length})</h2>
        {incoming.length === 0 ? (
          <p className="text-sm text-forest/50">No pending requests.</p>
        ) : (
          <ul className="space-y-2">
            {incoming.map((f) => (
              <li key={f.id} className="flex items-center justify-between rounded-lg border border-forest/15 bg-white px-4 py-2">
                <span className="text-sm font-medium text-forest">{formatName(names[otherId(f)])}</span>
                <div className="flex gap-2">
                  <button onClick={() => accept(f)} className="rounded-md bg-forest px-3 py-1 text-xs text-cream">Accept</button>
                  <button onClick={() => remove(f)} className="rounded-md border border-forest/30 px-3 py-1 text-xs text-forest">Decline</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Friends */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-forest/60">Your friends ({friends.length})</h2>
        {friends.length === 0 ? (
          <p className="text-sm text-forest/50">No friends yet — search above to add some.</p>
        ) : (
          <ul className="space-y-2">
            {friends.map((f) => (
              <li key={f.id} className="flex items-center justify-between rounded-lg border border-forest/15 bg-white px-4 py-2">
                <span className="text-sm font-medium text-forest">{formatName(names[otherId(f)])}</span>
                <button onClick={() => remove(f)} className="rounded-md border border-red-200 px-3 py-1 text-xs text-red-700 hover:bg-red-50">Unfriend</button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
