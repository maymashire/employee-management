import { useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { Eye, EyeOff, Lock, Mail, ShieldCheck, Users, BarChart3, Zap, CheckCircle2, Info } from 'lucide-react'
import { useAuth, LOGOUT_REASON_KEY } from '../context/AuthContext'
import { BrandLockup, BRAND } from '../components/Brand'

const LOGOUT_MESSAGES = {
  idle:     'You were signed out after a period of inactivity.',
  disabled: 'Your account has been disabled. Contact your administrator.',
}

const FEATURES = [
  { icon: Users,      text: 'Manage your entire workforce in one place' },
  { icon: BarChart3,  text: 'Real-time analytics and attendance tracking' },
  { icon: Zap,        text: 'Automated payroll processing & payslips' },
]

const STATS = [
  { num: '50+',  label: 'Employees' },
  { num: '15',   label: 'Departments' },
  { num: '100%', label: 'Uptime' },
]

export default function Login() {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [showPwd,  setShowPwd]  = useState(false)
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const [remember, setRemember] = useState(true)
  const [showHelp, setShowHelp] = useState(false)
  const [notice]                = useState(() => LOGOUT_MESSAGES[sessionStorage.getItem(LOGOUT_REASON_KEY)] ?? '')
  const navigate = useNavigate()
  const { profile, signIn, landingPage } = useAuth()

  if (profile && !loading) return <Navigate to={landingPage} replace />

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!email.trim() || !password) { setError('Enter your email and password.'); return }
    setLoading(true)
    try {
      const u = await signIn(email, password, remember)
      navigate(u.preferences?.landing ?? '/dashboard', { replace: true })
    } catch (err) {
      setError(err.message || 'Invalid email or password. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex">

      {/* ── LEFT PANEL ─────────────────────────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-[52%] relative overflow-hidden flex-col justify-between p-12"
        style={{ background: 'linear-gradient(145deg, #0f172a 0%, #1e1b4b 45%, #1e3a8a 100%)' }}>

        {/* Background glow blobs */}
        <div className="absolute top-[-80px] left-[-80px] w-80 h-80 rounded-full opacity-20"
          style={{ background: 'radial-gradient(circle, #6366f1, transparent)' }} />
        <div className="absolute bottom-[-60px] right-[-40px] w-72 h-72 rounded-full opacity-15"
          style={{ background: 'radial-gradient(circle, #3b82f6, transparent)' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full opacity-5"
          style={{ background: 'radial-gradient(circle, #a78bfa, transparent)' }} />

        {/* Brand top */}
        <div className="relative z-10">
          <BrandLockup size={40} tone="light" />
        </div>

        {/* Center content */}
        <div className="relative z-10 space-y-10">
          <div>
            <h2 className="text-4xl font-extrabold text-white leading-tight tracking-tight">
              Smarter way to<br />
              <span style={{
                background: 'linear-gradient(90deg, #a5b4fc, #60a5fa)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}>manage your people.</span>
            </h2>
            <p className="mt-4 text-indigo-200/80 text-base leading-relaxed max-w-sm">
              From attendance to payroll — everything your HR team needs in a single, beautiful dashboard.
            </p>
          </div>

          {/* Feature list */}
          <div className="space-y-4">
            {FEATURES.map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: 'rgba(99,102,241,0.25)' }}>
                  <Icon size={15} className="text-indigo-300" />
                </div>
                <span className="text-indigo-100/80 text-sm">{text}</span>
              </div>
            ))}
          </div>

          {/* Floating stat cards */}
          <div className="flex gap-3">
            {STATS.map(({ num, label }, i) => (
              <div key={label}
                className={`flex-1 rounded-2xl p-4 text-center float-${i + 1}`}
                style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}>
                <p className="text-2xl font-extrabold text-white">{num}</p>
                <p className="text-indigo-300 text-xs mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom */}
        <div className="relative z-10">
          <div className="flex items-center gap-2 rounded-2xl p-4"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
            <p className="text-indigo-200/70 text-xs">
              Enterprise-grade security · ISO 27001 compliant · SOC 2 Type II
            </p>
          </div>
        </div>
      </div>

      {/* ── RIGHT PANEL ────────────────────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10 bg-white">
        <div className="w-full max-w-sm fade-in">

          {/* Mobile brand */}
          <div className="lg:hidden flex justify-center mb-10">
            <BrandLockup size={40} tone="dark" />
          </div>

          {/* Heading */}
          <div className="mb-8">
            <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Welcome back</h1>
            <p className="text-gray-400 text-sm mt-1">Sign in to continue to your dashboard.</p>
          </div>

          {notice && !error && (
            <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 text-amber-800
              text-sm px-4 py-3 rounded-xl mb-6">
              <Info size={16} className="shrink-0 mt-0.5" />
              <span>{notice}</span>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 text-red-700
              text-sm px-4 py-3 rounded-xl mb-6">
              <span className="shrink-0 mt-0.5">⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5" noValidate>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Email address</label>
              <div className="relative">
                <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                  type="email" required autoComplete="email"
                  value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 bg-gray-50
                    text-sm text-gray-900 placeholder:text-gray-400
                    focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500
                    transition-all duration-200"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-semibold text-gray-700">Password</label>
                <button type="button" onClick={() => setShowHelp(h => !h)}
                  className="text-xs font-medium text-indigo-600 hover:text-indigo-800 transition-colors">
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                  type={showPwd ? 'text' : 'password'} required autoComplete="current-password"
                  value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-12 py-3 rounded-xl border border-gray-200 bg-gray-50
                    text-sm text-gray-900 placeholder:text-gray-400
                    focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500
                    transition-all duration-200"
                />
                <button type="button" onClick={() => setShowPwd(p => !p)} tabIndex={-1}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                  {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {showHelp && (
              <p className="text-xs text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-xl px-3.5 py-2.5 -mt-2">
                Ask your system administrator to reset it from the <b>Users</b> page.
              </p>
            )}

            <label className="flex items-center gap-2 text-sm text-gray-600 select-none cursor-pointer -mt-1">
              <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 accent-indigo-600" />
              Keep me signed in
            </label>

            <button
              type="submit" disabled={loading}
              className="w-full py-3.5 mt-1 rounded-xl text-white text-sm font-bold
                transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed
                flex items-center justify-center gap-2 shadow-lg"
              style={{
                background: loading ? '#4f46e5' : 'linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%)',
                boxShadow: '0 8px 24px rgba(79,70,229,0.35)',
              }}
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Signing in…
                </>
              ) : 'Sign in →'}
            </button>
          </form>

          {/* Footer */}
          <div className="flex items-center justify-center gap-1.5 mt-8 text-xs text-gray-400">
            <ShieldCheck size={13} className="shrink-0 text-emerald-500" />
            <span>Secured with 256-bit encryption</span>
          </div>

          <p className="text-center text-xs text-gray-300 mt-4">
            © {new Date().getFullYear()} {BRAND.name} · {BRAND.slogan}
          </p>
        </div>
      </div>
    </div>
  )
}
