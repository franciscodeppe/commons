import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useProfile } from '../../hooks/useProfile'

export default function Navigation() {
  const { user, signOut } = useAuth()
  const { profile } = useProfile()
  const navigate = useNavigate()

  async function handleLogout() {
    await signOut()
    navigate('/login')
  }

  return (
    <header className="border-b border-forest/15 bg-cream">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-3">
        <Link to="/" className="text-lg font-semibold tracking-tight text-forest">
          Commons
        </Link>
        {user && (
          <nav className="flex items-center gap-4 text-sm">
            <Link to="/" className="text-forest/80 hover:text-forest">Browse</Link>
            <Link to="/groups/new" className="text-forest/80 hover:text-forest">Start a group</Link>
            <Link to="/friends" className="text-forest/80 hover:text-forest">Friends</Link>
            <Link to="/profile" className="text-forest/80 hover:text-forest">Profile</Link>
            {profile?.is_admin && (
              <Link to="/admin" className="font-medium text-gold hover:text-forest">Admin</Link>
            )}
            <button
              onClick={handleLogout}
              className="rounded-md border border-forest/30 px-3 py-1 text-forest hover:bg-forest hover:text-cream"
            >
              Log out
            </button>
          </nav>
        )}
      </div>
    </header>
  )
}
