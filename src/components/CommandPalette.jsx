/**
 * Global command palette (Ctrl/⌘ + K): jump to any page, run quick actions,
 * or find an employee. Role-aware.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search, LayoutDashboard, Users, Building2, Activity, CalendarDays, ScanLine, Calendar, BarChart3,
  FileSpreadsheet, Calculator, FileText, History, Clock, UsersRound, Settings, KeyRound, UserPlus,
  CornerDownLeft, UserCircle2, SlidersHorizontal,
} from 'lucide-react'
import * as db from '../lib/db'
import { useAuth } from '../context/AuthContext'
import { Avatar } from './ui'

let employeeCache = null

const PAGES = [
  { label: 'Dashboard',            to: '/dashboard',               Icon: LayoutDashboard },
  { label: 'Employees',            to: '/employees',               Icon: Users },
  { label: 'Departments',          to: '/departments',             Icon: Building2 },
  { label: 'Analytics',            to: '/analytics',               Icon: Activity },
  { label: 'Daily attendance',     to: '/attendance/daily',        Icon: CalendarDays },
  { label: 'Check in / out',       to: '/attendance/check-in-out', Icon: ScanLine },
  { label: 'Attendance calendar',  to: '/attendance/calendar',     Icon: Calendar },
  { label: 'Attendance reports',   to: '/attendance/reports',      Icon: BarChart3 },
  { label: 'Salary list',          to: '/payroll/salary-list',     Icon: FileSpreadsheet, payroll: true },
  { label: 'Payroll process',      to: '/payroll/process',         Icon: Calculator,      payroll: true },
  { label: 'Payslips',             to: '/payroll/payslips',        Icon: FileText,        payroll: true },
  { label: 'Salary history',       to: '/payroll/history',         Icon: History,         payroll: true },
  { label: 'Payroll reports',      to: '/payroll/reports',         Icon: BarChart3,       payroll: true },
  { label: 'Pay status',           to: '/payroll/pay-status',      Icon: Clock,           payroll: true },
  { label: 'Users',                to: '/users',                   Icon: UsersRound,      admin: true },
  { label: 'Settings',             to: '/settings',                Icon: Settings },
]

const ACTIONS = [
  { label: 'Add employee',       to: '/employees?new=1',          Icon: UserPlus, people: true, keywords: 'new hire create' },
  { label: 'Mark attendance',    to: '/attendance/daily',         Icon: CalendarDays, keywords: 'present absent late' },
  { label: 'Run payroll',        to: '/payroll/process',          Icon: Calculator, payroll: true, keywords: 'generate salary pay' },
  { label: 'Add user',           to: '/users',                    Icon: UsersRound, admin: true, keywords: 'account login access' },
  { label: 'Edit my profile',    to: '/settings?tab=profile',     Icon: UserCircle2, keywords: 'photo avatar name' },
  { label: 'Change my password', to: '/settings?tab=security',    Icon: KeyRound, keywords: 'security' },
  { label: 'Preferences',        to: '/settings?tab=preferences', Icon: SlidersHorizontal, keywords: 'start page idle' },
]

const matchScore = (text, q) => {
  const t = text.toLowerCase()
  if (t.startsWith(q)) return 3
  if (t.split(/\s+/).some(w => w.startsWith(q))) return 2
  return t.includes(q) ? 1 : 0
}

export default function CommandPalette({ open, onClose }) {
  const { isAdmin, isHR, canAccessPayroll } = useAuth()
  const navigate = useNavigate()
  const [q, setQ]         = useState('')
  const [active, setActive] = useState(0)
  const [emps, setEmps]   = useState(employeeCache ?? [])
  const inputRef = useRef(null)
  const listRef  = useRef(null)

  useEffect(() => {
    if (!open) return
    setQ(''); setActive(0)
    setTimeout(() => inputRef.current?.focus(), 0)
    db.getEmployees().then(list => { employeeCache = list; setEmps(list) }).catch(() => {})
  }, [open])

  const allowed = x => (!x.payroll || canAccessPayroll) && (!x.admin || isAdmin) && (!x.people || isAdmin || isHR)

  const groups = useMemo(() => {
    const query = q.trim().toLowerCase()
    const pages   = PAGES.filter(allowed)
    const actions = ACTIONS.filter(allowed)
    if (!query) {
      return [
        { title: 'Quick actions', items: actions.slice(0, 4).map(a => ({ ...a, kind: 'action' })) },
        { title: 'Go to',         items: pages.slice(0, 8).map(p => ({ ...p, kind: 'page' })) },
      ]
    }
    const rank = (list, kind, text) => list
      .map(x => ({ ...x, kind, score: matchScore(text(x), query) }))
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score)
    const people = rank(emps, 'employee', e =>
      `${e.first_name ?? ''} ${e.last_name ?? ''} ${e.email ?? ''} ${e.job_title ?? ''} ${e.departments?.name ?? ''}`)
      .slice(0, 6)
      .map(e => ({ ...e, label: `${e.first_name ?? ''} ${e.last_name ?? ''}`.trim(), to: `/employees?view=${e.id}` }))
    return [
      { title: 'Employees', items: people },
      { title: 'Actions',   items: rank(actions, 'action', a => `${a.label} ${a.keywords ?? ''}`) },
      { title: 'Pages',     items: rank(pages, 'page', p => p.label) },
    ].filter(g => g.items.length)
  }, [q, emps, canAccessPayroll, isAdmin, isHR]) // eslint-disable-line react-hooks/exhaustive-deps

  const flat = groups.flatMap(g => g.items)

  useEffect(() => { setActive(0) }, [q])
  useEffect(() => {
    listRef.current?.querySelector(`[data-idx="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [active])

  function run(item) {
    if (!item) return
    onClose()
    navigate(item.to)
  }

  function onKey(e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(flat.length - 1, a + 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(0, a - 1)) }
    else if (e.key === 'Enter') { e.preventDefault(); run(flat[active]) }
    else if (e.key === 'Escape') { e.preventDefault(); onClose() }
  }

  if (!open) return null
  let idx = -1

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center px-4 pt-[12vh]"
      style={{ background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(3px)' }} onMouseDown={onClose}>
      <div onMouseDown={e => e.stopPropagation()}
        className="w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden"
        style={{ animation: 'cmdIn .16s ease-out both' }} role="dialog" aria-label="Command palette">
        <div className="flex items-center gap-3 px-4 border-b border-gray-100">
          <Search size={18} className="text-gray-400 shrink-0" />
          <input ref={inputRef} value={q} onChange={e => setQ(e.target.value)} onKeyDown={onKey}
            placeholder="Search employees, pages and actions…"
            className="flex-1 py-4 text-[15px] text-gray-900 placeholder:text-gray-400 bg-transparent focus:outline-none" />
          <kbd className="hidden sm:inline text-[10px] font-semibold text-gray-400 border border-gray-200 rounded-md px-1.5 py-0.5">ESC</kbd>
        </div>

        <div ref={listRef} className="max-h-[52vh] overflow-y-auto p-2">
          {flat.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-10">No results for “{q}”</p>
          ) : groups.map(g => (
            <div key={g.title} className="mb-1">
              <p className="px-3 pt-2 pb-1 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{g.title}</p>
              {g.items.map(item => {
                idx += 1
                const i = idx
                const on = i === active
                return (
                  <button key={`${item.kind}-${item.id ?? item.to}`} data-idx={i}
                    onMouseMove={() => setActive(i)} onClick={() => run(item)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors ${on ? 'bg-indigo-50' : ''}`}>
                    {item.kind === 'employee' ? (
                      <Avatar id={item.id} name={item.label} src={item.avatar_url || null} size="w-8 h-8 text-[11px]" />
                    ) : (
                      <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${on ? 'bg-[#1e3a8a] text-white' : 'bg-gray-100 text-gray-500'}`}>
                        <item.Icon size={15} />
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-gray-800 truncate">{item.label}</span>
                      {item.kind === 'employee' && (
                        <span className="block text-[11px] text-gray-400 truncate">
                          {[item.job_title, item.departments?.name, item.status !== 'active' ? item.status : null].filter(Boolean).join(' · ') || item.email}
                        </span>
                      )}
                    </span>
                    {on && <CornerDownLeft size={14} className="text-[#1e3a8a] shrink-0" />}
                  </button>
                )
              })}
            </div>
          ))}
        </div>

        <div className="flex items-center gap-4 px-4 py-2.5 border-t border-gray-100 bg-gray-50/60 text-[11px] text-gray-400">
          <span><kbd className="font-semibold">↑↓</kbd> navigate</span>
          <span><kbd className="font-semibold">↵</kbd> open</span>
          <span className="ml-auto"><kbd className="font-semibold">Ctrl</kbd> + <kbd className="font-semibold">K</kbd> anywhere</span>
        </div>
      </div>
      <style>{`@keyframes cmdIn { from { opacity: 0; transform: translateY(-6px) scale(.98) } to { opacity: 1; transform: none } }`}</style>
    </div>
  )
}
