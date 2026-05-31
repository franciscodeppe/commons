-- ============================================================
-- Commons — Phase 3: events attendance access + character drift
-- Run in Supabase → SQL Editor. Safe to re-run.
-- (The events / event_attendance tables already exist from Phase 1.)
-- ============================================================

-- 1. Let a group's organizer see and update attendance for that group's
--    events (to view RSVPs and mark people attended / no-show).
DROP POLICY IF EXISTS "attendance_select_organizer" ON event_attendance;
CREATE POLICY "attendance_select_organizer" ON event_attendance
  FOR SELECT USING (
    auth.uid() = (
      SELECT g.organizer_id FROM events e
      JOIN groups g ON g.id = e.group_id
      WHERE e.id = event_attendance.event_id
    )
  );

DROP POLICY IF EXISTS "attendance_update_organizer" ON event_attendance;
CREATE POLICY "attendance_update_organizer" ON event_attendance
  FOR UPDATE USING (
    auth.uid() = (
      SELECT g.organizer_id FROM events e
      JOIN groups g ON g.id = e.group_id
      WHERE e.id = event_attendance.event_id
    )
  );

-- 2. Character drift source: average the axis values of everyone who has
--    *attended* a group's events. SECURITY DEFINER so it can read profiles
--    without exposing individual rows — it returns only aggregates.
CREATE OR REPLACE FUNCTION public.group_attendance_axes(p_group_id bigint)
RETURNS TABLE (
  n          int,
  energy     numeric,
  drinking   numeric,
  size       numeric,
  commitment numeric,
  setting    numeric
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    count(*)::int,
    avg(pr.axis_energy),
    avg(pr.axis_drinking),
    avg(pr.axis_size),
    avg(pr.axis_commitment),
    avg(pr.axis_setting)
  FROM event_attendance ea
  JOIN events   e  ON e.id = ea.event_id
  JOIN profiles pr ON pr.user_id = ea.user_id
  WHERE e.group_id = p_group_id
    AND ea.status = 'attended';
$$;

GRANT EXECUTE ON FUNCTION public.group_attendance_axes(bigint) TO authenticated;
