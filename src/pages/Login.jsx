import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  HeartHandshake, Mail, Lock, Eye, EyeOff, Loader2,
  AlertCircle, Users, Clock, Wallet, BarChart3, CheckCircle2,
} from 'lucide-react'

// Human-readable Supabase Auth error messages
function friendlyError(raw = '') {
  const msg = raw.toLowerCase()
  if (msg.includes('invalid login credentials') || msg.includes('invalid credentials'))
    return 'Incorrect email or password. Please try again.'
  if (msg.includes('email not confirmed'))
    return 'Please confirm your email address before signing in.'
  if (msg.includes('too many requests') || msg.includes('rate limit'))
    return 'Too many attempts. Please wait a moment and try again.'
  if (msg.includes('user not found'))
    return 'No account found with that email address.'
  if (msg.includes('network') || msg.includes('fetch'))
    return 'Connection error. Check your internet and try again.'
  return raw || 'Something went wrong. Please try again.'
}

const FEATURES = [
  { Icon: Users,    text: 'Employee & Department Management' },
  { Icon: Clock,    text: 'Time & Attendance Tracking'       },
  { Icon: Wallet,   text: 'Payroll Processing & Payslips'    },
  { Icon: BarChart3,text: 'Analytics & Reporting'            },
]

const ROLE_COLORS = {
  Admin:   'bg-amber-400/20 text-amber-300 border-amber-400/30',
  HR:      'bg-emerald-400/20 text-emerald-300 border-emerald-400/30',
  Finance: 'bg-blue-400/20 text-blue-300 border-blue-400/30',
  Manager: 'bg-purple-400/20 text-purple-300 border-purple-400/30',
}

export default function Login() {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [showPwd,  setShowPwd]  = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')

  const { signIn }  = useAuth()
  const navigate    = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error: authErr } = await signIn(email.trim(), password)

    if (authErr) {
      setLoading(false)
      setError(friendlyError(authErr.message))
      return
    }

    // Auth succeeded — AuthContext's onAuthStateChange will load the profile.
    // Navigate immediately; ProtectedRoute handles the "no profile" edge case.
    navigate('/dashboard', { replace: true })
  }

  const inputBase =
    'w-full rounded-xl border text-sm text-gray-800 placeholder:text-gray-400 ' +
    'focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/25 focus:border-[#1e3a8a] transition-colors bg-white'

  return (
    <div className="min-h-screen flex">

      {/* ══ LEFT PANEL — hero ══════════════════════════════════════════════════ */}
      <div className="hidden lg:flex w-[46%] bg-gradient-to-br from-[#0c1d4a] via-[#1e3a8a] to-[#1d4ed8]
        flex-col justify-between p-12 relative overflow-hidden">

        {/* Decorative circles */}
        <div className="absolute -top-24 -left-24 w-80 h-80 rounded-full bg-white/5 pointer-events-none" />
        <div className="absolute bottom-20 right-0 w-64 h-64 rounded-full bg-white/5 pointer-events-none translate-x-1/3" />

        {/* Brand */}
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-16">
            <div className="w-11 h-11 bg-white rounded-xl flex items-center justify-center shadow-lg">
              <HeartHandshake size={20} className="text-[#1e3a8a]" strokeWidth={2.2} />
            </div>
            <div>
              <p className="text-white font-extrabold text-lg tracking-tight leading-none">VibeHR</p>
              <p className="text-blue-300 text-xs font-medium">Better Culture, Better Work.</p>
            </div>
          </div>

          <h1 className="text-4xl font-extrabold text-white leading-tight tracking-tight mb-4">
            Run your team<br />
            <span className="text-blue-300">smarter.</span>
          </h1>
          <p className="text-blue-200 text-sm leading-relaxed mb-10 max-w-xs">
            A unified platform for HR, payroll, attendance, and analytics — built for modern teams.
          </p>

          {/* Feature list */}
          <div className="space-y-3.5">
            {FEATURES.map(({ Icon, text }) => (
              <div key={text} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                  <Icon size={15} className="text-blue-200" />
                </div>
                <span className="text-sm text-blue-100 font-medium">{text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Role chips */}
        <div className="relative z-10">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-blue-400 mb-3">
            System Roles
          </p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(ROLE_COLORS).map(([role, cls]) => (
              <span key={role}
                className={`px-3 py-1 rounded-full text-xs font-semibold border ${cls}`}>
                {role}
              </span>
            ))}
          </div>
          <p className="text-blue-400/60 text-xs mt-8">
            VibeHR &copy; {new Date().getFullYear()}
          </p>
        </div>
      </div>

      {/* ══ RIGHT PANEL — form ═════════════════════════════════════════════════ */}
      <div className="flex-1 flex items-center justify-center bg-gray-50 p-6 min-h-screen">
        <div className="w-full max-w-[400px]">

          {/* Mobile brand (only visible < lg) */}
          <div className="flex lg:hidden items-center gap-3 mb-10 justify-center">
            <div className="w-10 h-10 bg-[#1e3a8a] rounded-xl flex items-center justify-center">
              <HeartHandshake size={18} className="text-white" strokeWidth={2.2} />
            </div>
            <div>
              <p className="font-extrabold text-gray-900 leading-none">VibeHR</p>
              <p className="text-gray-400 text-xs">Better Culture, Better Work.</p>
            </div>
          </div>

          {/* Heading */}
          <div className="mb-8">
            <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight">
              Welcome back
            </h2>
            <p className="text-sm text-gray-400 mt-1">Sign in to your account to continue.</p>
          </div>

          {/* Dev credentials hint */}
          {import.meta.env.DEV && (
            <div className="flex items-start gap-2.5 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 mb-6 text-xs">
              <CheckCircle2 size={14} className="text-blue-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-blue-700 mb-0.5">Demo credentials</p>
                <p className="text-blue-500">maryan@gmail.com &nbsp;·&nbsp; 123456</p>
              </div>
            </div>
          )}

          {/* Error banner */}
          {error && (
            <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-5 text-sm text-red-700">
              <AlertCircle size={15} className="shrink-0 mt-0.5 text-red-500" />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Email */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="admin@company.com"
                  className={`${inputBase} border-gray-200 pl-10 pr-4 py-3`}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
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
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3.5 mt-2
                bg-[#1e3a8a] hover:bg-[#162d6e] text-white font-semibold text-sm
                rounded-xl shadow-md transition-colors disabled:opacity-60"
            >
              {loading
                ? <><Loader2 size={16} className="animate-spin" /> Signing in…</>
                : 'Sign In'}
            </button>
          </form>

          {/* Footer note */}
          <p className="text-center text-xs text-gray-400 mt-8 leading-relaxed">
            Don&apos;t have access?&nbsp;
            <span className="text-gray-500 font-medium">
              Contact your system administrator.
            </span>
          </p>
        </div>
      </div>

    </div>
  )
}
