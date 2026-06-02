import { formatName } from '../../utils/names'

const ROLE_LABEL = { organizer: 'Organizer', manager: 'Manager', member: 'Member' }
const ROLES = ['member', 'manager', 'organizer']

export default function MemberList({ members, isOwner, canManage, currentUserId, onSetRole, onRemove }) {
  if (members.length === 0) {
    return <p className="text-sm text-forest/60">No members yet.</p>
  }
  return (
    <ul className="space-y-2">
      {members.map((m) => {
        const isSelf = m.user_id === currentUserId
        // managers can remove plain members; owners can remove anyone
        const removable = !isSelf && (isOwner || (canManage && (m.role || 'member') === 'member'))
        return (
          <li key={m.id} className="flex items-center justify-between gap-2 rounded-lg border border-forest/10 bg-white px-3 py-2">
            <span className="text-sm text-forest">
              {formatName(m)}
              {m.role && m.role !== 'member' && (
                <span className="ml-2 rounded-full bg-forest/10 px-2 py-0.5 text-xs font-medium text-forest">{ROLE_LABEL[m.role]}</span>
              )}
            </span>
            <div className="flex items-center gap-2">
              {isOwner && !isSelf ? (
                <select
                  value={m.role || 'member'}
                  onChange={(e) => onSetRole(m, e.target.value)}
                  className="rounded-md border border-forest/20 bg-white px-2 py-1 text-xs text-forest outline-none focus:border-forest"
                >
                  {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                </select>
              ) : (
                <span className="text-xs text-forest/40">{ROLE_LABEL[m.role || 'member']}</span>
              )}
              {removable && (
                <button
                  onClick={() => onRemove(m)}
                  className="rounded-md border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                >
                  Remove
                </button>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
