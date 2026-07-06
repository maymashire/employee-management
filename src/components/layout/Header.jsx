import { useLocation, useNavigate } from 'react-router-dom'
import { Bell, Search, ChevronDown, Menu } from 'lucide-react'
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
  '/settings':                'Settings',
}

export default function Header({ onMenuToggle }) {
  const { pathname } = useLocation()
  const { displayName, roleLabel, signOut } = useAuth()
  const navigate = useNavigate()

  const pageTitle = PATH_TITLES[pathname] ?? 'VibeHR'

  const initials = displayName
    .split(' ')
    .slice(0, 2)
    .map(w => w[0] ?? '')
    .join('')
    .toUpperCase()

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <header className="fixed top-0 left-0 right-0 lg:left-64 h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 lg:px-6 z-20">

      {/* Left — hamburger (mobile only) + page title */}
      <div className="flex items-center gap-2 min-w-0">
        <button
          onClick={onMenuToggle}
          aria-label="Toggle navigation"
          className="lg:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors shrink-0 -ml-1"
        >
          <Menu size={20} />
        </button>
        <h1 className="text-[16px] lg:text-[17px] font-semibold text-gray-800 tracking-tight truncate">
          {pageTitle}
        </h1>
      </div>

      {/* Right — actions + user */}
      <div className="flex items-center gap-1 lg:gap-2 shrink-0">

        {/* Search — hidden on very small screens */}
        <button
          aria-label="Search"
          className="hidden sm:flex p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
        >
          <Search size={17} />
        </button>

        <button
          aria-label="Notifications"
          className="relative p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
        >
          <Bell size={17} />
          <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-red-500 rounded-full ring-2 ring-white" />
        </button>

        <div className="hidden sm:block mx-1 h-6 w-px bg-gray-200" />

        {/* User — avatar only on xs, avatar + name on sm+ */}
        <button
          onClick={handleSignOut}
          title="Click to sign out"
          className="flex items-center gap-2 pl-1 pr-1 sm:pr-2 py-1.5 rounded-xl hover:bg-gray-100 transition-colors"
        >
          <div className="w-8 h-8 rounded-full bg-[#1e3a8a] flex items-center justify-center text-white text-xs font-bold shrink-0">
            {initials}
          </div>
          <div className="hidden sm:block text-left leading-tight">
            <p className="text-sm font-semibold text-gray-800">{displayName}</p>
            <p className="text-[11px] text-gray-400">{roleLabel}</p>
          </div>
          <ChevronDown size={13} className="hidden sm:block text-gray-400 ml-1" />
        </button>
      </div>
    </header>
  )
}
