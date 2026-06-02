// Small friend control reflecting the viewer's relationship to a user.
// rel: { kind: 'friend' | 'incoming' | 'outgoing' | 'none', row? }
export default function FriendButton({ rel, onAdd, onAccept }) {
  const kind = rel?.kind ?? 'none'
  if (kind === 'friend') return <span className="text-xs text-forest/45">Friend ✓</span>
  if (kind === 'outgoing') return <span className="text-xs text-forest/45">Requested</span>
  if (kind === 'incoming') {
    return <button onClick={onAccept} className="rounded-md bg-forest px-2.5 py-1 text-xs text-cream">Accept</button>
  }
  return (
    <button onClick={onAdd} className="rounded-md border border-forest/30 px-2.5 py-1 text-xs text-forest hover:bg-forest hover:text-cream">
      Add friend
    </button>
  )
}
