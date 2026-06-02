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
