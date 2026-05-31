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
