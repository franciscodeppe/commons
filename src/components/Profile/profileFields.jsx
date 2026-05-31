import { LIFE_STAGES, EDUCATION, SPEND_COMFORT, DEALBREAKERS, DEALBREAKER_CAP } from '../../utils/constants'

export const SCORE_OPTIONS = [
  { v: 0, label: 'Not me' },
  { v: 1, label: 'Sometimes' },
  { v: 2, label: 'Very me' },
]

export function SortStep({ sort, values, onSet }) {
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
                  type="button"
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

export function FactsStep({ facts, setFacts }) {
  const set = (k) => (e) => setFacts((f) => ({ ...f, [k]: e.target.value }))
  return (
    <div>
      <h2 className="mb-5 text-xl font-semibold text-forest">A few facts</h2>
      <div className="space-y-4">
        <Select label="Life stage" value={facts.life_stage} onChange={set('life_stage')} options={LIFE_STAGES} />
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-forest">Work / field</span>
          <input value={facts.work_field ?? ''} onChange={set('work_field')} className="w-full rounded-lg border border-forest/20 bg-white px-3 py-2 outline-none focus:border-forest" />
        </label>
        <Select label="Education" value={facts.education} onChange={set('education')} options={EDUCATION} />
        <Select label="Spend comfort for an outing" value={facts.spend_comfort} onChange={set('spend_comfort')} options={SPEND_COMFORT} />
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-forest">Short bio</span>
          <textarea value={facts.bio ?? ''} onChange={set('bio')} rows={3} className="w-full rounded-lg border border-forest/20 bg-white px-3 py-2 outline-none focus:border-forest" />
        </label>
      </div>
    </div>
  )
}

export function DealbreakersStep({ selected, onToggle }) {
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
                type="button"
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

export function Select({ label, value, onChange, options }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-forest">{label}</span>
      <select value={value ?? ''} onChange={onChange} className="w-full rounded-lg border border-forest/20 bg-white px-3 py-2 outline-none focus:border-forest">
        <option value="">—</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  )
}
