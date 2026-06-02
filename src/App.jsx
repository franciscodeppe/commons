import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import { useProfile } from './hooks/useProfile'
import Navigation from './components/Shared/Navigation'
import Spinner from './components/Shared/Spinner'
import AdminPanel from './components/Admin/AdminPanel'
import SignUp from './components/Auth/SignUp'
import LogIn from './components/Auth/LogIn'
import ForgotPassword from './components/Auth/ForgotPassword'
import ResetPassword from './components/Auth/ResetPassword'
import ProfileSetup from './components/Profile/ProfileSetup'
import ProfileSettings from './components/Profile/ProfileSettings'
import FriendsPage from './components/Friends/FriendsPage'
import BrowseMatches from './components/Groups/BrowseMatches'
import GroupCreate from './components/Groups/GroupCreate'
import GroupDetail from './components/Groups/GroupDetail'
import GroupEdit from './components/Groups/GroupEdit'
import EventCreate from './components/Events/EventCreate'

function Protected({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <Spinner />
  if (!user) return <Navigate to="/login" replace />
  return children
}

function AdminOnly({ children }) {
  const { user, loading } = useAuth()
  const { profile, loading: pLoading } = useProfile()
  if (loading || pLoading) return <Spinner />
  if (!user) return <Navigate to="/login" replace />
  if (!profile?.is_admin) return <Navigate to="/" replace />
  return children
}

export default function App() {
  return (
    <div className="min-h-screen bg-cream text-forest">
      <Navigation />
      <main>
        <Routes>
          <Route path="/login" element={<LogIn />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/" element={<Protected><BrowseMatches /></Protected>} />
          <Route path="/onboarding" element={<Protected><ProfileSetup /></Protected>} />
          <Route path="/profile" element={<Protected><ProfileSettings /></Protected>} />
          <Route path="/friends" element={<Protected><FriendsPage /></Protected>} />
          <Route path="/groups/new" element={<Protected><GroupCreate /></Protected>} />
          <Route path="/groups/:id" element={<Protected><GroupDetail /></Protected>} />
          <Route path="/groups/:id/edit" element={<Protected><GroupEdit /></Protected>} />
          <Route path="/groups/:id/events/new" element={<Protected><EventCreate /></Protected>} />
          <Route path="/admin" element={<AdminOnly><AdminPanel /></AdminOnly>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  )
}
