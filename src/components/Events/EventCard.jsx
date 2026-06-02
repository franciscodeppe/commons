import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../utils/supabaseClient'
import { fetchNames } from '../../utils/names'

const STATUS_LABEL = {
  rsvp_yes: 'Going',
  rsvp_no: 'Not going',
  attended: 'Attended',
  no_show: 'No-show',
}

function formatWhen(e) {
  if (!e.event_date) return 'Date TBD'
  const d = new Date(`${e.event_date}T${e.event_time || '00:00'}`)
  const date = d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
  return e.event_time ? `${date} · ${e.event_time.slice(0, 5)}` : date
}

export default function EventCard({ event, isOrganizer, userId, onAttendanceChange }) {
  const [myStatus, setMyStatus] = useState(null)
  const [attendees, setAttendees] = useState([])
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const { data: mine } = await supabase
      .from('event_attendance')
      .select('status')
      .eq('event_id', event.id)
      .eq('user_id', userId)
      .maybeSingle()
    setMyStatus(mine?.status ?? null)

    if (isOrganizer) {
      const { data: rows } = await supabase
        .from('event_attendance')
        .select('id, user_id, status')
        .eq('event_id', event.id)
      const names = await fetchNames((rows ?? []).map((r) => r.user_id))
      setAttendees((rows ?? []).map((r) => ({
        ...r,
        username: names[r.user_id]?.username,
        realName: names[r.user_id]?.realName,
      })))
    }
  }, [event.id, userId, isOrganizer])

  useEffect(() => { load() }, [load])

  async function rsvp(status) {
    setBusy(true)
    await supabase
      .from('event_attendance')
      .upsert({ event_id: event.id, user_id: userId, status }, { onConflict: 'event_id,user_id' })
    setBusy(false)
    load()
  }

  async function mark(rowId, status) {
    setBusy(true)
    await supabase.from('event_attendance').update({ status }).eq('id', rowId)
    setBusy(false)
    await load()
    onAttendanceChange?.() // drift may have changed
  }

  const goingCount = attendees.filter((a) => a.status === 'rsvp_yes' || a.status === 'attended').length

  return (
    <div className="rounded-xl border border-forest/15 bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-forest">{event.title}</h3>
          <p className="text-sm text-forest/60">{formatWhen(event)}{event.location ? ` · ${event.location}` : ''}</p>
        </div>
        {isOrganizer && <span className="shrink-0 text-xs text-forest/50">{goingCount} going</span>}
      </div>
      {event.description && <p className="mt-2 text-sm text-forest/75">{event.description}</p>}

      {!isOrganizer && (
        <div className="mt-4 flex items-center gap-2">
          <button
            onClick={() => rsvp('rsvp_yes')}
            disabled={busy}
            className={`rounded-md border px-3 py-1.5 text-sm ${myStatus === 'rsvp_yes' || myStatus === 'attended' ? 'border-forest bg-forest text-cream' : 'border-forest/25 text-forest'}`}
          >
            Going
          </button>
          <button
            onClick={() => rsvp('rsvp_no')}
            disabled={busy}
            className={`rounded-md border px-3 py-1.5 text-sm ${myStatus === 'rsvp_no' ? 'border-forest bg-forest text-cream' : 'border-forest/25 text-forest'}`}
          >
            Can’t make it
          </button>
          {myStatus === 'attended' && <span className="text-xs font-medium text-forest/70">✓ marked attended</span>}
        </div>
      )}

      {isOrganizer && (
        <div className="mt-4 border-t border-forest/10 pt-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-forest/50">RSVPs &amp; attendance</p>
          {attendees.length === 0 ? (
            <p className="text-sm text-forest/50">No RSVPs yet.</p>
          ) : (
            <ul className="space-y-2">
              {attendees.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-2">
                  <span className="text-sm text-forest">
                    {a.realName ? `${a.username} · ${a.realName}` : (a.username || 'member')} <span className="text-forest/45">· {STATUS_LABEL[a.status] || a.status}</span>
                  </span>
                  <div className="flex gap-1">
                    <button onClick={() => mark(a.id, 'attended')} disabled={busy || a.status === 'attended'} className="rounded border border-forest/30 px-2 py-0.5 text-xs text-forest disabled:opacity-40">Attended</button>
                    <button onClick={() => mark(a.id, 'no_show')} disabled={busy || a.status === 'no_show'} className="rounded border border-forest/30 px-2 py-0.5 text-xs text-forest disabled:opacity-40">No-show</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
