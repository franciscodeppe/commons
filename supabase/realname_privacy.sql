-- ============================================================
-- Commons — real-name visibility (per-audience)
-- Prereq: usernames.sql, group_roles.sql. Safe to re-run.
-- ============================================================

-- 1. Per-audience toggles (default false = fully private).
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS realname_to_everyone   BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS realname_to_comembers  BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS realname_to_organizers BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS realname_to_friends    BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Resolve usernames + (conditionally) real names for a set of users,
--    based on the viewer's relationship to each target.
--    real_name is returned only when the viewer qualifies; else NULL.
--    (The friends audience is wired in once the friends graph exists.)
CREATE OR REPLACE FUNCTION public.visible_names(p_ids uuid[])
RETURNS TABLE (user_id uuid, username text, real_name text)
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT
    pr.user_id,
    pr.username,
    CASE WHEN
      pr.user_id = auth.uid()
      OR pr.realname_to_everyone
      OR (pr.realname_to_comembers AND EXISTS (
            SELECT 1 FROM group_members gm1
            JOIN group_members gm2 ON gm2.group_id = gm1.group_id
            WHERE gm1.user_id = auth.uid() AND gm1.status = 'member'
              AND gm2.user_id = pr.user_id AND gm2.status = 'member'))
      OR (pr.realname_to_organizers AND EXISTS (
            SELECT 1 FROM group_members gm
            WHERE gm.user_id = pr.user_id AND gm.status = 'member'
              AND public.can_manage_group(gm.group_id)))
    THEN pr.display_name ELSE NULL END AS real_name
  FROM profiles pr
  WHERE pr.user_id = ANY (p_ids);
$$;
GRANT EXECUTE ON FUNCTION public.visible_names(uuid[]) TO authenticated;

-- 3. Stop exposing real names through the broad directory — username only.
DROP VIEW IF EXISTS public.member_directory;
CREATE VIEW public.member_directory AS
  SELECT user_id, username FROM public.profiles;
REVOKE ALL ON public.member_directory FROM anon;
GRANT SELECT ON public.member_directory TO authenticated;
