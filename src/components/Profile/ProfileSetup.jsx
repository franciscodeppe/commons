import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../utils/supabaseClient'
import { deriveAxes } from '../../utils/matchingLogic'
import {
  SORTS, LIFE_STAGES, EDUCATION, SPEND_COMFORT, DEALBREAKERS, DEALBREAKER_CAP,
} from '../../utils/constants'

const SCORE_OPTIONS = [
  { v: 0, label: 'Not me' },
  { v: 1, label: 'Sometimes' },
  { v: 2, label: 'Very me' },
]

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

      {current.kind === 'facts' && (
        <FactsStep facts={facts} setFacts={setFacts} />
      )}

      {current.kind === 'dealbreakers' && (
        <DealbreakersStep selected={dealbreakers} onToggle={toggleDealbreaker} />
      )}

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

function SortStep({ sort, values, onSet }) {
  return (
    <div>
      <h2 className="text-xl font-semibold text-forest">{sort.title}</h2>
      <p className="mb-5 text-forest/70">{sort.prompt}</p>
      <ul className="space-y-3">
        {sort.items.map((item, idx) => (
          <li key={idx} className="rounded-lg border border-forest/15 bg-white p-3">
            <p className="mb-2 font-medium text-forest">{item}</p>
            <div className="flex gap-2">
              {SCORE_OPTIONS.map((opt) => (
                <button
                  key={opt.v}
                  onClick={() => onSet(sort.key, idx, opt.v)}
                  className={`flex-1 rounded-md border px-2 py-1.5 text-sm ${
                    values[idx] === opt.v
                      ? 'border-forest bg-forest text-cream'
                      : 'border-forest/20 text-forest hover:border-forest/50'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

function FactsStep({ facts, setFacts }) {
  const set = (k) => (e) => setFacts((f) => ({ ...f, [k]: e.target.value }))
  return (
    <div>
      <h2 className="mb-5 text-xl font-semibold text-forest">A few facts</h2>
      <div className="space-y-4">
        <Select label="Life stage" value={facts.life_stage} onChange={set('life_stage')} options={LIFE_STAGES} />
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-forest">Work / field</span>
          <input value={facts.work_field} onChange={set('work_field')} className="w-full rounded-lg border border-forest/20 bg-white px-3 py-2 outline-none focus:border-forest" />
        </label>
        <Select label="Education" value={facts.education} onChange={set('education')} options={EDUCATION} />
        <Select label="Spend comfort for an outing" value={facts.spend_comfort} onChange={set('spend_comfort')} options={SPEND_COMFORT} />
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-forest">Short bio</span>
          <textarea value={facts.bio} onChange={set('bio')} rows={3} className="w-full rounded-lg border border-forest/20 bg-white px-3 py-2 outline-none focus:border-forest" />
        </label>
      </div>
    </div>
  )
}

function DealbreakersStep({ selected, onToggle }) {
  return (
    <div>
      <h2 className="text-xl font-semibold text-forest">Dealbreakers</h2>
      <p className="mb-5 text-forest/70">Pick up to {DEALBREAKER_CAP} hard no’s. These veto a group, no matter how well it fits otherwise.</p>
      <ul className="space-y-2">
        {DEALBREAKERS.map((d) => {
          const on = selected.includes(d.token)
          const atCap = !on && selected.length >= DEALBREAKER_CAP
          return (
            <li key={d.token}>
              <button
                onClick={() => onToggle(d.token)}
                disabled={atCap}
                className={`w-full rounded-lg border px-4 py-3 text-left ${
                  on ? 'border-gold bg-gold/15 text-forest' : 'border-forest/20 text-forest hover:border-forest/50'
                } ${atCap ? 'opacity-40' : ''}`}
              >
                {d.label}
              </button>
            </li>
          )
        })}
      </ul>
      <p className="mt-3 text-sm text-forest/50">{selected.length}/{DEALBREAKER_CAP} selected</p>
    </div>
  )
}

function Select({ label, value, onChange, options }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-forest">{label}</span>
      <select value={value} onChange={onChange} className="w-full rounded-lg border border-forest/20 bg-white px-3 py-2 outline-none focus:border-forest">
        <option value="">—</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  )
}
