import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'

export default function ForgotPassword() {
  const { requestPasswordReset } = useAuth()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    const { error } = await requestPasswordReset(email)
    setBusy(false)
    if (error) return setError(error.message)
    setSent(true) // always show success to avoid leaking which emails exist
  }

  return (
    <div className="mx-auto max-w-md px-6 py-12">
      <h1 className="mb-2 text-2xl font-semibold text-forest">Reset your password</h1>
      {sent ? (
        <div className="rounded-lg border border-forest/15 bg-white p-5 text-forest/80">
          <p>If an account exists for <span className="font-medium text-forest">{email}</span>, a reset link is on its way. Check your inbox and follow the link to set a new password.</p>
          <Link to="/login" className="mt-4 inline-block font-medium text-forest underline">Back to log in</Link>
        </div>
      ) : (
        <>
          <p className="mb-6 text-forest/70">Enter your email and we’ll send you a link to reset it.</p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-forest">Email</span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-forest/20 bg-white px-3 py-2 outline-none focus:border-forest"
              />
            </label>
            {error && <p className="text-sm text-red-700">{error}</p>}
            <button type="submit" disabled={busy} className="w-full rounded-lg bg-forest py-2.5 font-medium text-cream disabled:opacity-50">
              {busy ? 'Sending…' : 'Send reset link'}
            </button>
          </form>
          <p className="mt-6 text-center text-sm text-forest/70">
            Remembered it? <Link to="/login" className="font-medium text-forest underline">Log in</Link>
          </p>
        </>
      )}
    </div>
  )
}
