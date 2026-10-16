import { useLocation, useNavigate } from 'react-router-dom'
import { Bell, Search, Menu, ChevronDown } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

const PATH_TITLES = {
  '/dashboard':               'Dashboard',
  '/employees':               'Employees',
  '/departments':             'Departments',
  '/attendance/daily':        'Daily Attendance',
  '/attendance/check-in-out': 'Check In / Out',
  '/attendance/calendar':     'Attendance Calendar',
  '/attendance/reports':      'Attendance Reports',
  '/payroll/salary-list':     'Salary List',
  '/payroll/process':         'Payroll Process',
  '/payroll/payslips':        'Payslips',
  '/payroll/history':         'Salary History',
  '/payroll/reports':         'Payroll Reports',
  '/payroll/pay-status':      'Pay Status',
  '/analytics':               'Analytics',
  '/settings':                'Settings',
}

function todayLabel() {
  return new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

export default function Header({ onMenuToggle }) {
  const { pathname } = useLocation()
  const { displayName, roleLabel, signOut } = useAuth()
  const navigate = useNavigate()

  const pageTitle = PATH_TITLES[pathname] ?? 'WorkForce'

  const initials = displayName
    .split(' ').slice(0, 2).map(w => w[0] ?? '').join('').toUpperCase()

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <header className="fixed top-0 left-0 right-0 lg:left-64 h-16 z-20 flex items-center justify-between px-4 lg:px-6"
      style={{
        background: 'rgba(255,255,255,0.85)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(0,0,0,0.07)',
      }}>

      {/* Left */}
      <div className="flex items-center gap-3 min-w-0">
        <button onClick={onMenuToggle} aria-label="Toggle navigation"
          className="lg:hidden p-2 rounded-xl text-gray-500 hover:bg-gray-100 transition-colors shrink-0 -ml-1">
          <Menu size={20} />
        </button>
        <div className="min-w-0">
          <h1 className="text-[16px] font-bold text-gray-900 tracking-tight truncate leading-none">
            {pageTitle}
          </h1>
          <p className="text-[11px] text-gray-400 mt-0.5 hidden sm:block">{todayLabel()}</p>
        </div>
      </div>

      {/* Right */}
      <div className="flex items-center gap-1 shrink-0">

        {/* Search button */}
        <button aria-label="Search"
          className="hidden sm:flex p-2 rounded-xl text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors">
          <Search size={16} />
        </button>

        {/* Notification */}
        <button aria-label="Notifications"
          className="relative p-2 rounded-xl text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors">
          <Bell size={16} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full ring-2 ring-white"
            style={{ background: 'linear-gradient(135deg, #f43f5e, #ef4444)' }} />
        </button>

        <div className="hidden sm:block mx-1.5 h-5 w-px bg-gray-200" />

        {/* User button */}
        <button onClick={handleSignOut} title="Click to sign out"
          className="flex items-center gap-2 pl-1 pr-2 py-1.5 rounded-xl hover:bg-gray-100 transition-colors">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
            style={{ background: 'linear-gradient(135deg, #6366f1, #3b82f6)' }}>
            {initials}
          </div>
          <div className="hidden sm:block text-left leading-tight">
            <p className="text-sm font-semibold text-gray-800">{displayName}</p>
            <p className="text-[11px] text-gray-400">{roleLabel}</p>
          </div>
          <ChevronDown size={12} className="hidden sm:block text-gray-400 ml-0.5" />
        </button>
      </div>
    </header>
  )
}
