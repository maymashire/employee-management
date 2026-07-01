import { useState, useEffect } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Users, Building2,
  Clock, CalendarDays, ScanLine, Calendar, BarChart3,
  Wallet, FileSpreadsheet, Calculator, FileText, History,
  Settings, LogOut, ChevronDown, HeartHandshake, Activity,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

// ─── nav definitions ──────────────────────────────────────────────────────────

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

// ─── sub-components ───────────────────────────────────────────────────────────

function NavItem({ path, icon: Icon, label, compact = false }) {
  return (
    <NavLink
      to={path}
      className={({ isActive }) =>
        `flex items-center gap-2.5 rounded-lg text-sm font-medium transition-colors duration-150
         ${compact ? 'px-3 py-1.5' : 'px-3 py-2'}
         ${isActive
           ? 'bg-white/15 text-white'
           : 'text-blue-200 hover:bg-white/10 hover:text-white'
         }`
      }
    >
      <Icon size={compact ? 14 : 16} strokeWidth={1.75} />
      {label}
    </NavLink>
  )
}

function SectionDropdown({ title, icon: Icon, items, basePath }) {
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
        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium
          transition-colors duration-150
          ${childIsActive
            ? 'bg-white/10 text-white'
            : 'text-blue-200 hover:bg-white/10 hover:text-white'
          }`}
      >
        <span className="flex items-center gap-2.5">
          <Icon size={16} strokeWidth={1.75} />
          {title}
        </span>
        <ChevronDown
          size={13}
          className="transition-transform duration-200 shrink-0 opacity-60"
          style={{ transform: open ? 'rotate(0deg)' : 'rotate(-90deg)' }}
        />
      </button>

      {open && (
        <div className="mt-0.5 ml-6 pl-3 border-l border-blue-700/50 space-y-0.5">
          {items.map(item => (
            <NavItem key={item.path} {...item} compact />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

const ROLE_BADGE = {
  Admin:   'bg-amber-400/20 text-amber-300',
  HR:      'bg-emerald-400/20 text-emerald-300',
  Finance: 'bg-blue-300/20 text-blue-200',
  Manager: 'bg-purple-400/20 text-purple-300',
}

export default function Sidebar() {
  const { isAdmin, canAccessPayroll, signOut, displayName, roleLabel, initials } = useAuth()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <aside className="fixed inset-y-0 left-0 w-64 bg-[#1e3a8a] flex flex-col z-30 shadow-xl">

      {/* Brand */}
      <div className="h-16 flex items-center gap-3 px-5 border-b border-blue-800/70 shrink-0">
        <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shrink-0">
          <HeartHandshake size={16} className="text-[#1e3a8a]" strokeWidth={2} />
        </div>
        <div className="leading-tight">
          <p className="text-white font-bold text-sm tracking-tight">VibeHR</p>
          <p className="text-blue-300 text-[10px]">Better Culture, Better Work.</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">

        <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-blue-400/80">
          Main
        </p>

        {MAIN_NAV.map(item => <NavItem key={item.path} {...item} />)}

        <div className="py-1">
          <div className="border-t border-blue-800/60" />
        </div>

        <SectionDropdown
          title="Attendance"
          icon={Clock}
          items={ATTENDANCE_ITEMS}
          basePath="/attendance"
        />

        {canAccessPayroll && (
          <>
            <div className="py-1">
              <div className="border-t border-blue-800/60" />
            </div>
            <SectionDropdown
              title="Payroll"
              icon={Wallet}
              items={PAYROLL_ITEMS}
              basePath="/payroll"
            />
          </>
        )}
      </nav>

      {/* Footer */}
      <div className="shrink-0 border-t border-blue-800/70">

        {/* Settings + Sign Out */}
        <div className="px-3 pt-2 pb-2 space-y-0.5">
          {isAdmin && <NavItem path="/settings" icon={Settings} label="Settings" />}
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium
              text-blue-200 hover:bg-red-500/20 hover:text-red-300 transition-colors duration-150"
          >
            <LogOut size={16} strokeWidth={1.75} />
            Sign Out
          </button>
        </div>

        {/* User profile card — pinned to bottom */}
        <div className="px-3 pb-3 border-t border-blue-800/50 pt-2">
          <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-white/5">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center shrink-0 text-xs font-extrabold text-white">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-white truncate capitalize leading-tight">
                {displayName}
              </p>
              {roleLabel && (
                <span className={`mt-0.5 inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${ROLE_BADGE[roleLabel] ?? 'bg-white/10 text-blue-200'}`}>
                  {roleLabel}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

    </aside>
  )
}
