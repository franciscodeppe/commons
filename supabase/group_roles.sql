-- ============================================================
-- Commons — per-group roles (organizer / manager / member)
-- Prereq: god_user.sql (is_god) already run.
-- Run in Supabase → SQL Editor. Safe to re-run.
-- ============================================================

-- 1. Role column on memberships
ALTER TABLE group_members
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'member';
DO $$ BEGIN
  ALTER TABLE group_members ADD CONSTRAINT group_members_role_check
    CHECK (role IN ('member', 'manager', 'organizer'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Permission helpers (SECURITY DEFINER to avoid RLS recursion).
--    Owner = the creator, a god, or a member with the 'organizer' role.
--    Manage = owner, a god, or a member with 'manager'/'organizer'.
CREATE OR REPLACE FUNCTION public.is_group_owner(gid bigint)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT public.is_god()
    OR EXISTS (SELECT 1 FROM groups WHERE id = gid AND organizer_id = auth.uid())
    OR EXISTS (SELECT 1 FROM group_members
               WHERE group_id = gid AND user_id = auth.uid()
                 AND status = 'member' AND role = 'organizer');
$$;

CREATE OR REPLACE FUNCTION public.can_manage_group(gid bigint)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT public.is_god()
    OR EXISTS (SELECT 1 FROM groups WHERE id = gid AND organizer_id = auth.uid())
    OR EXISTS (SELECT 1 FROM group_members
               WHERE group_id = gid AND user_id = auth.uid()
                 AND status = 'member' AND role IN ('manager', 'organizer'));
$$;

GRANT EXECUTE ON FUNCTION public.is_group_owner(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_group(bigint) TO authenticated;

-- 3. Managers (and owners/gods) can approve/decline requests.
DROP POLICY IF EXISTS "members_organizer_update" ON group_members;
DROP POLICY IF EXISTS "members_manage_update" ON group_members;
CREATE POLICY "members_manage_update" ON group_members
  FOR UPDATE USING (public.can_manage_group(group_id));

-- 4. Only an owner may set/raise a member's role; non-owners are pinned to
--    'member' on insert and can't change role on update. (Gods are owners.)
CREATE OR REPLACE FUNCTION public.enforce_member_role()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF COALESCE(auth.role(), '') IN ('authenticated', 'anon')
     AND NOT public.is_group_owner(NEW.group_id) THEN
    IF TG_OP = 'INSERT' THEN
      NEW.role := 'member';
    ELSE
      NEW.role := OLD.role;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_member_role ON group_members;
CREATE TRIGGER trg_enforce_member_role
  BEFORE INSERT OR UPDATE ON group_members
  FOR EACH ROW EXECUTE FUNCTION enforce_member_role();

-- 5. Managers/owners/gods manage events (was creator-only).
DROP POLICY IF EXISTS "events_manage_organizer" ON events;
DROP POLICY IF EXISTS "events_manage" ON events;
CREATE POLICY "events_manage" ON events
  FOR ALL
  USING (public.can_manage_group(group_id))
  WITH CHECK (public.can_manage_group(group_id));

-- 6. Owners/gods manage group identity (name, character, tags) + delete.
DROP POLICY IF EXISTS "groups_update_own" ON groups;
DROP POLICY IF EXISTS "groups_update_owner" ON groups;
CREATE POLICY "groups_update_owner" ON groups
  FOR UPDATE USING (public.is_group_owner(id));

DROP POLICY IF EXISTS "groups_delete_own" ON groups;
DROP POLICY IF EXISTS "groups_delete_owner" ON groups;
CREATE POLICY "groups_delete_owner" ON groups
  FOR DELETE USING (public.is_group_owner(id));

DROP POLICY IF EXISTS "tags_manage_organizer" ON group_tags;
DROP POLICY IF EXISTS "tags_manage_owner" ON group_tags;
CREATE POLICY "tags_manage_owner" ON group_tags
  FOR ALL USING (public.is_group_owner(group_id));
