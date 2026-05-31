import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'

export default function ResetPassword() {
  const { updatePassword } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    if (password.length < 6) return setError('Password must be at least 6 characters.')
    if (password !== confirm) return setError('Passwords don’t match.')
    setBusy(true)
    const { error } = await updatePassword(password)
    setBusy(false)
    if (error) return setError(error.message)
    setDone(true)
    setTimeout(() => navigate('/'), 1200)
  }

  return (
    <div className="mx-auto max-w-md px-6 py-12">
      <h1 className="mb-2 text-2xl font-semibold text-forest">Set a new password</h1>
      {done ? (
        <p className="rounded-lg border border-forest/15 bg-white p-5 text-forest/80">
          Password updated — taking you in…
        </p>
      ) : (
        <>
          <p className="mb-6 text-forest/70">Enter a new password for your account.</p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-forest">New password</span>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-forest/20 bg-white px-3 py-2 outline-none focus:border-forest"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-forest">Confirm password</span>
              <input
                type="password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full rounded-lg border border-forest/20 bg-white px-3 py-2 outline-none focus:border-forest"
              />
            </label>
            {error && <p className="text-sm text-red-700">{error}</p>}
            <button type="submit" disabled={busy} className="w-full rounded-lg bg-forest py-2.5 font-medium text-cream disabled:opacity-50">
              {busy ? 'Saving…' : 'Update password'}
            </button>
          </form>
          <p className="mt-6 text-center text-sm text-forest/60">
            This page works from the link in your reset email. <Link to="/login" className="font-medium text-forest underline">Back to log in</Link>
          </p>
        </>
      )}
    </div>
  )
}
