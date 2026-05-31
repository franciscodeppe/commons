import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../utils/supabaseClient'
import { CATEGORIES, CHARACTER_AXES, PREDEFINED_TAGS, DEALBREAKERS } from '../../utils/constants'

export default function GroupCreate() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({
    name: '', description: '', primary_category: '', secondary_category: '',
    area_name: '', zip_code: '',
    char_energy: '', char_drinking: '', char_size: '', char_commitment: '', char_setting: '', char_worldview: '',
  })
  const [tags, setTags] = useState([])
  const [customTag, setCustomTag] = useState('')
  const [customTags, setCustomTags] = useState([])
  const [notFor, setNotFor] = useState([])
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const predefined = form.primary_category ? PREDEFINED_TAGS[form.primary_category] : []

  function toggle(list, setList, val) {
    setList(list.includes(val) ? list.filter((x) => x !== val) : [...list, val])
  }

  function addCustomTag() {
    const t = customTag.trim().toLowerCase()
    if (t && !customTags.includes(t) && !tags.includes(t)) setCustomTags([...customTags, t])
    setCustomTag('')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    if (form.secondary_category && form.secondary_category === form.primary_category) {
      return setError('Secondary category must differ from primary.')
    }
    setBusy(true)
    // Constrained char_* / category columns reject '' — coerce blanks to null.
    const cleaned = Object.fromEntries(
      Object.entries(form).map(([k, v]) => [k, v === '' ? null : v]),
    )
    const payload = {
      ...cleaned,
      organizer_id: user.id,
      not_for_tags: notFor,
    }
    const { data: group, error: gErr } = await supabase
      .from('groups')
      .insert(payload)
      .select()
      .single()
    if (gErr) { setBusy(false); return setError(gErr.message) }

    const tagRows = [
      ...tags.map((t) => ({ group_id: group.id, tag: t, type: 'predefined' })),
      ...customTags.map((t) => ({ group_id: group.id, tag: t, type: 'custom' })),
    ]
    if (tagRows.length) {
      const { error: tErr } = await supabase.from('group_tags').insert(tagRows)
      if (tErr) { setBusy(false); return setError(tErr.message) }
    }
    setBusy(false)
    navigate(`/groups/${group.id}`)
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-2xl px-6 py-10 space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-forest">Start a group</h1>
        <p className="text-forest/70">Declare who it’s for. Honesty here is what makes the matching honest.</p>
      </div>

      <section className="space-y-4">
        <Text label="Group name" value={form.name} onChange={set('name')} required />
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-forest">Description</span>
          <textarea value={form.description} onChange={set('description')} rows={3} className="w-full rounded-lg border border-forest/20 bg-white px-3 py-2 outline-none focus:border-forest" />
        </label>
        <div className="grid grid-cols-2 gap-4">
          <Select label="Primary category" value={form.primary_category} onChange={set('primary_category')} options={CATEGORIES.map((c) => ({ value: c.key, label: c.label }))} required />
          <Select label="Secondary (optional)" value={form.secondary_category} onChange={set('secondary_category')} options={CATEGORIES.filter((c) => c.key !== form.primary_category).map((c) => ({ value: c.key, label: c.label }))} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Text label="Area name" value={form.area_name} onChange={set('area_name')} placeholder="e.g. Pasadena" />
          <Text label="Zip code" value={form.zip_code} onChange={set('zip_code')} />
        </div>
      </section>

      <section>
        <h2 className="mb-1 text-lg font-semibold text-forest">Character</h2>
        <p className="mb-4 text-sm text-forest/60">Where does this group actually land?</p>
        <div className="grid grid-cols-2 gap-4">
          {CHARACTER_AXES.map((axis) => (
            <Select
              key={axis.key}
              label={axis.label}
              value={form[axis.key]}
              onChange={set(axis.key)}
              options={axis.options.map((o) => ({ value: o.value, label: o.label }))}
            />
          ))}
        </div>
      </section>

      {form.primary_category && (
        <section>
          <h2 className="mb-3 text-lg font-semibold text-forest">Tags</h2>
          <div className="flex flex-wrap gap-2">
            {predefined.map((t) => (
              <button type="button" key={t} onClick={() => toggle(tags, setTags, t)}
                className={`rounded-full border px-3 py-1 text-sm ${tags.includes(t) ? 'border-forest bg-forest text-cream' : 'border-forest/25 text-forest'}`}>
                {t}
              </button>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <input value={customTag} onChange={(e) => setCustomTag(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomTag() } }}
              placeholder="Add a custom tag" className="flex-1 rounded-lg border border-forest/20 bg-white px-3 py-2 text-sm outline-none focus:border-forest" />
            <button type="button" onClick={addCustomTag} className="rounded-lg border border-forest/30 px-3 text-sm text-forest">Add</button>
          </div>
          {customTags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {customTags.map((t) => (
                <span key={t} className="rounded-full bg-gold/20 px-3 py-1 text-sm text-forest">
                  {t} <button type="button" onClick={() => setCustomTags(customTags.filter((x) => x !== t))} className="ml-1">×</button>
                </span>
              ))}
            </div>
          )}
        </section>
      )}

      <section>
        <h2 className="mb-1 text-lg font-semibold text-forest">This group is <em>not</em> for…</h2>
        <p className="mb-3 text-sm text-forest/60">Declaring hard edges keeps the wrong people from joining — and protects the people who belong.</p>
        <div className="flex flex-wrap gap-2">
          {DEALBREAKERS.map((d) => (
            <button type="button" key={d.token} onClick={() => toggle(notFor, setNotFor, d.token)}
              className={`rounded-full border px-3 py-1 text-sm ${notFor.includes(d.token) ? 'border-gold bg-gold/20 text-forest' : 'border-forest/25 text-forest'}`}>
              {d.label}
            </button>
          ))}
        </div>
      </section>

      {error && <p className="text-sm text-red-700">{error}</p>}

      <button type="submit" disabled={busy} className="rounded-lg bg-forest px-6 py-2.5 font-medium text-cream disabled:opacity-50">
        {busy ? 'Creating…' : 'Create group'}
      </button>
    </form>
  )
}

function Text({ label, value, onChange, required, placeholder }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-forest">{label}</span>
      <input value={value} onChange={onChange} required={required} placeholder={placeholder} className="w-full rounded-lg border border-forest/20 bg-white px-3 py-2 outline-none focus:border-forest" />
    </label>
  )
}

function Select({ label, value, onChange, options, required }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-forest">{label}</span>
      <select value={value} onChange={onChange} required={required} className="w-full rounded-lg border border-forest/20 bg-white px-3 py-2 outline-none focus:border-forest">
        <option value="">—</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  )
}
