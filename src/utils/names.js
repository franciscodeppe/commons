import { supabase } from './supabaseClient'

// Resolve usernames (+ real names where the viewer is permitted) for a set of
// user ids, via the relationship-aware visible_names RPC.
// Returns { [user_id]: { username, realName } }.
export async function fetchNames(ids) {
  const unique = [...new Set(ids)].filter(Boolean)
  if (!unique.length) return {}
  const { data } = await supabase.rpc('visible_names', { p_ids: unique })
  return Object.fromEntries((data ?? []).map((r) => [r.user_id, { username: r.username, realName: r.real_name }]))
}

// "username · Real name" when the real name is visible, else just the handle.
export function formatName(entry) {
  if (!entry || !entry.username) return 'member'
  return entry.realName ? `${entry.username} · ${entry.realName}` : entry.username
}
