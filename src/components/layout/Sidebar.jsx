import { useState, useEffect } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Users, Building2,
  Clock, CalendarDays, ScanLine, Calendar, BarChart3,
  Wallet, FileSpreadsheet, Calculator, FileText, History,
  Settings, LogOut, ChevronDown, Activity, Sparkles, UsersRound,
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

const ATTENDANCE_ITEMS = [
  { label: 'Daily Attendance', path: '/attendance/daily',        icon: CalendarDays },
  { label: 'Check In / Out',   path: '/attendance/check-in-out', icon: ScanLine },
  { label: 'Calendar',         path: '/attendance/calendar',     icon: Calendar },
  { label: 'Reports',          path: '/attendance/reports',      icon: BarChart3 },
]

const PAYROLL_ITEMS = [
  { label: 'Salary List',     path: '/payroll/salary-list', icon: FileSpreadsheet },
  { label: 'Payroll Process', path: '/payroll/process',     icon: Calculator },
  { label: 'Payslips',        path: '/payroll/payslips',    icon: FileText },
  { label: 'History',         path: '/payroll/history',     icon: History },
  { label: 'Reports',         path: '/payroll/reports',     icon: BarChart3 },
  { label: 'Pay Status',      path: '/payroll/pay-status',  icon: Clock },
]

function NavItem({ path, icon: Icon, label, compact = false, onNavClick }) {
  return (
    <NavLink
      to={path}
      onClick={onNavClick}
      className={({ isActive }) =>
        `flex items-center gap-2.5 rounded-xl text-sm font-medium transition-all duration-150
         ${compact ? 'px-3 py-1.5' : 'px-3 py-2.5'}
         ${isActive
           ? 'text-white shadow-md'
           : 'text-slate-400 hover:text-white hover:bg-white/8'
         }`
      }
      style={({ isActive }) => isActive ? {
        background: 'linear-gradient(135deg, rgba(99,102,241,0.9) 0%, rgba(59,130,246,0.9) 100%)',
        boxShadow: '0 4px 14px rgba(99,102,241,0.4)',
      } : undefined}
    >
      <Icon size={compact ? 13 : 15} strokeWidth={1.8} />
      {label}
    </NavLink>
  )
}

function SectionDropdown({ title, icon: Icon, items, basePath, onNavClick }) {
  const { pathname } = useLocation()
  const childIsActive = pathname.startsWith(basePath)
  const [open, setOpen] = useState(childIsActive)

  useEffect(() => {
    if (childIsActive) setOpen(true)
  }, [childIsActive])

  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium
          transition-all duration-150
          ${childIsActive
            ? 'text-white bg-white/10'
            : 'text-slate-400 hover:text-white hover:bg-white/8'
          }`}
      >
        <span className="flex items-center gap-2.5">
          <Icon size={15} strokeWidth={1.8} />
          {title}
        </span>
        <ChevronDown
          size={12}
          className="transition-transform duration-200 shrink-0 opacity-50"
          style={{ transform: open ? 'rotate(0deg)' : 'rotate(-90deg)' }}
        />
      </button>

      {open && (
        <div className="mt-0.5 ml-5 pl-3 border-l border-white/10 space-y-0.5">
          {items.map(item => (
            <NavItem key={item.path} {...item} compact onNavClick={onNavClick} />
          ))}
        </div>
      )}
    </div>
  )
}

const ROLE_COLORS = {
  Admin:   { bg: 'rgba(251,191,36,0.15)', text: '#fbbf24' },
  HR:      { bg: 'rgba(52,211,153,0.15)', text: '#34d399' },
  Finance: { bg: 'rgba(96,165,250,0.15)', text: '#60a5fa' },
  Manager: { bg: 'rgba(167,139,250,0.15)', text: '#a78bfa' },
}

export default function Sidebar({ open, onClose }) {
  const { profile, isAdmin, canAccessPayroll, signOut, displayName, roleLabel, avatarUrl } = useAuth()
  const { company } = useCompany()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  const roleStyle = ROLE_COLORS[roleLabel] ?? { bg: 'rgba(148,163,184,0.15)', text: '#94a3b8' }

  return (
    <>
      {/* Mobile overlay */}
      <div
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-20 lg:hidden transition-opacity duration-300
          ${open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sidebar panel */}
      <aside
        className={`fixed inset-y-0 left-0 w-64 flex flex-col z-30 shadow-2xl
          transform transition-transform duration-300 ease-in-out
          ${open ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}
        style={{ background: 'linear-gradient(180deg, #0f172a 0%, #0f1729 100%)' }}
      >
        {/* Subtle top highlight */}
        <div className="absolute inset-x-0 top-0 h-px"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(99,102,241,0.5), transparent)' }} />

        {/* Brand */}
        <div className="h-16 flex items-center gap-3 px-5 shrink-0"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'linear-gradient(135deg, #6366f1, #3b82f6)' }}>
            <Sparkles size={14} className="text-white" strokeWidth={2} />
          </div>
          <div className="leading-tight">
            <p className="text-white font-bold text-sm tracking-tight truncate max-w-[160px]">{company.name}</p>
            <p className="text-slate-500 text-[10px] truncate max-w-[160px]">{company.tagline}</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">

          <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-600">
            Main
          </p>

          {MAIN_NAV.map(item => (
            <NavItem key={item.path} {...item} onNavClick={onClose} />
          ))}

          <div className="py-2">
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }} />
          </div>

          <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-600">
            Attendance
          </p>

          <SectionDropdown
            title="Attendance"
            icon={Clock}
            items={ATTENDANCE_ITEMS}
            basePath="/attendance"
            onNavClick={onClose}
          />

          {canAccessPayroll && (
            <>
              <div className="py-2">
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }} />
              </div>
              <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-600">
                Payroll
              </p>
              <SectionDropdown
                title="Payroll"
                icon={Wallet}
                items={PAYROLL_ITEMS}
                basePath="/payroll"
                onNavClick={onClose}
              />
            </>
          )}
        </nav>

        {/* Footer */}
        <div className="shrink-0" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>

          <div className="px-3 pt-2 pb-2 space-y-0.5">
            {isAdmin && <NavItem path="/users" icon={UsersRound} label="Users" onNavClick={onClose} />}
            <NavItem path="/settings" icon={Settings} label="Settings" onNavClick={onClose} />
            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium
                text-slate-400 hover:bg-red-500/15 hover:text-red-400 transition-all duration-150"
            >
              <LogOut size={15} strokeWidth={1.8} />
              Sign Out
            </button>
          </div>

          {/* User card */}
          <div className="px-3 pb-4 pt-1">
            <NavLink to="/settings?tab=profile" onClick={onClose}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-white/10 transition-colors"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <Avatar id={profile?.id} name={displayName} src={avatarUrl} size="w-8 h-8 text-xs" rounded="rounded-full" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-white truncate capitalize leading-tight">
                  {displayName}
                </p>
                {roleLabel && (
                  <span className="mt-0.5 inline-block text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{ background: roleStyle.bg, color: roleStyle.text }}>
                    {roleLabel}
                  </span>
                )}
              </div>
            </NavLink>
          </div>
        </div>
      </aside>
    </>
  )
}
