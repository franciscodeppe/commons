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
