-- ============================================================
-- Commons — god-user role (testing) + privilege-column hardening
-- Run in Supabase → SQL Editor. Safe to re-run.
-- ============================================================

-- 1. God flag (testing convenience: can auto-join groups without approval)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_god BOOLEAN DEFAULT FALSE;

CREATE OR REPLACE FUNCTION public.is_god()
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public
AS $$
  SELECT COALESCE((SELECT is_god FROM profiles WHERE user_id = auth.uid()), false);
$$;
GRANT EXECUTE ON FUNCTION public.is_god() TO authenticated;

-- 2. Let a god insert their OWN membership at any status (i.e. straight to
--    'member'). Normal users remain limited to 'pending' via members_request.
DROP POLICY IF EXISTS "members_god_join" ON group_members;
CREATE POLICY "members_god_join" ON group_members
  FOR INSERT WITH CHECK (auth.uid() = user_id AND public.is_god());

-- 3. Harden privilege columns. The profiles UPDATE policy allows a user to
--    edit their own row, but that (until now) let them set is_admin / is_god
--    on themselves via the API. Block client-side changes to those columns;
--    only the service_role / SQL editor may change them.
CREATE OR REPLACE FUNCTION public.protect_privilege_cols()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF COALESCE(auth.role(), '') IN ('authenticated', 'anon')
     AND (NEW.is_admin IS DISTINCT FROM OLD.is_admin
          OR NEW.is_god IS DISTINCT FROM OLD.is_god) THEN
    NEW.is_admin := OLD.is_admin;
    NEW.is_god := OLD.is_god;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_privilege_cols ON profiles;
CREATE TRIGGER trg_protect_privilege_cols
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION protect_privilege_cols();

-- ------------------------------------------------------------
-- Make a user a god (replace the email):
--   UPDATE profiles SET is_god = true
--   WHERE user_id = (SELECT id FROM auth.users WHERE email = 'user0@seed.commons.dev');
-- ------------------------------------------------------------
