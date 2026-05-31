import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import Navigation from './components/Shared/Navigation'
import Spinner from './components/Shared/Spinner'
import SignUp from './components/Auth/SignUp'
import LogIn from './components/Auth/LogIn'
import ProfileSetup from './components/Profile/ProfileSetup'
import GroupList from './components/Groups/GroupList'
import GroupCreate from './components/Groups/GroupCreate'
import GroupDetail from './components/Groups/GroupDetail'

function Protected({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <Spinner />
  if (!user) return <Navigate to="/login" replace />
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
          <Route path="/" element={<Protected><GroupList /></Protected>} />
          <Route path="/onboarding" element={<Protected><ProfileSetup /></Protected>} />
          <Route path="/groups/new" element={<Protected><GroupCreate /></Protected>} />
          <Route path="/groups/:id" element={<Protected><GroupDetail /></Protected>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  )
}
