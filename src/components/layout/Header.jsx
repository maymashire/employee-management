import { useLocation, useNavigate } from 'react-router-dom'
import { Bell, Search, ChevronDown } from 'lucide-react'
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

export default function Header() {
  const { pathname } = useLocation()
  const { displayName, roleLabel, signOut } = useAuth()
  const navigate = useNavigate()

  const pageTitle = PATH_TITLES[pathname] ?? 'VibeHR'

  // Derive initials from display name
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
    <header className="fixed top-0 left-64 right-0 h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 z-20">

      {/* Left — page title */}
      <h1 className="text-[17px] font-semibold text-gray-800 tracking-tight">
        {pageTitle}
      </h1>

      {/* Right — actions + user */}
      <div className="flex items-center gap-2">

        <button
          aria-label="Search"
          className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
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

        <div className="mx-2 h-6 w-px bg-gray-200" />

        {/* User dropdown (sign out on click for simplicity) */}
        <button
          onClick={handleSignOut}
          title="Click to sign out"
          className="flex items-center gap-2.5 pl-1 pr-2 py-1.5 rounded-xl hover:bg-gray-100 transition-colors"
        >
          <div className="w-8 h-8 rounded-full bg-[#1e3a8a] flex items-center justify-center text-white text-xs font-bold shrink-0">
            {initials}
          </div>
          <div className="text-left leading-tight">
            <p className="text-sm font-semibold text-gray-800">{displayName}</p>
            <p className="text-[11px] text-gray-400">{roleLabel}</p>
          </div>
          <ChevronDown size={13} className="text-gray-400 ml-1" />
        </button>
      </div>
    </header>
  )
}
