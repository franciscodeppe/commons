-- ============================================================
-- Commons — Admin role + profile privacy boundary
-- Run in Supabase → SQL Editor. Safe to re-run.
-- ============================================================

-- 1. Admin flag on profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;

-- 2. Admin check helper.
-- SECURITY DEFINER so the inner read bypasses RLS — this avoids the
-- infinite-recursion trap of querying `profiles` inside a `profiles` policy.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE((SELECT is_admin FROM profiles WHERE user_id = auth.uid()), false);
$$;

-- 3. Tighten profile reads: only the owner or an admin can read a full
--    profile row (sorts, dealbreakers, facts). Replaces the open policy.
DROP POLICY IF EXISTS "profiles_select_authed"        ON profiles;
DROP POLICY IF EXISTS "profiles_select_own"           ON profiles;
DROP POLICY IF EXISTS "profiles_select_own_or_admin"  ON profiles;

CREATE POLICY "profiles_select_own_or_admin" ON profiles
  FOR SELECT USING (auth.uid() = user_id OR public.is_admin());

-- 4. Public name directory: exposes ONLY user_id + display_name so member
--    lists and join-request panels can show names without leaking the rest
--    of the profile. As a (default) security-definer view it bypasses the
--    profiles RLS, so we restrict access via GRANTs instead.
CREATE OR REPLACE VIEW public.member_directory AS
  SELECT user_id, display_name FROM public.profiles;

REVOKE ALL ON public.member_directory FROM anon;
GRANT SELECT ON public.member_directory TO authenticated;

-- ------------------------------------------------------------
-- 5. Make yourself an admin (replace the email):
--
--   UPDATE profiles SET is_admin = true
--   WHERE user_id = (SELECT id FROM auth.users WHERE email = 'you@example.com');
-- ------------------------------------------------------------
