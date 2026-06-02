import { useEffect, useRef, useState } from 'react'
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
  const [username, setUsername] = useState('')
  const [sorts, setSorts] = useState({})
  const [facts, setFacts] = useState({ life_stage: '', work_field: '', education: '', spend_comfort: '', bio: '' })
  const [dealbreakers, setDealbreakers] = useState([])
  const [vis, setVis] = useState({ everyone: false, comembers: false, organizers: false, friends: false })
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)
  const [error, setError] = useState(null)
  const seeded = useRef(false)

  // Seed local state once, the first time the profile loads. Guarded so a
  // later refetch (e.g. after save) can't wipe in-progress edits.
  useEffect(() => {
    if (!profile || seeded.current) return
    seeded.current = true
    setDisplayName(profile.display_name ?? '')
    setUsername(profile.username ?? '')
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
    setVis({
      everyone: !!profile.realname_to_everyone,
      comembers: !!profile.realname_to_comembers,
      organizers: !!profile.realname_to_organizers,
      friends: !!profile.realname_to_friends,
    })
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
    const handle = username.trim().toLowerCase()
    if (!/^[a-z0-9_]{3,20}$/.test(handle)) {
      setBusy(false)
      return setError('Username must be 3–20 characters: lowercase letters, numbers, or underscore.')
    }
    setBusy(true)
    const axes = deriveAxes(sorts)
    const cleanFacts = Object.fromEntries(
      Object.entries(facts).map(([k, v]) => [k, v === '' ? null : v]),
    )
    const { error } = await supabase
      .from('profiles')
      .update({
        display_name: displayName || null,
        username: handle,
        realname_to_everyone: vis.everyone,
        realname_to_comembers: vis.comembers,
        realname_to_organizers: vis.organizers,
        realname_to_friends: vis.friends,
        ...cleanFacts,
        ...sorts,
        ...axes,
        dealbreakers,
      })
      .eq('user_id', user.id)
    setBusy(false)
    if (error) {
      return setError(/duplicate|unique/i.test(error.message) ? 'That username is taken — try another.' : error.message)
    }
    setMsg('Saved.')
    refresh()
  }

  if (loading) return <Spinner />

  return (
    <div className="mx-auto max-w-xl px-6 py-10">
      <h1 className="mb-1 text-2xl font-semibold text-forest">Profile settings</h1>
      <p className="mb-8 text-forest/70">Update your answers anytime — your matches recalculate on save.</p>

      <section className="mb-10 space-y-4">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-forest">Username</span>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="lowercase, 3–20 chars"
            className="w-full rounded-lg border border-forest/20 bg-white px-3 py-2 outline-none focus:border-forest"
          />
          <span className="mt-1 block text-xs text-forest/50">This is your public handle — shown instead of your real name.</span>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-forest">Real name</span>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full rounded-lg border border-forest/20 bg-white px-3 py-2 outline-none focus:border-forest"
          />
          <span className="mt-1 block text-xs text-forest/50">Private by default — choose who can see it below.</span>
        </label>

        <fieldset className="rounded-lg border border-forest/15 p-4">
          <legend className="px-1 text-sm font-medium text-forest">Who can see your real name</legend>
          <div className="space-y-2">
            <Toggle label="Everyone" checked={vis.everyone} onChange={(v) => setVis((s) => ({ ...s, everyone: v }))} />
            <Toggle label="Members of groups I’m in" checked={vis.comembers} onChange={(v) => setVis((s) => ({ ...s, comembers: v }))} />
            <Toggle label="Organizers & managers of my groups" checked={vis.organizers} onChange={(v) => setVis((s) => ({ ...s, organizers: v }))} />
            <Toggle label="My friends" checked={vis.friends} onChange={(v) => setVis((s) => ({ ...s, friends: v }))} />
          </div>
          <p className="mt-2 text-xs text-forest/45">Off everywhere = only you see your real name.</p>
        </fieldset>
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

function Toggle({ label, checked, onChange }) {
  return (
    <label className="flex items-center gap-2 text-sm text-forest">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-forest/30 accent-[#2F4734]"
      />
      {label}
    </label>
  )
}
