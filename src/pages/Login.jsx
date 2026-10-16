import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Lock, Mail, ShieldCheck } from 'lucide-react'

const VALID_EMAIL    = 'maryan@gmail.com'
const VALID_PASSWORD = '123456'

export default function Login() {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [showPwd,  setShowPwd]  = useState(false)
  const [remember, setRemember] = useState(false)
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    await new Promise(r => setTimeout(r, 500))

    if (email.trim().toLowerCase() === VALID_EMAIL && password === VALID_PASSWORD) {
      sessionStorage.setItem('wf_auth', '1')
      navigate('/dashboard', { replace: true })
    } else {
      setError('Invalid email or password. Please try again.')
      setLoading(false)
    }
  }

  const inputBase =
    'w-full rounded-xl border bg-gray-50 text-sm text-gray-800 placeholder:text-gray-400 ' +
    'focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/20 focus:border-[#1e3a8a] ' +
    'transition-all duration-200'

  return (
    <div className="min-h-screen flex items-center justify-center p-4
      bg-gradient-to-br from-slate-100 via-blue-50 to-indigo-100">

      <div className="w-full max-w-md">

        {/* ── Card ─────────────────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 px-8 py-10 sm:px-10">

          {/* Brand */}
          <div className="flex flex-col items-center mb-8">
            {/* HR icon block */}
            <div className="w-14 h-14 bg-[#1e3a8a] rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-blue-900/20">
              <span className="text-white font-extrabold text-lg tracking-widest select-none">HR</span>
            </div>
            <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">WorkForce</h1>
            <p className="text-sm text-gray-500 mt-1 font-medium">Employee Management System</p>
          </div>

          {/* Heading */}
          <div className="mb-6">
            <h2 className="text-[17px] font-bold text-gray-800">Sign in to your account</h2>
            <p className="text-[13px] text-gray-400 mt-0.5">
              Welcome back — enter your credentials to continue.
            </p>
          </div>

          {/* Error banner */}
          {error && (
            <div className="flex items-center gap-2.5 bg-red-50 border border-red-200 text-red-700
              text-sm px-4 py-3 rounded-xl mb-5">
              <span className="shrink-0 text-base">⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5" noValidate>

            {/* Email */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Email address
              </label>
              <div className="relative">
                <Mail
                  size={15}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                />
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className={`${inputBase} border-gray-200 pl-10 pr-4 py-3`}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-semibold text-gray-700">Password</label>
                <button
                  type="button"
                  className="text-xs font-medium text-[#1e3a8a] hover:text-[#162d6e] hover:underline transition-colors"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Lock
                  size={15}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                />
                <input
                  type={showPwd ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className={`${inputBase} border-gray-200 pl-10 pr-12 py-3`}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(p => !p)}
                  tabIndex={-1}
                  aria-label={showPwd ? 'Hide password' : 'Show password'}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Remember me */}
            <div className="flex items-center gap-2.5 select-none">
              <input
                id="remember"
                type="checkbox"
                checked={remember}
                onChange={e => setRemember(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 cursor-pointer accent-[#1e3a8a]"
              />
              <label htmlFor="remember" className="text-sm text-gray-600 cursor-pointer">
                Remember me for 30 days
              </label>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3.5 mt-1
                bg-[#1e3a8a] hover:bg-[#162d6e] active:bg-[#0f2359]
                text-white text-sm font-semibold rounded-xl
                shadow-md shadow-blue-900/20
                transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <svg
                    className="animate-spin h-4 w-4 shrink-0"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      className="opacity-25"
                      cx="12" cy="12" r="10"
                      stroke="currentColor" strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Signing in…
                </>
              ) : (
                'Sign in'
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="flex items-center justify-center gap-1.5 mt-8 text-xs text-gray-400">
            <ShieldCheck size={13} className="shrink-0" />
            <span>Enterprise-grade security</span>
            <span className="opacity-40">·</span>
            <button
              type="button"
              className="hover:text-gray-600 hover:underline underline-offset-2 transition-colors"
            >
              Privacy policy
            </button>
          </div>
        </div>

        {/* Below-card copyright */}
        <p className="text-center text-xs text-gray-400 mt-5">
          &copy; {new Date().getFullYear()} WorkForce. All rights reserved.
        </p>
      </div>
    </div>
  )
}
