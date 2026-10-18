/**
 * Settings — personal profile (photo, name, phone), security (password),
 * preferences (start page, idle sign-out) and, for Admins, company settings.
 */
import { useState, useRef, useEffect } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import {
  UserCircle2, ShieldCheck, SlidersHorizontal, Building2, UsersRound, Camera, Upload, Trash2,
  Lock, Mail, Phone, KeyRound, LogOut, Monitor, CalendarClock, LayoutDashboard, Users as UsersIcon,
  CalendarDays, Wallet, Activity, Timer, Clock, Save, ChevronRight, Loader2, Sparkles,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useCompany, COMPANY_DEFAULTS } from '../context/CompanyContext'
import { RoleBadge } from '../components/roles'
import { PasswordInput, NewPasswordFields } from '../components/PasswordInput'
import { validateNewPassword } from '../lib/password'
import { fileToAvatar, MAX_UPLOAD_MB } from '../lib/image'
import { useToast, Toast, Avatar, ErrorNote, INPUT_CLS, fmtDate, fmtDateTime } from '../components/ui'
import { LogoMark } from '../components/Brand'

const TABS = [
  { key: 'profile',     label: 'Profile',     Icon: UserCircle2,       desc: 'Photo and personal details' },
  { key: 'security',    label: 'Security',    Icon: ShieldCheck,       desc: 'Password and sign-in' },
  { key: 'preferences', label: 'Preferences', Icon: SlidersHorizontal, desc: 'Start page and auto sign-out' },
  { key: 'company',     label: 'Company',     Icon: Building2,         desc: 'Branding, work hours, payroll', admin: true },
]

const LANDING = [
  { path: '/dashboard',           label: 'Dashboard',        Icon: LayoutDashboard },
  { path: '/employees',           label: 'Employees',        Icon: UsersIcon },
  { path: '/attendance/daily',    label: 'Daily attendance', Icon: CalendarDays },
  { path: '/payroll/process',     label: 'Payroll',          Icon: Wallet, payroll: true },
  { path: '/analytics',           label: 'Analytics',        Icon: Activity },
]

const IDLE = [
  { value: 0,  label: 'Never' },
  { value: 15, label: '15 min' },
  { value: 30, label: '30 min' },
  { value: 60, label: '1 hour' },
]

function Card({ title, sub, Icon, children, footer }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-start gap-3 px-5 py-4 border-b border-gray-100">
        {Icon && <span className="w-9 h-9 rounded-xl bg-indigo-50 text-[#1e3a8a] flex items-center justify-center shrink-0"><Icon size={17} /></span>}
        <div>
          <h3 className="text-base font-bold text-gray-900">{title}</h3>
          {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
        </div>
      </div>
      <div className="p-5">{children}</div>
      {footer && <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-gray-100 bg-gray-50/50">{footer}</div>}
    </div>
  )
}

function SaveButton({ busy, disabled, children = 'Save changes', ...props }) {
  return (
    <button {...props} disabled={busy || disabled}
      className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold text-white bg-[#1e3a8a] hover:bg-[#162d6e] disabled:opacity-50 transition-colors">
      {busy ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} {children}
    </button>
  )
}

function Field({ label, Icon, children, hint }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-gray-500 flex items-center gap-1.5">{Icon && <Icon size={12} />} {label}</span>
      <div className="mt-1">{children}</div>
      {hint && <span className="block text-[11px] text-gray-400 mt-1">{hint}</span>}
    </label>
  )
}

// ── Profile ──────────────────────────────────────────────────────────────────
function ProfileTab({ toast }) {
  const { profile, displayName, avatarUrl, updateMe } = useAuth()
  const [form, setForm]   = useState({ name: profile.name ?? '', phone: profile.phone ?? '' })
  const [busy, setBusy]   = useState(false)
  const [photoBusy, setPhotoBusy] = useState(false)
  const [drag, setDrag]   = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef(null)

  const dirty = form.name.trim() !== (profile.name ?? '') || form.phone.trim() !== (profile.phone ?? '')

  async function upload(file) {
    if (!file) return
    setPhotoBusy(true); setError('')
    try {
      const url = await fileToAvatar(file)
      await updateMe({ avatar_url: url })
      toast('success', 'Profile photo updated')
    } catch (err) {
      setError(err.message)
    }
    setPhotoBusy(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function removePhoto() {
    setPhotoBusy(true)
    try { await updateMe({ avatar_url: null }); toast('success', 'Profile photo removed') }
    catch (err) { setError(err.message) }
    setPhotoBusy(false)
  }

  async function save(e) {
    e.preventDefault()
    if (!form.name.trim()) { setError('Your name cannot be empty.'); return }
    setBusy(true); setError('')
    try { await updateMe({ name: form.name.trim(), phone: form.phone.trim() }); toast('success', 'Profile saved') }
    catch (err) { setError(err.message) }
    setBusy(false)
  }

  return (
    <div className="space-y-5">
      <Card title="Profile photo" sub="Shown in the top bar, sidebar and user list" Icon={Camera}>
        <div className="flex flex-col sm:flex-row sm:items-center gap-5">
          <div className="relative self-start">
            <Avatar id={profile.id} name={displayName} src={avatarUrl} size="w-24 h-24 text-2xl" rounded="rounded-2xl" />
            {photoBusy && (
              <div className="absolute inset-0 rounded-2xl bg-white/70 flex items-center justify-center">
                <Loader2 size={20} className="animate-spin text-[#1e3a8a]" />
              </div>
            )}
          </div>
          <div
            onDragOver={e => { e.preventDefault(); setDrag(true) }}
            onDragLeave={() => setDrag(false)}
            onDrop={e => { e.preventDefault(); setDrag(false); upload(e.dataTransfer.files?.[0]) }}
            onClick={() => fileRef.current?.click()}
            className={`flex-1 cursor-pointer rounded-2xl border-2 border-dashed px-5 py-6 text-center transition-colors
              ${drag ? 'border-[#1e3a8a] bg-indigo-50/60' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'}`}
          >
            <Upload size={20} className="mx-auto text-gray-400" />
            <p className="text-sm font-semibold text-gray-700 mt-2">Drop a photo here or <span className="text-[#1e3a8a]">browse</span></p>
            <p className="text-[11px] text-gray-400 mt-1">JPG, PNG or WebP · up to {MAX_UPLOAD_MB} MB · cropped to a square</p>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => upload(e.target.files?.[0])} />
          </div>
        </div>
        {avatarUrl && (
          <button onClick={removePhoto} disabled={photoBusy}
            className="mt-4 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50">
            <Trash2 size={13} /> Remove photo
          </button>
        )}
      </Card>

      <form onSubmit={save}>
        <Card title="Personal information" sub="How you appear across the system" Icon={UserCircle2}
          footer={<SaveButton type="submit" busy={busy} disabled={!dirty} />}>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Full name">
              <input value={form.name} onChange={e => { setForm(f => ({ ...f, name: e.target.value })); setError('') }}
                placeholder="Your name" className={INPUT_CLS} />
            </Field>
            <Field label="Phone" Icon={Phone}>
              <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                placeholder="+252 61 …" className={INPUT_CLS} />
            </Field>
            <Field label="Email" Icon={Mail} hint="Used to sign in · ask an Admin to change it">
              <div className="relative">
                <input value={profile.username ?? ''} disabled className={`${INPUT_CLS} pr-9 opacity-70 cursor-not-allowed`} />
                <Lock size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
              </div>
            </Field>
            <Field label="Role" hint="Roles are managed by Admins">
              <div className="h-[42px] flex items-center"><RoleBadge role={profile.role} /></div>
            </Field>
          </div>
          <div className="mt-4"><ErrorNote>{error}</ErrorNote></div>
        </Card>
      </form>
    </div>
  )
}

// ── Security ─────────────────────────────────────────────────────────────────
function SecurityTab({ toast }) {
  const { profile, changePassword, signOut } = useAuth()
  const navigate = useNavigate()
  const [current, setCurrent] = useState('')
  const [next,    setNext]    = useState('')
  const [confirm, setConfirm] = useState('')
  const [showCur, setShowCur] = useState(false)
  const [busy,    setBusy]    = useState(false)
  const [error,   setError]   = useState('')
  const remembered = (() => { try { return !!localStorage.getItem('wf_session') } catch { return false } })()

  async function submit(e) {
    e.preventDefault()
    if (!current) return setError('Enter your current password.')
    const err = validateNewPassword(next, confirm)
    if (err) return setError(err)
    if (next === current) return setError('New password must be different from the current one.')
    setBusy(true); setError('')
    try {
      await changePassword(current, next)
      setCurrent(''); setNext(''); setConfirm('')
      toast('success', 'Password changed')
    } catch (ex) {
      setError(ex.message)
    }
    setBusy(false)
  }

  return (
    <div className="space-y-5">
      <form onSubmit={submit}>
        <Card title="Change password" Icon={KeyRound}
          sub={profile.password_updated_at ? `Last changed ${fmtDate(profile.password_updated_at)}` : 'Choose a strong password you don’t use elsewhere'}
          footer={<SaveButton type="submit" busy={busy} disabled={!current || !next || !confirm}>Update password</SaveButton>}>
          <div className="max-w-md space-y-4">
            <PasswordInput label="Current password" value={current} autoComplete="current-password"
              onChange={v => { setCurrent(v); setError('') }} show={showCur} onToggleShow={() => setShowCur(s => !s)} />
            <NewPasswordFields value={next} confirm={confirm}
              onChange={v => { setNext(v); setError('') }} onConfirm={v => { setConfirm(v); setError('') }} />
            <ErrorNote>{error}</ErrorNote>
          </div>
        </Card>
      </form>

      <Card title="Sign-in activity" sub="Your account and this device" Icon={Monitor}>
        <div className="grid sm:grid-cols-3 gap-3">
          {[
            { label: 'Last sign-in',    value: profile.last_login ? fmtDateTime(profile.last_login) : '—', Icon: CalendarClock },
            { label: 'Account created', value: profile.created_at ? fmtDate(profile.created_at) : '—',     Icon: Sparkles },
            { label: 'This device',     value: remembered ? 'Kept signed in' : 'Until tab closes',          Icon: Monitor },
          ].map(s => (
            <div key={s.label} className="rounded-xl bg-gray-50 px-4 py-3">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5"><s.Icon size={12} /> {s.label}</p>
              <p className="text-sm font-bold text-gray-800 mt-1">{s.value}</p>
            </div>
          ))}
        </div>
        <button onClick={async () => { await signOut(); navigate('/login', { replace: true }) }}
          className="mt-4 flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-red-500 border border-red-200 hover:bg-red-50 transition-colors">
          <LogOut size={15} /> Sign out of this device
        </button>
      </Card>
    </div>
  )
}

// ── Preferences ──────────────────────────────────────────────────────────────
function PreferencesTab({ toast }) {
  const { profile, updateMe, canAccessPayroll } = useAuth()
  const prefs = profile.preferences ?? {}
  const [busyKey, setBusyKey] = useState(null)

  async function setPref(key, value, label) {
    if ((prefs[key] ?? null) === value) return
    setBusyKey(key)
    try {
      await updateMe({ preferences: { ...prefs, [key]: value } })
      toast('success', label)
    } catch (err) {
      toast('error', err.message)
    }
    setBusyKey(null)
  }

  const landing = prefs.landing ?? '/dashboard'
  const idle    = Number(prefs.idle_timeout) || 0

  return (
    <div className="space-y-5">
      <Card title="Start page" sub="Where you land after signing in" Icon={LayoutDashboard}>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {LANDING.filter(l => !l.payroll || canAccessPayroll).map(l => {
            const on = landing === l.path
            return (
              <button key={l.path} disabled={busyKey === 'landing'} onClick={() => setPref('landing', l.path, `Start page set to ${l.label}`)}
                className={`flex flex-col items-center gap-2 py-4 rounded-xl border text-xs font-semibold transition-all disabled:opacity-60
                  ${on ? 'bg-[#1e3a8a] text-white border-transparent shadow-sm shadow-[#1e3a8a]/30' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                <l.Icon size={18} /> {l.label}
              </button>
            )
          })}
        </div>
      </Card>

      <Card title="Auto sign-out" sub="Sign out automatically after a period of inactivity — useful on shared computers" Icon={Timer}>
        <div className="inline-grid grid-cols-4 gap-1 p-1 bg-gray-50 rounded-xl border border-gray-100">
          {IDLE.map(o => (
            <button key={o.value} disabled={busyKey === 'idle_timeout'}
              onClick={() => setPref('idle_timeout', o.value, o.value ? `Auto sign-out after ${o.label}` : 'Auto sign-out turned off')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all disabled:opacity-60
                ${idle === o.value ? 'bg-white text-[#1e3a8a] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              {o.label}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-gray-400 mt-3">
          {idle ? `You'll be signed out after ${idle} minutes without mouse or keyboard activity.` : 'You stay signed in until you sign out.'}
        </p>
      </Card>
    </div>
  )
}

// ── Company (Admin) ──────────────────────────────────────────────────────────
function CompanyTab({ toast }) {
  const { company, saveCompany } = useCompany()
  const [form, setForm]   = useState(company)
  const [busy, setBusy]   = useState(false)
  const [error, setError] = useState('')
  useEffect(() => { setForm(company) }, [company])

  const set   = patch => { setForm(f => ({ ...f, ...patch })); setError('') }
  const dirty = Object.keys(COMPANY_DEFAULTS).some(k => String(form[k] ?? '') !== String(company[k] ?? ''))

  async function submit(e) {
    e.preventDefault()
    const days = Number(form.payroll_days)
    if (!form.name.trim())                 return setError('Company name is required.')
    if (!form.shift_start || !form.shift_end) return setError('Set both work-day start and end times.')
    if (form.shift_end <= form.shift_start) return setError('Work day must end after it starts.')
    if (!(days >= 20 && days <= 31))       return setError('Payroll days per month must be between 20 and 31.')
    setBusy(true)
    try {
      await saveCompany({ name: form.name.trim(), tagline: form.tagline.trim(), shift_start: form.shift_start, shift_end: form.shift_end, payroll_days: days })
      toast('success', 'Company settings saved')
    } catch (err) {
      setError(err.message)
    }
    setBusy(false)
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <Card title="Branding" sub="Shown in the sidebar and on printed payslips" Icon={Building2}>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Company name"><input value={form.name} onChange={e => set({ name: e.target.value })} className={INPUT_CLS} maxLength={40} /></Field>
          <Field label="Tagline"><input value={form.tagline} onChange={e => set({ tagline: e.target.value })} className={INPUT_CLS} maxLength={40} /></Field>
        </div>
        <div className="mt-4 inline-flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: '#0f172a' }}>
          <LogoMark size={32} />
          <span className="leading-tight">
            <span className="block text-white font-bold text-sm">{form.name || 'Company'}</span>
            <span className="block text-slate-500 text-[10px]">{form.tagline}</span>
          </span>
          <span className="text-[10px] text-slate-500 ml-3">Sidebar preview</span>
        </div>
      </Card>

      <Card title="Work hours & payroll" sub="Used for late detection in attendance and absence deductions in payroll" Icon={Clock}
        footer={<SaveButton type="submit" busy={busy} disabled={!dirty} />}>
        <div className="grid sm:grid-cols-3 gap-4">
          <Field label="Work day starts" hint="Check-ins after this are flagged late">
            <input type="time" value={form.shift_start} onChange={e => set({ shift_start: e.target.value })} className={INPUT_CLS} />
          </Field>
          <Field label="Work day ends">
            <input type="time" value={form.shift_end} onChange={e => set({ shift_end: e.target.value })} className={INPUT_CLS} />
          </Field>
          <Field label="Payroll days / month" hint="Daily rate = base salary ÷ this">
            <input type="number" min={20} max={31} value={form.payroll_days} onChange={e => set({ payroll_days: e.target.value })} className={INPUT_CLS} />
          </Field>
        </div>
        <div className="mt-4"><ErrorNote>{error}</ErrorNote></div>
      </Card>
    </form>
  )
}

// ════════════════════════════════════════════════════════════════════════════════
export default function Settings() {
  const { profile, displayName, avatarUrl, isAdmin } = useAuth()
  const [params, setParams] = useSearchParams()
  const [toast, showToast, dismissToast] = useToast()

  const tabs   = TABS.filter(t => !t.admin || isAdmin)
  const active = tabs.find(t => t.key === params.get('tab'))?.key ?? 'profile'
  const go     = key => setParams({ tab: key }, { replace: true })

  if (!profile) return null

  return (
    <div className="space-y-5 pb-10">
      <div>
        <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight">Settings</h2>
        <p className="text-sm text-gray-400 mt-1">Manage your account, security and preferences</p>
      </div>

      {/* Profile banner */}
      <div className="rounded-2xl p-5 sm:p-6 text-white shadow-lg relative overflow-hidden bg-gradient-to-br from-[#1e3a8a] via-[#1e3a8a] to-indigo-900">
        <div className="absolute -top-16 -right-10 w-56 h-56 bg-indigo-400/20 rounded-full blur-3xl pointer-events-none" />
        <div className="relative flex flex-col sm:flex-row sm:items-center gap-5">
          <button onClick={() => go('profile')} className="relative self-start group" title="Change photo">
            <Avatar id={profile.id} name={displayName} src={avatarUrl} size="w-20 h-20 text-xl" rounded="rounded-2xl" />
            <span className="absolute -bottom-1.5 -right-1.5 w-8 h-8 rounded-xl bg-white text-[#1e3a8a] shadow-lg flex items-center justify-center group-hover:scale-105 transition-transform">
              <Camera size={15} />
            </span>
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-xl font-extrabold tracking-tight truncate">{displayName}</p>
            <p className="text-sm text-indigo-200 truncate">{profile.username}</p>
            <div className="flex flex-wrap items-center gap-2 mt-2.5">
              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-white/15">{profile.role ?? 'No role'}</span>
              {profile.created_at && <span className="text-xs text-indigo-200">Member since {fmtDate(profile.created_at)}</span>}
            </div>
          </div>
          <div className="flex sm:flex-col gap-5 sm:gap-2 sm:text-right">
            <div>
              <p className="text-[10px] text-indigo-200 uppercase tracking-wider">Last sign-in</p>
              <p className="text-sm font-bold">{profile.last_login ? fmtDateTime(profile.last_login) : '—'}</p>
            </div>
            <div>
              <p className="text-[10px] text-indigo-200 uppercase tracking-wider">Password</p>
              <p className="text-sm font-bold">{profile.password_updated_at ? `Changed ${fmtDate(profile.password_updated_at)}` : '—'}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-[260px_1fr] gap-5 items-start">
        {/* Section nav */}
        <nav className="bg-white rounded-2xl border border-gray-100 shadow-sm p-1.5 flex lg:flex-col gap-1 overflow-x-auto lg:sticky lg:top-20">
          {tabs.map(t => {
            const on = active === t.key
            return (
              <button key={t.key} onClick={() => go(t.key)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-left whitespace-nowrap transition-colors shrink-0
                  ${on ? 'bg-[#1e3a8a] text-white shadow-sm' : 'text-gray-600 hover:bg-gray-50'}`}>
                <t.Icon size={17} className={on ? '' : 'text-gray-400'} />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{t.label}</span>
                  <span className={`hidden lg:block text-[11px] truncate ${on ? 'text-indigo-200' : 'text-gray-400'}`}>{t.desc}</span>
                </span>
              </button>
            )
          })}
          {isAdmin && (
            <Link to="/users"
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-gray-600 hover:bg-gray-50 whitespace-nowrap shrink-0 lg:border-t lg:border-gray-100 lg:mt-1 lg:pt-3">
              <UsersRound size={17} className="text-gray-400" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">Users</span>
                <span className="hidden lg:block text-[11px] text-gray-400">Accounts, roles & passwords</span>
              </span>
              <ChevronRight size={15} className="text-gray-300 hidden lg:block" />
            </Link>
          )}
        </nav>

        <div className="min-w-0">
          {active === 'profile'     && <ProfileTab     key={profile.id} toast={showToast} />}
          {active === 'security'    && <SecurityTab    toast={showToast} />}
          {active === 'preferences' && <PreferencesTab toast={showToast} />}
          {active === 'company'     && <CompanyTab     toast={showToast} />}
        </div>
      </div>

      <Toast toast={toast} onDismiss={dismissToast} />
    </div>
  )
}
