import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../utils/supabaseClient'
import { deriveAxes } from '../../utils/matchingLogic'
import { SORTS, DEALBREAKER_CAP } from '../../utils/constants'
import { SortStep, FactsStep, DealbreakersStep } from './profileFields'

export default function ProfileSetup() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [sorts, setSorts] = useState({}) // { sort_taste: {0:2,...} }
  const [facts, setFacts] = useState({ life_stage: '', work_field: '', education: '', spend_comfort: '', bio: '' })
  const [dealbreakers, setDealbreakers] = useState([])
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const steps = [...SORTS.map((s) => ({ kind: 'sort', sort: s })), { kind: 'facts' }, { kind: 'dealbreakers' }]
  const current = steps[step]
  const isLast = step === steps.length - 1

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

  async function handleFinish() {
    setError(null)
    setBusy(true)
    const axes = deriveAxes(sorts)
    // Constrained columns reject '' — send null when a field was left blank.
    const cleanFacts = Object.fromEntries(
      Object.entries(facts).map(([k, v]) => [k, v === '' ? null : v]),
    )
    const { error } = await supabase
      .from('profiles')
      .update({
        ...cleanFacts,
        sort_taste: sorts.sort_taste ?? {},
        sort_humor: sorts.sort_humor ?? {},
        sort_social: sorts.sort_social ?? {},
        sort_rhythm: sorts.sort_rhythm ?? {},
        sort_politics: sorts.sort_politics ?? {},
        ...axes,
        dealbreakers,
        onboarded: true,
      })
      .eq('user_id', user.id)
    setBusy(false)
    if (error) return setError(error.message)
    navigate('/')
  }

  return (
    <div className="mx-auto max-w-xl px-6 py-10">
      <div className="mb-6">
        <p className="text-sm text-forest/60">Step {step + 1} of {steps.length}</p>
        <div className="mt-2 h-1.5 w-full rounded-full bg-forest/15">
          <div className="h-1.5 rounded-full bg-gold" style={{ width: `${((step + 1) / steps.length) * 100}%` }} />
        </div>
      </div>

      {current.kind === 'sort' && (
        <SortStep sort={current.sort} values={sorts[current.sort.key] || {}} onSet={setSortScore} />
      )}
      {current.kind === 'facts' && <FactsStep facts={facts} setFacts={setFacts} />}
      {current.kind === 'dealbreakers' && <DealbreakersStep selected={dealbreakers} onToggle={toggleDealbreaker} />}

      {error && <p className="mt-4 text-sm text-red-700">{error}</p>}

      <div className="mt-8 flex items-center justify-between">
        <button
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
          className="rounded-lg px-4 py-2 text-forest disabled:opacity-30"
        >
          Back
        </button>
        {isLast ? (
          <button onClick={handleFinish} disabled={busy} className="rounded-lg bg-forest px-5 py-2 font-medium text-cream disabled:opacity-50">
            {busy ? 'Saving…' : 'Finish'}
          </button>
        ) : (
          <button onClick={() => setStep((s) => s + 1)} className="rounded-lg bg-forest px-5 py-2 font-medium text-cream">
            Next
          </button>
        )}
      </div>
    </div>
  )
}
