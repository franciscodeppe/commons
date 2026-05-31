import { useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { supabase } from '../../utils/supabaseClient'

export default function EventCreate() {
  const { id } = useParams() // group id
  const navigate = useNavigate()
  const [form, setForm] = useState({
    title: '', description: '', event_date: '', event_time: '', location: '', capacity: '',
  })
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    const payload = {
      group_id: Number(id),
      title: form.title,
      description: form.description || null,
      event_date: form.event_date || null,
      event_time: form.event_time || null,
      location: form.location || null,
      capacity: form.capacity ? Number(form.capacity) : null,
    }
    const { error } = await supabase.from('events').insert(payload)
    setBusy(false)
    if (error) return setError(error.message)
    navigate(`/groups/${id}`)
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-xl px-6 py-10 space-y-5">
      <div>
        <Link to={`/groups/${id}`} className="text-sm text-forest/60 hover:text-forest">← Back to group</Link>
        <h1 className="mt-2 text-2xl font-semibold text-forest">New event</h1>
      </div>

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-forest">Title</span>
        <input value={form.title} onChange={set('title')} required className="w-full rounded-lg border border-forest/20 bg-white px-3 py-2 outline-none focus:border-forest" />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-forest">Description</span>
        <textarea value={form.description} onChange={set('description')} rows={3} className="w-full rounded-lg border border-forest/20 bg-white px-3 py-2 outline-none focus:border-forest" />
      </label>
      <div className="grid grid-cols-2 gap-4">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-forest">Date</span>
          <input type="date" value={form.event_date} onChange={set('event_date')} className="w-full rounded-lg border border-forest/20 bg-white px-3 py-2 outline-none focus:border-forest" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-forest">Time</span>
          <input type="time" value={form.event_time} onChange={set('event_time')} className="w-full rounded-lg border border-forest/20 bg-white px-3 py-2 outline-none focus:border-forest" />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-forest">Location</span>
          <input value={form.location} onChange={set('location')} className="w-full rounded-lg border border-forest/20 bg-white px-3 py-2 outline-none focus:border-forest" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-forest">Capacity</span>
          <input type="number" min="1" value={form.capacity} onChange={set('capacity')} className="w-full rounded-lg border border-forest/20 bg-white px-3 py-2 outline-none focus:border-forest" />
        </label>
      </div>

      {error && <p className="text-sm text-red-700">{error}</p>}
      <button type="submit" disabled={busy} className="rounded-lg bg-forest px-6 py-2.5 font-medium text-cream disabled:opacity-50">
        {busy ? 'Creating…' : 'Create event'}
      </button>
    </form>
  )
}
