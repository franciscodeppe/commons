import { useEffect, useState } from 'react'
import { supabase } from '../../utils/supabaseClient'
import EventCard from './EventCard'

export default function EventList({ groupId, isOrganizer, userId, onAttendanceChange }) {
  const [events, setEvents] = useState(null)

  useEffect(() => {
    ;(async () => {
      const { data } = await supabase
        .from('events')
        .select('*')
        .eq('group_id', groupId)
        .order('event_date', { ascending: true, nullsFirst: false })
      setEvents(data ?? [])
    })()
  }, [groupId])

  if (events === null) return null
  if (events.length === 0) return <p className="text-sm text-forest/50">No events scheduled yet.</p>

  return (
    <div className="space-y-3">
      {events.map((e) => (
        <EventCard
          key={e.id}
          event={e}
          isOrganizer={isOrganizer}
          userId={userId}
          onAttendanceChange={onAttendanceChange}
        />
      ))}
    </div>
  )
}
