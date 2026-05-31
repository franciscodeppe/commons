import { useEffect, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useProfile } from '../../hooks/useProfile'
import { supabase } from '../../utils/supabaseClient'
import { deriveAxes } from '../../utils/matchingLogic'
import { SORTS, DEALBREAKER_CAP } from '../../utils/constants'
import { SortStep, FactsStep, DealbreakersStep } from './profileFields'
import Spinner from '../Shared/Spinner'

export default function ProfileSettings() {
  const { user } = useAuth()
  const { profile, loading, refresh } = useProfile()

  const [displayName, setDisplayName] = useState('')
  const [sorts, setSorts] = useState({})
  const [facts, setFacts] = useState({ life_stage: '', work_field: '', education: '', spend_comfort: '', bio: '' })
  const [dealbreakers, setDealbreakers] = useState([])
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)
  const [error, setError] = useState(null)

  // Seed local state once the profile loads.
  useEffect(() => {
    if (!profile) return
    setDisplayName(profile.display_name ?? '')
    setSorts({
      sort_taste: profile.sort_taste ?? {},
      sort_humor: profile.sort_humor ?? {},
      sort_social: profile.sort_social ?? {},
      sort_rhythm: profile.sort_rhythm ?? {},
      sort_politics: profile.sort_politics ?? {},
    })
    setFacts({
      life_stage: profile.life_stage ?? '',
      work_field: profile.work_field ?? '',
      education: profile.education ?? '',
      spend_comfort: profile.spend_comfort ?? '',
      bio: profile.bio ?? '',
    })
    setDealbreakers(profile.dealbreakers ?? [])
  }, [profile])

  function setSortScore(sortKey, idx, v) {
    setSorts((prev) => ({ ...prev, [sortKey]: { ...(prev[sortKey] || {}), [idx]: v } }))
  }

  function toggleDealbreaker(token) {
    setDealbreakers((prev) =>
      prev.includes(token)
        ? prev.filter((t) => t !== token)
        : prev.length < DEALBREAKER_CAP
          ? [...prev, token]
          : prev,
    )
  }

  async function handleSave() {
    setError(null)
    setMsg(null)
    setBusy(true)
    const axes = deriveAxes(sorts)
    const cleanFacts = Object.fromEntries(
      Object.entries(facts).map(([k, v]) => [k, v === '' ? null : v]),
    )
    const { error } = await supabase
      .from('profiles')
      .update({
        display_name: displayName || null,
        ...cleanFacts,
        ...sorts,
        ...axes,
        dealbreakers,
      })
      .eq('user_id', user.id)
    setBusy(false)
    if (error) return setError(error.message)
    setMsg('Saved.')
    refresh()
  }

  if (loading) return <Spinner />

  return (
    <div className="mx-auto max-w-xl px-6 py-10">
      <h1 className="mb-1 text-2xl font-semibold text-forest">Profile settings</h1>
      <p className="mb-8 text-forest/70">Update your answers anytime — your matches recalculate on save.</p>

      <section className="mb-10">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-forest">Display name</span>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full rounded-lg border border-forest/20 bg-white px-3 py-2 outline-none focus:border-forest"
          />
        </label>
      </section>

      <div className="space-y-12">
        {SORTS.map((sort) => (
          <section key={sort.key}>
            <SortStep sort={sort} values={sorts[sort.key] || {}} onSet={setSortScore} />
          </section>
        ))}

        <section><FactsStep facts={facts} setFacts={setFacts} /></section>
        <section><DealbreakersStep selected={dealbreakers} onToggle={toggleDealbreaker} /></section>
      </div>

      <div className="mt-10 flex items-center gap-4 border-t border-forest/10 pt-6">
        <button onClick={handleSave} disabled={busy} className="rounded-lg bg-forest px-6 py-2.5 font-medium text-cream disabled:opacity-50">
          {busy ? 'Saving…' : 'Save changes'}
        </button>
        {msg && <span className="text-sm font-medium text-forest">{msg}</span>}
        {error && <span className="text-sm text-red-700">{error}</span>}
      </div>
    </div>
  )
}
