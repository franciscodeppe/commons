-- ============================================================
-- Commons — managers/owners can remove members
-- Prereq: group_roles.sql. Run in Supabase → SQL Editor. Safe to re-run.
-- ============================================================

-- Managers can remove plain members; owners (and gods) can remove anyone.
-- (The existing members_leave policy still lets a user remove themselves.)
DROP POLICY IF EXISTS "members_manage_remove" ON group_members;
CREATE POLICY "members_manage_remove" ON group_members
  FOR DELETE USING (
    public.can_manage_group(group_id)
    AND (role = 'member' OR public.is_group_owner(group_id))
  );
