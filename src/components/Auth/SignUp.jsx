import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'

export default function SignUp() {
  const { signUp } = useAuth()
  const navigate = useNavigate()
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    const { data, error } = await signUp(email, password, displayName)
    setBusy(false)
    if (error) return setError(error.message)
    // If email confirmation is OFF, a session exists immediately.
    if (data.session) navigate('/onboarding')
    else setError('Check your email to confirm your account, then log in.')
  }

  return (
    <div className="mx-auto max-w-md px-6 py-12">
      <h1 className="mb-1 text-2xl font-semibold text-forest">Join Commons</h1>
      <p className="mb-6 text-forest/70">Activity groups built around who you actually are.</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Your name" value={displayName} onChange={setDisplayName} type="text" required />
        <Field label="Email" value={email} onChange={setEmail} type="email" required />
        <Field label="Password" value={password} onChange={setPassword} type="password" required />
        {error && <p className="text-sm text-red-700">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-lg bg-forest py-2.5 font-medium text-cream disabled:opacity-50"
        >
          {busy ? 'Creating account…' : 'Create account'}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-forest/70">
        Already have an account?{' '}
        <Link to="/login" className="font-medium text-forest underline">Log in</Link>
      </p>
    </div>
  )
}

function Field({ label, value, onChange, type, required }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-forest">{label}</span>
      <input
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-forest/20 bg-white px-3 py-2 outline-none focus:border-forest"
      />
    </label>
  )
}
