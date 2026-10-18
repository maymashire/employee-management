import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Bell, Search, ChevronDown, UserCircle2, KeyRound, SlidersHorizontal, UsersRound, LogOut, Download } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { Avatar } from '../ui'
import Hamburger from './Hamburger'
import { BRAND } from '../Brand'

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
  '/users':                   'Users',
}

function todayLabel() {
  return new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

export default function Header({ onMenuToggle, collapsed = false, mobileOpen = false, isDesktop = true, onOpenPalette }) {
  const { pathname } = useLocation()
  const { profile, displayName, fullEmail, roleLabel, avatarUrl, isAdmin, signOut } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)

  const pageTitle = PATH_TITLES[pathname] ?? BRAND.name

  useEffect(() => { setMenuOpen(false) }, [pathname])

  useEffect(() => {
    if (!menuOpen) return
    const close = e => { if (!menuRef.current?.contains(e.target)) setMenuOpen(false) }
    const esc   = e => { if (e.key === 'Escape') setMenuOpen(false) }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc) }
  }, [menuOpen])

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  const MENU = [
    { label: 'My profile',      Icon: UserCircle2,       to: '/settings?tab=profile' },
    { label: 'Change password', Icon: KeyRound,          to: '/settings?tab=security' },
    { label: 'Preferences',     Icon: SlidersHorizontal, to: '/settings?tab=preferences' },
    { label: 'Install app',     Icon: Download,          to: '/settings?tab=app' },
    ...(isAdmin ? [{ label: 'Manage users', Icon: UsersRound, to: '/users' }] : []),
  ]

  return (
    <header className={`fixed top-0 left-0 right-0 h-16 z-20 flex items-center justify-between px-4 lg:px-6 transition-[left] duration-300 ease-out
      ${collapsed ? 'lg:left-[76px]' : 'lg:left-64'}`}
      style={{
        background: 'rgba(255,255,255,0.85)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(0,0,0,0.07)',
      }}>

      {/* Left */}
      <div className="flex items-center gap-3 min-w-0">
        <button onClick={onMenuToggle}
          aria-label={isDesktop ? (collapsed ? 'Expand sidebar' : 'Collapse sidebar') : (mobileOpen ? 'Close menu' : 'Open menu')}
          aria-expanded={isDesktop ? !collapsed : mobileOpen}
          title={isDesktop ? `${collapsed ? 'Expand' : 'Collapse'} sidebar (Ctrl+B)` : 'Menu'}
          className="w-10 h-10 rounded-xl flex items-center justify-center text-gray-600 hover:bg-gray-100 hover:text-gray-900 active:scale-95 transition-all shrink-0 -ml-1.5">
          <Hamburger variant={!isDesktop && mobileOpen ? 'close' : isDesktop && collapsed ? 'mini' : 'open'} />
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

        {/* Search / command palette */}
        <button aria-label="Search" onClick={onOpenPalette}
          className="hidden md:flex items-center gap-2 pl-3 pr-2 py-1.5 mr-1 rounded-xl text-sm text-gray-400 bg-gray-50 border border-gray-200 hover:border-gray-300 hover:text-gray-600 transition-colors w-56">
          <Search size={15} />
          <span className="flex-1 text-left">Search…</span>
          <kbd className="text-[10px] font-semibold border border-gray-200 bg-white rounded-md px-1.5 py-0.5">Ctrl K</kbd>
        </button>
        <button aria-label="Search" onClick={onOpenPalette}
          className="md:hidden p-2 rounded-xl text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors">
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

        {/* User menu */}
        <div className="relative" ref={menuRef}>
          <button onClick={() => setMenuOpen(o => !o)} aria-haspopup="menu" aria-expanded={menuOpen}
            className={`flex items-center gap-2 pl-1 pr-2 py-1.5 rounded-xl transition-colors ${menuOpen ? 'bg-gray-100' : 'hover:bg-gray-100'}`}>
            <Avatar id={profile?.id} name={displayName} src={avatarUrl} size="w-8 h-8 text-xs" rounded="rounded-full" />
            <div className="hidden sm:block text-left leading-tight">
              <p className="text-sm font-semibold text-gray-800 max-w-[140px] truncate">{displayName}</p>
              <p className="text-[11px] text-gray-400">{roleLabel}</p>
            </div>
            <ChevronDown size={12} className={`hidden sm:block text-gray-400 ml-0.5 transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
          </button>

          {menuOpen && (
            <div role="menu"
              className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden z-50"
              style={{ animation: 'hdrMenuIn .15s ease-out' }}>
              <div className="flex items-center gap-3 px-4 py-3.5 border-b border-gray-100 bg-gray-50/60">
                <Avatar id={profile?.id} name={displayName} src={avatarUrl} size="w-10 h-10 text-xs" rounded="rounded-full" />
                <div className="min-w-0">
                  <p className="text-sm font-bold text-gray-900 truncate">{displayName}</p>
                  <p className="text-xs text-gray-400 truncate">{fullEmail}</p>
                </div>
              </div>
              <div className="p-1.5">
                {MENU.map(({ label, Icon, to }) => (
                  <button key={label} role="menuitem" onClick={() => navigate(to)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors">
                    <Icon size={16} className="text-gray-400" /> {label}
                  </button>
                ))}
              </div>
              <div className="p-1.5 border-t border-gray-100">
                <button role="menuitem" onClick={handleSignOut}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-semibold text-red-500 hover:bg-red-50 transition-colors">
                  <LogOut size={16} /> Sign out
                </button>
              </div>
            </div>
          )}
          <style>{`@keyframes hdrMenuIn { from { opacity: 0; transform: translateY(-4px) scale(.98) } to { opacity: 1; transform: none } }`}</style>
        </div>
      </div>
    </header>
  )
}
