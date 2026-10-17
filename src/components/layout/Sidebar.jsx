/**
 * App sidebar.
 * - Desktop: full (256px) or collapsed icon rail (76px) — toggled by the header
 *   hamburger, the button at the bottom, or Ctrl/⌘+B; choice is remembered.
 *   In the rail, items show tooltips and sections open a flyout menu on hover.
 * - Mobile: slide-in drawer with overlay.
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { NavLink, Link, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Users, Building2,
  Clock, CalendarDays, ScanLine, Calendar, BarChart3,
  Wallet, FileSpreadsheet, Calculator, FileText, History,
  Settings, LogOut, ChevronDown, Activity, Sparkles, UsersRound, Search, X,
  PanelLeftClose, PanelLeftOpen,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useCompany } from '../../context/CompanyContext'
import { Avatar } from '../ui'

const MAIN_NAV = [
  { label: 'Dashboard',   path: '/dashboard',   icon: LayoutDashboard },
  { label: 'Employees',   path: '/employees',   icon: Users },
  { label: 'Departments', path: '/departments', icon: Building2 },
  { label: 'Analytics',   path: '/analytics',   icon: Activity },
]

const ATTENDANCE = {
  title: 'Attendance', icon: Clock, basePath: '/attendance',
  items: [
    { label: 'Daily Attendance', path: '/attendance/daily',        icon: CalendarDays },
    { label: 'Check In / Out',   path: '/attendance/check-in-out', icon: ScanLine },
    { label: 'Calendar',         path: '/attendance/calendar',     icon: Calendar },
    { label: 'Reports',          path: '/attendance/reports',      icon: BarChart3 },
  ],
}

const PAYROLL = {
  title: 'Payroll', icon: Wallet, basePath: '/payroll',
  items: [
    { label: 'Salary List',     path: '/payroll/salary-list', icon: FileSpreadsheet },
    { label: 'Payroll Process', path: '/payroll/process',     icon: Calculator },
    { label: 'Payslips',        path: '/payroll/payslips',    icon: FileText },
    { label: 'History',         path: '/payroll/history',     icon: History },
    { label: 'Reports',         path: '/payroll/reports',     icon: BarChart3 },
    { label: 'Pay Status',      path: '/payroll/pay-status',  icon: Clock },
  ],
}

const ROLE_COLORS = {
  Admin:   { bg: 'rgba(251,191,36,0.15)', text: '#fbbf24' },
  HR:      { bg: 'rgba(52,211,153,0.15)', text: '#34d399' },
  Finance: { bg: 'rgba(96,165,250,0.15)', text: '#60a5fa' },
  Manager: { bg: 'rgba(167,139,250,0.15)', text: '#a78bfa' },
}

const ACTIVE_STYLE = {
  background: 'linear-gradient(135deg, rgba(99,102,241,0.9) 0%, rgba(59,130,246,0.9) 100%)',
  boxShadow: '0 4px 14px rgba(99,102,241,0.4)',
}

const Divider = () => <div className="py-2"><div style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }} /></div>

function SectionLabel({ children }) {
  return <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-600">{children}</p>
}

// ── Full-width items ──────────────────────────────────────────────────────────
function NavItem({ path, icon: Icon, label, compact = false, onNavClick }) {
  return (
    <NavLink
      to={path}
      onClick={onNavClick}
      className={({ isActive }) =>
        `group relative flex items-center gap-2.5 rounded-xl text-sm font-medium transition-all duration-150
         ${compact ? 'px-3 py-1.5' : 'px-3 py-2.5'}
         ${isActive ? 'text-white' : 'text-slate-400 hover:text-white hover:bg-white/[0.07]'}`
      }
      style={({ isActive }) => (isActive ? ACTIVE_STYLE : undefined)}
    >
      <Icon size={compact ? 14 : 16} strokeWidth={1.8} className="shrink-0 transition-transform group-hover:scale-110" />
      <span className="truncate">{label}</span>
    </NavLink>
  )
}

function SectionDropdown({ title, icon: Icon, items, basePath, onNavClick }) {
  const { pathname } = useLocation()
  const childIsActive = pathname.startsWith(basePath)
  const key = `wf_nav_open${basePath.replace(/\//g, '_')}`
  const [open, setOpen] = useState(() => {
    try { return childIsActive || localStorage.getItem(key) === '1' } catch { return childIsActive }
  })

  useEffect(() => { if (childIsActive) setOpen(true) }, [childIsActive])
  useEffect(() => { try { localStorage.setItem(key, open ? '1' : '0') } catch {} }, [key, open])

  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150
          ${childIsActive ? 'text-white bg-white/10' : 'text-slate-400 hover:text-white hover:bg-white/[0.07]'}`}
      >
        <span className="flex items-center gap-2.5">
          <Icon size={16} strokeWidth={1.8} />
          {title}
        </span>
        <ChevronDown size={13} className="transition-transform duration-200 shrink-0 opacity-60"
          style={{ transform: open ? 'rotate(0deg)' : 'rotate(-90deg)' }} />
      </button>

      <div className="grid transition-[grid-template-rows] duration-300 ease-out" style={{ gridTemplateRows: open ? '1fr' : '0fr' }}>
        <div className="overflow-hidden">
          <div className="mt-0.5 ml-5 pl-3 border-l border-white/10 space-y-0.5 py-0.5">
            {items.map(item => (
              <NavItem key={item.path} {...item} compact onNavClick={onNavClick} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Rail (collapsed) items ────────────────────────────────────────────────────
const railBtn = active =>
  `relative w-11 h-11 mx-auto rounded-xl flex items-center justify-center transition-all duration-150
   ${active ? 'text-white' : 'text-slate-400 hover:text-white hover:bg-white/[0.07]'}`

function RailLink({ path, icon: Icon, label, float }) {
  return (
    <NavLink to={path} aria-label={label}
      onMouseEnter={e => float.tip(label, e.currentTarget)} onMouseLeave={float.hide}
      onFocus={e => float.tip(label, e.currentTarget)} onBlur={float.hide}
      className={({ isActive }) => railBtn(isActive)}
      style={({ isActive }) => (isActive ? ACTIVE_STYLE : undefined)}>
      <Icon size={18} strokeWidth={1.8} />
    </NavLink>
  )
}

function RailGroup({ group, float }) {
  const { pathname } = useLocation()
  const active = pathname.startsWith(group.basePath)
  return (
    <button aria-label={group.title} aria-haspopup="menu"
      onMouseEnter={e => float.menu(group, e.currentTarget)} onMouseLeave={float.hide}
      onClick={e => float.menu(group, e.currentTarget, true)}
      className={`${railBtn(false)} ${active ? '!text-white bg-white/10' : ''}`}>
      <group.icon size={18} strokeWidth={1.8} />
      <span className={`absolute bottom-1.5 right-1.5 w-1.5 h-1.5 rounded-full ${active ? 'bg-indigo-400' : 'bg-slate-600'}`} />
    </button>
  )
}

function RailButton({ label, onClick, children, float, danger }) {
  return (
    <button aria-label={label} onClick={onClick}
      onMouseEnter={e => float.tip(label, e.currentTarget)} onMouseLeave={float.hide}
      className={`${railBtn(false)} ${danger ? 'hover:!bg-red-500/15 hover:!text-red-400' : ''}`}>
      {children}
    </button>
  )
}

/** Tooltip / flyout state for the rail (fixed-positioned so the nav's scroll can't clip it). */
function useFloat() {
  const [state, setState] = useState(null)
  const timer = useRef(null)
  const keep  = useCallback(() => clearTimeout(timer.current), [])
  const hide  = useCallback(() => { clearTimeout(timer.current); timer.current = setTimeout(() => setState(null), 140) }, [])
  const close = useCallback(() => { clearTimeout(timer.current); setState(null) }, [])
  const tip   = useCallback((label, el) => {
    clearTimeout(timer.current)
    const r = el.getBoundingClientRect()
    setState({ kind: 'tip', label, top: r.top + r.height / 2 })
  }, [])
  const menu  = useCallback((group, el, toggle = false) => {
    clearTimeout(timer.current)
    const r = el.getBoundingClientRect()
    const h = 52 + group.items.length * 38
    setState(s => (toggle && s?.kind === 'menu' && s.group === group ? null
      : { kind: 'menu', group, top: Math.max(8, Math.min(r.top - 6, window.innerHeight - h - 8)) }))
  }, [])
  useEffect(() => () => clearTimeout(timer.current), [])
  return { state, tip, menu, hide, close, keep }
}

function FloatLayer({ float }) {
  const s = float.state
  if (!s) return null
  if (s.kind === 'tip') {
    return (
      <div role="tooltip" className="fixed z-50 pointer-events-none" style={{ left: 84, top: s.top, transform: 'translateY(-50%)' }}>
        <div className="relative px-2.5 py-1.5 rounded-lg bg-slate-800 text-white text-xs font-semibold shadow-xl whitespace-nowrap border border-white/10"
          style={{ animation: 'sbFloat .12s ease-out both' }}>
          <span className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-2 rotate-45 bg-slate-800 border-l border-b border-white/10" />
          {s.label}
        </div>
      </div>
    )
  }
  return (
    <div role="menu" className="fixed z-50 w-56" style={{ left: 84, top: s.top }}
      onMouseEnter={float.keep} onMouseLeave={float.hide}>
      <div className="rounded-xl p-1.5 shadow-2xl border border-white/10" style={{ background: '#111a2e', animation: 'sbFloat .14s ease-out both' }}>
        <p className="px-2.5 pt-1.5 pb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500 flex items-center gap-2">
          <s.group.icon size={12} /> {s.group.title}
        </p>
        {s.group.items.map(item => (
          <NavItem key={item.path} {...item} compact onNavClick={float.close} />
        ))}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════════
export default function Sidebar({ open, mini = false, isDesktop = true, onClose, onToggle, onSearch }) {
  const { profile, isAdmin, canAccessPayroll, signOut, displayName, roleLabel, avatarUrl } = useAuth()
  const { company } = useCompany()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const float = useFloat()
  const { close: closeFloat } = float

  useEffect(() => { closeFloat() }, [pathname, mini, closeFloat])

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  const roleStyle = ROLE_COLORS[roleLabel] ?? { bg: 'rgba(148,163,184,0.15)', text: '#94a3b8' }

  return (
    <>
      <style>{`@keyframes sbFloat { from { opacity: 0; transform: translateX(-4px) } to { opacity: 1; transform: none } }`}</style>

      {/* Mobile overlay */}
      <div
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-20 lg:hidden transition-opacity duration-300
          ${open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        aria-label="Main navigation"
        className={`fixed inset-y-0 left-0 w-64 ${mini ? 'lg:w-[76px]' : 'lg:w-64'} flex flex-col z-30 shadow-2xl
          transform transition-[transform,width] duration-300 ease-out
          ${open ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}
        style={{ background: 'linear-gradient(180deg, #0f172a 0%, #0f1729 100%)' }}
      >
        <div className="absolute inset-x-0 top-0 h-px"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(99,102,241,0.5), transparent)' }} />

        {/* Brand */}
        <div className={`h-16 flex items-center shrink-0 ${mini ? 'justify-center px-2' : 'gap-3 px-5'}`}
          style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <Link to="/dashboard" aria-label={company.name}
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 hover:scale-105 transition-transform"
            style={{ background: 'linear-gradient(135deg, #6366f1, #3b82f6)', boxShadow: '0 6px 18px rgba(99,102,241,0.35)' }}>
            <Sparkles size={15} className="text-white" strokeWidth={2} />
          </Link>
          {!mini && (
            <>
              <div className="leading-tight min-w-0 flex-1">
                <p className="text-white font-bold text-sm tracking-tight truncate">{company.name}</p>
                <p className="text-slate-500 text-[10px] truncate">{company.tagline}</p>
              </div>
              {!isDesktop && (
                <button onClick={onClose} aria-label="Close menu"
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors">
                  <X size={17} />
                </button>
              )}
            </>
          )}
        </div>

        {/* Search */}
        <div className={`pt-3 ${mini ? 'px-2' : 'px-3'}`}>
          {mini ? (
            <RailButton label="Search · Ctrl K" onClick={onSearch} float={float}><Search size={18} strokeWidth={1.8} /></RailButton>
          ) : (
            <button onClick={onSearch}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-slate-400 hover:text-white transition-colors"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <Search size={15} strokeWidth={1.8} />
              <span className="flex-1 text-left">Search…</span>
              <kbd className="text-[10px] font-semibold text-slate-500 border border-white/10 rounded-md px-1.5 py-0.5">Ctrl K</kbd>
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav className={`flex-1 overflow-y-auto overflow-x-hidden py-4 ${mini ? 'px-2 space-y-1' : 'px-3 space-y-0.5'}`}
          onScroll={closeFloat}>
          {mini ? (
            <>
              {MAIN_NAV.map(item => <RailLink key={item.path} {...item} float={float} />)}
              <Divider />
              <RailGroup group={ATTENDANCE} float={float} />
              {canAccessPayroll && <RailGroup group={PAYROLL} float={float} />}
            </>
          ) : (
            <>
              <SectionLabel>Main</SectionLabel>
              {MAIN_NAV.map(item => <NavItem key={item.path} {...item} onNavClick={onClose} />)}
              <Divider />
              <SectionLabel>Attendance</SectionLabel>
              <SectionDropdown {...ATTENDANCE} onNavClick={onClose} />
              {canAccessPayroll && (
                <>
                  <Divider />
                  <SectionLabel>Payroll</SectionLabel>
                  <SectionDropdown {...PAYROLL} onNavClick={onClose} />
                </>
              )}
            </>
          )}
        </nav>

        {/* Footer */}
        <div className="shrink-0" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          {mini ? (
            <div className="px-2 py-2 space-y-1">
              {isAdmin && <RailLink path="/users" icon={UsersRound} label="Users" float={float} />}
              <RailLink path="/settings" icon={Settings} label="Settings" float={float} />
              <RailButton label="Sign out" onClick={handleSignOut} float={float} danger><LogOut size={18} strokeWidth={1.8} /></RailButton>
              <RailButton label="Expand sidebar · Ctrl B" onClick={onToggle} float={float}><PanelLeftOpen size={18} strokeWidth={1.8} /></RailButton>
              <Link to="/settings?tab=profile" aria-label={displayName}
                onMouseEnter={e => float.tip(`${displayName}${roleLabel ? ` · ${roleLabel}` : ''}`, e.currentTarget)} onMouseLeave={float.hide}
                className="flex justify-center pt-1.5 pb-1">
                <span className="relative">
                  <Avatar id={profile?.id} name={displayName} src={avatarUrl} size="w-9 h-9 text-xs" rounded="rounded-full" />
                  <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 ring-2 ring-[#0f1729]" />
                </span>
              </Link>
            </div>
          ) : (
            <>
              <div className="px-3 pt-2 pb-2 space-y-0.5">
                {isAdmin && <NavItem path="/users" icon={UsersRound} label="Users" onNavClick={onClose} />}
                <NavItem path="/settings" icon={Settings} label="Settings" onNavClick={onClose} />
                <button onClick={handleSignOut}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:bg-red-500/15 hover:text-red-400 transition-all duration-150">
                  <LogOut size={16} strokeWidth={1.8} />
                  Sign Out
                </button>
                {isDesktop && (
                  <button onClick={onToggle}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-500 hover:text-white hover:bg-white/[0.07] transition-all duration-150">
                    <PanelLeftClose size={16} strokeWidth={1.8} />
                    <span className="flex-1 text-left">Collapse</span>
                    <kbd className="text-[10px] font-semibold text-slate-600 border border-white/10 rounded-md px-1.5 py-0.5">Ctrl B</kbd>
                  </button>
                )}
              </div>

              <div className="px-3 pb-4 pt-1">
                <NavLink to="/settings?tab=profile" onClick={onClose}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-white/10 transition-colors"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <span className="relative shrink-0">
                    <Avatar id={profile?.id} name={displayName} src={avatarUrl} size="w-8 h-8 text-xs" rounded="rounded-full" />
                    <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-[#0f1729]" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-white truncate capitalize leading-tight">{displayName}</p>
                    {roleLabel && (
                      <span className="mt-0.5 inline-block text-[10px] font-bold px-2 py-0.5 rounded-full"
                        style={{ background: roleStyle.bg, color: roleStyle.text }}>
                        {roleLabel}
                      </span>
                    )}
                  </div>
                </NavLink>
              </div>
            </>
          )}
        </div>
      </aside>

      {mini && <FloatLayer float={float} />}
    </>
  )
}
