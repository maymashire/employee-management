import { Crown, Users, Wallet, Briefcase } from 'lucide-react'

export const ROLE_META = {
  Admin: {
    label: 'Admin', Icon: Crown, desc: 'Full access, users & settings',
    badge: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200', icon: 'bg-amber-50 text-amber-500',
    active: 'bg-amber-500 text-white border-transparent shadow-sm shadow-amber-500/30', dot: 'bg-amber-500', bar: 'bg-amber-500',
    perms: ['Full system access', 'Manage users & roles', 'Payroll & reports', 'Company settings'],
  },
  HR: {
    label: 'HR', Icon: Users, desc: 'Employees, attendance, departments',
    badge: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200', icon: 'bg-emerald-50 text-emerald-500',
    active: 'bg-emerald-500 text-white border-transparent shadow-sm shadow-emerald-500/30', dot: 'bg-emerald-500', bar: 'bg-emerald-500',
    perms: ['Employee management', 'Attendance tracking', 'Departments', 'Analytics'],
  },
  Finance: {
    label: 'Finance', Icon: Wallet, desc: 'Payroll, salaries & payslips',
    badge: 'bg-sky-50 text-sky-700 ring-1 ring-sky-200', icon: 'bg-sky-50 text-sky-500',
    active: 'bg-sky-500 text-white border-transparent shadow-sm shadow-sky-500/30', dot: 'bg-sky-500', bar: 'bg-sky-500',
    perms: ['Payroll processing', 'Salary structure', 'Payslips & pay status', 'Payroll reports'],
  },
  Manager: {
    label: 'Manager', Icon: Briefcase, desc: 'Team, attendance & dashboard',
    badge: 'bg-violet-50 text-violet-700 ring-1 ring-violet-200', icon: 'bg-violet-50 text-violet-500',
    active: 'bg-violet-500 text-white border-transparent shadow-sm shadow-violet-500/30', dot: 'bg-violet-500', bar: 'bg-violet-500',
    perms: ['Dashboard', 'Employee directory', 'Team attendance', 'Analytics'],
  },
}
export const ROLE_KEYS = Object.keys(ROLE_META)

export function RoleBadge({ role }) {
  const m = ROLE_META[role]
  if (!m) return <span className="text-xs text-gray-400">No role</span>
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap ${m.badge}`}>
      <m.Icon size={12} /> {m.label}
    </span>
  )
}

export function RolePicker({ value, onChange, disabled }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {ROLE_KEYS.map(k => {
        const m  = ROLE_META[k]
        const on = value === k
        return (
          <button key={k} type="button" disabled={disabled} onClick={() => onChange(k)}
            className={`flex items-start gap-2.5 p-3 rounded-xl border text-left transition-all disabled:opacity-50 disabled:cursor-not-allowed
              ${on ? m.active : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'}`}>
            <m.Icon size={16} className={`mt-0.5 shrink-0 ${on ? '' : 'text-gray-400'}`} />
            <span className="min-w-0">
              <span className={`block text-sm font-bold ${on ? '' : 'text-gray-800'}`}>{m.label}</span>
              <span className={`block text-[11px] leading-snug ${on ? 'text-white/85' : 'text-gray-400'}`}>{m.desc}</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}
