export default function MemberList({ members }) {
  if (members.length === 0) {
    return <p className="text-sm text-forest/60">No members yet.</p>
  }
  return (
    <ul className="flex flex-wrap gap-2">
      {members.map((m) => (
        <li key={m.id} className="rounded-full bg-forest/10 px-3 py-1 text-sm text-forest">
          {m.display_name || 'Member'}
        </li>
      ))}
    </ul>
  )
}
