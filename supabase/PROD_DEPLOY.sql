-- ============================================================
-- Commons — PRODUCTION deploy migration (run ALL, in order)
-- Run this on the PRODUCTION Supabase project BEFORE deploying.
-- Every statement is idempotent; safe even if some already ran.
-- ============================================================

-- ==================== schema.sql ====================
-- ============================================================
-- Commons — Phase 1 Schema
-- Run this in Supabase → SQL Editor → New Query.
-- Safe to re-run: drops/recreates policies and triggers idempotently.
-- ============================================================

-- ------------------------------------------------------------
-- 1. profiles  (extends auth.users)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  display_name TEXT,

  -- facts layer
  life_stage    TEXT CHECK (life_stage IN ('single','partnered','parent_young','parent_old','empty_nest','retired')),
  work_field    TEXT,
  education     TEXT CHECK (education IN ('high_school','some_college','bachelors','postgrad','self_taught')),
  spend_comfort TEXT CHECK (spend_comfort IN ('coffee','dinner','weekend')),

  -- the sorts (JSON map of {item_index: score} where score is 0,1,2)
  sort_taste    JSONB,
  sort_humor    JSONB,
  sort_social   JSONB,
  sort_rhythm   JSONB,
  sort_politics JSONB,

  -- derived axis scores (computed from the sorts)
  axis_energy     NUMERIC,  -- low (-1) .. high (+1)
  axis_drinking   NUMERIC,  -- sober (-1) .. heavy (+1)
  axis_size       NUMERIC,  -- small (-1) .. large (+1)
  axis_commitment NUMERIC,  -- regulars (-1) .. drop-in (+1)
  axis_setting    NUMERIC,  -- outdoors (-1) .. venue (+1)
  axis_worldview  TEXT CHECK (axis_worldview IN ('aligned','mixed','aside')),

  -- dealbreakers, e.g. ['drinking:heavy','size:large']
  dealbreakers TEXT[],

  bio TEXT,
  onboarded BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_own"   ON profiles;
DROP POLICY IF EXISTS "profiles_select_authed" ON profiles;
DROP POLICY IF EXISTS "profiles_update_own"   ON profiles;
DROP POLICY IF EXISTS "profiles_insert_own"   ON profiles;

-- Any logged-in user can read profiles (needed for member lists, join-request
-- panels, and Phase 2 browse/match). Anonymous visitors cannot.
CREATE POLICY "profiles_select_authed" ON profiles
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "profiles_insert_own" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Auto-create an (empty) profile row when a user signs up, copying the
-- display name from signup metadata if present. Runs as definer to bypass RLS.
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'display_name')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ------------------------------------------------------------
-- 2. groups
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS groups (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  organizer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  name TEXT NOT NULL,
  description TEXT,

  primary_category   TEXT NOT NULL CHECK (primary_category IN ('move','learn','play','belong')),
  secondary_category TEXT CHECK (secondary_category IN ('move','learn','play','belong')),
  CONSTRAINT secondary_differs CHECK (secondary_category IS NULL OR secondary_category <> primary_category),

  zip_code  TEXT,
  area_name TEXT,

  char_energy     TEXT CHECK (char_energy     IN ('low','balanced','high')),
  char_drinking   TEXT CHECK (char_drinking   IN ('sober','social','heavy')),
  char_size       TEXT CHECK (char_size       IN ('small','large')),
  char_commitment TEXT CHECK (char_commitment IN ('regulars','dropin')),
  char_setting    TEXT CHECK (char_setting    IN ('outdoors','indoors','venue')),
  char_worldview  TEXT CHECK (char_worldview  IN ('aligned','mixed','aside')),

  not_for_tags TEXT[],

  member_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_groups_organizer        ON groups(organizer_id);
CREATE INDEX IF NOT EXISTS idx_groups_primary_category ON groups(primary_category);

ALTER TABLE groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "groups_select_all"    ON groups;
DROP POLICY IF EXISTS "groups_insert_own"    ON groups;
DROP POLICY IF EXISTS "groups_update_own"    ON groups;
DROP POLICY IF EXISTS "groups_delete_own"    ON groups;

CREATE POLICY "groups_select_all" ON groups
  FOR SELECT USING (TRUE);
CREATE POLICY "groups_insert_own" ON groups
  FOR INSERT WITH CHECK (auth.uid() = organizer_id);
CREATE POLICY "groups_update_own" ON groups
  FOR UPDATE USING (auth.uid() = organizer_id);
CREATE POLICY "groups_delete_own" ON groups
  FOR DELETE USING (auth.uid() = organizer_id);

-- ------------------------------------------------------------
-- 3. events
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS events (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  group_id BIGINT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,

  title TEXT NOT NULL,
  description TEXT,
  event_date DATE,
  event_time TIME,
  location TEXT,
  capacity INT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_group ON events(group_id);

ALTER TABLE events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "events_select_all"      ON events;
DROP POLICY IF EXISTS "events_manage_organizer" ON events;

CREATE POLICY "events_select_all" ON events
  FOR SELECT USING (TRUE);
CREATE POLICY "events_manage_organizer" ON events
  FOR ALL USING (auth.uid() = (SELECT organizer_id FROM groups WHERE id = group_id));

-- ------------------------------------------------------------
-- 4. event_attendance
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS event_attendance (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  event_id BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id  UUID   NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  status TEXT CHECK (status IN ('rsvp_yes','rsvp_no','attended','no_show')),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_attendance_event ON event_attendance(event_id);
CREATE INDEX IF NOT EXISTS idx_attendance_user  ON event_attendance(user_id);

ALTER TABLE event_attendance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "attendance_select_own" ON event_attendance;
DROP POLICY IF EXISTS "attendance_insert_own" ON event_attendance;
DROP POLICY IF EXISTS "attendance_update_own" ON event_attendance;

CREATE POLICY "attendance_select_own" ON event_attendance
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "attendance_insert_own" ON event_attendance
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "attendance_update_own" ON event_attendance
  FOR UPDATE USING (auth.uid() = user_id);

-- ------------------------------------------------------------
-- 5. group_members
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS group_members (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  group_id BIGINT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id  UUID   NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  status TEXT CHECK (status IN ('member','pending','declined')),

  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_members_group ON group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_members_user  ON group_members(user_id);

ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members_select_all"      ON group_members;
DROP POLICY IF EXISTS "members_request"         ON group_members;
DROP POLICY IF EXISTS "members_organizer_update" ON group_members;
DROP POLICY IF EXISTS "members_leave"           ON group_members;

CREATE POLICY "members_select_all" ON group_members
  FOR SELECT USING (TRUE);
-- a user may create only their own row, and only as 'pending'
CREATE POLICY "members_request" ON group_members
  FOR INSERT WITH CHECK (auth.uid() = user_id AND status = 'pending');
-- the group's organizer may approve/decline (update status)
CREATE POLICY "members_organizer_update" ON group_members
  FOR UPDATE USING (auth.uid() = (SELECT organizer_id FROM groups WHERE id = group_id));
-- a user may withdraw their own request/membership
CREATE POLICY "members_leave" ON group_members
  FOR DELETE USING (auth.uid() = user_id);

-- Keep groups.member_count in sync with approved members.
CREATE OR REPLACE FUNCTION recount_group_members()
RETURNS TRIGGER AS $$
DECLARE
  gid BIGINT := COALESCE(NEW.group_id, OLD.group_id);
BEGIN
  UPDATE groups
  SET member_count = (
    SELECT COUNT(*) FROM group_members
    WHERE group_id = gid AND status = 'member'
  )
  WHERE id = gid;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_recount_members ON group_members;
CREATE TRIGGER trg_recount_members
  AFTER INSERT OR UPDATE OR DELETE ON group_members
  FOR EACH ROW EXECUTE FUNCTION recount_group_members();

-- ------------------------------------------------------------
-- 6. group_tags
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS group_tags (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  group_id BIGINT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  tag  TEXT NOT NULL,
  type TEXT CHECK (type IN ('predefined','custom')),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_id, tag)
);

CREATE INDEX IF NOT EXISTS idx_tags_group ON group_tags(group_id);
CREATE INDEX IF NOT EXISTS idx_tags_tag   ON group_tags(tag);

ALTER TABLE group_tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tags_select_all"       ON group_tags;
DROP POLICY IF EXISTS "tags_manage_organizer" ON group_tags;

CREATE POLICY "tags_select_all" ON group_tags
  FOR SELECT USING (TRUE);
CREATE POLICY "tags_manage_organizer" ON group_tags
  FOR ALL USING (auth.uid() = (SELECT organizer_id FROM groups WHERE id = group_id));

-- ------------------------------------------------------------
-- updated_at auto-touch
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_touch_profiles ON profiles;
CREATE TRIGGER trg_touch_profiles BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS trg_touch_groups ON groups;
CREATE TRIGGER trg_touch_groups BEFORE UPDATE ON groups
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS trg_touch_events ON events;
CREATE TRIGGER trg_touch_events BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- ============================================================
-- Phase 2 placeholder: match_groups_for_user()
-- The spec's version is known-simplified and has a type bug
-- (numeric axes vs text traits). We'll build the real scorer in
-- Phase 2, so it is intentionally omitted here.
-- ============================================================

-- ==================== admin_and_privacy.sql ====================
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

-- ==================== phase3_events.sql ====================
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

-- ==================== god_user.sql ====================
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

-- ==================== group_roles.sql ====================
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

-- ==================== member_removal.sql ====================
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

-- ==================== usernames.sql ====================
-- ============================================================
-- Commons — usernames (public handle)
-- Run in Supabase → SQL Editor. Safe to re-run.
-- ============================================================

-- 1. Column + format + uniqueness (3–20 chars: a-z, 0-9, underscore)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS username TEXT;

DO $$ BEGIN
  ALTER TABLE profiles ADD CONSTRAINT profiles_username_format
    CHECK (username IS NULL OR username ~ '^[a-z0-9_]{3,20}$');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_unique ON profiles (username);

-- 2. Backfill. Seeded users (user0@seed…) get their clean local part.
UPDATE profiles p SET username = split_part(u.email, '@', 1)
FROM auth.users u
WHERE u.id = p.user_id AND p.username IS NULL
  AND split_part(u.email, '@', 1) ~ '^[a-z0-9_]{3,20}$'
  AND NOT EXISTS (SELECT 1 FROM profiles p2 WHERE p2.username = split_part(u.email, '@', 1));

-- Everyone else: sanitized local part + id fragment (guaranteed unique).
UPDATE profiles p SET username =
  left(regexp_replace(lower(split_part(u.email, '@', 1)), '[^a-z0-9_]+', '_', 'g'), 12)
    || '_' || left(replace(p.user_id::text, '-', ''), 6)
FROM auth.users u
WHERE u.id = p.user_id AND p.username IS NULL;

-- 3. Signup trigger now also sets username (falls back to a unique handle).
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, username)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'display_name',
    COALESCE(
      NULLIF(lower(NEW.raw_user_meta_data->>'username'), ''),
      'user_' || left(replace(NEW.id::text, '-', ''), 8)
    )
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Expose username publicly via the directory (display_name still here for
--    now; it gets gated in the real-name-privacy step).
-- DROP + CREATE (CREATE OR REPLACE can't reorder existing view columns).
DROP VIEW IF EXISTS public.member_directory;
CREATE VIEW public.member_directory AS
  SELECT user_id, username, display_name FROM public.profiles;
REVOKE ALL ON public.member_directory FROM anon;
GRANT SELECT ON public.member_directory TO authenticated;

-- ==================== realname_privacy.sql ====================
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

-- ==================== friends.sql ====================
-- ============================================================
-- Commons — friends (mutual request / accept)
-- Prereq: realname_privacy.sql. Safe to re-run.
-- ============================================================

CREATE TABLE IF NOT EXISTS friendships (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  requester_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  addressee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT friendships_no_self CHECK (requester_id <> addressee_id)
);

-- One row per pair, regardless of who asked.
CREATE UNIQUE INDEX IF NOT EXISTS friendships_pair_unique
  ON friendships (LEAST(requester_id, addressee_id), GREATEST(requester_id, addressee_id));
CREATE INDEX IF NOT EXISTS idx_friendships_requester ON friendships(requester_id);
CREATE INDEX IF NOT EXISTS idx_friendships_addressee ON friendships(addressee_id);

ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS friendships_select ON friendships;
CREATE POLICY friendships_select ON friendships
  FOR SELECT USING (auth.uid() IN (requester_id, addressee_id));

DROP POLICY IF EXISTS friendships_insert ON friendships;
CREATE POLICY friendships_insert ON friendships
  FOR INSERT WITH CHECK (auth.uid() = requester_id AND status = 'pending');

-- Only the addressee accepts (status -> accepted).
DROP POLICY IF EXISTS friendships_update ON friendships;
CREATE POLICY friendships_update ON friendships
  FOR UPDATE USING (auth.uid() = addressee_id) WITH CHECK (auth.uid() = addressee_id);

-- Either party can remove (decline / cancel / unfriend).
DROP POLICY IF EXISTS friendships_delete ON friendships;
CREATE POLICY friendships_delete ON friendships
  FOR DELETE USING (auth.uid() IN (requester_id, addressee_id));

-- Accepted-friendship check (either direction).
CREATE OR REPLACE FUNCTION public.are_friends(a uuid, b uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM friendships
    WHERE status = 'accepted'
      AND ((requester_id = a AND addressee_id = b) OR (requester_id = b AND addressee_id = a))
  );
$$;
GRANT EXECUTE ON FUNCTION public.are_friends(uuid, uuid) TO authenticated;

-- Activate the "friends" audience in real-name visibility.
CREATE OR REPLACE FUNCTION public.visible_names(p_ids uuid[])
RETURNS TABLE (user_id uuid, username text, real_name text)
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT pr.user_id, pr.username,
    CASE WHEN
      pr.user_id = auth.uid()
      OR pr.realname_to_everyone
      OR (pr.realname_to_comembers AND EXISTS (
            SELECT 1 FROM group_members gm1 JOIN group_members gm2 ON gm2.group_id = gm1.group_id
            WHERE gm1.user_id = auth.uid() AND gm1.status = 'member'
              AND gm2.user_id = pr.user_id AND gm2.status = 'member'))
      OR (pr.realname_to_organizers AND EXISTS (
            SELECT 1 FROM group_members gm
            WHERE gm.user_id = pr.user_id AND gm.status = 'member' AND public.can_manage_group(gm.group_id)))
      OR (pr.realname_to_friends AND public.are_friends(auth.uid(), pr.user_id))
    THEN pr.display_name ELSE NULL END AS real_name
  FROM profiles pr WHERE pr.user_id = ANY (p_ids);
$$;
GRANT EXECUTE ON FUNCTION public.visible_names(uuid[]) TO authenticated;
