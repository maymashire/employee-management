/** Employee helpers shared by Employees, Departments, Analytics and attendance pages. */

export const EMP_STATUS = {
  active:     { label: 'Active',     badge: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200', dot: 'bg-emerald-500', icon: 'bg-emerald-50 text-emerald-500', bar: 'bg-emerald-500' },
  inactive:   { label: 'Inactive',   badge: 'bg-slate-50 text-slate-600 ring-1 ring-slate-200',       dot: 'bg-slate-400',   icon: 'bg-slate-100 text-slate-500',   bar: 'bg-slate-400' },
  suspended:  { label: 'Suspended',  badge: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',       dot: 'bg-amber-500',   icon: 'bg-amber-50 text-amber-500',    bar: 'bg-amber-500' },
  terminated: { label: 'Terminated', badge: 'bg-rose-50 text-rose-700 ring-1 ring-rose-200',          dot: 'bg-rose-500',    icon: 'bg-rose-50 text-rose-500',      bar: 'bg-rose-500' },
}
export const EMP_STATUS_KEYS = Object.keys(EMP_STATUS)

export const EMP_ROLE = {
  employee:      { label: 'Employee',      badge: 'bg-slate-100 text-slate-600' },
  manager:       { label: 'Manager',       badge: 'bg-violet-50 text-violet-700 ring-1 ring-violet-200' },
  administrator: { label: 'Administrator', badge: 'bg-sky-50 text-sky-700 ring-1 ring-sky-200' },
}

export const empName = e => `${e?.first_name ?? ''} ${e?.last_name ?? ''}`.trim() || 'Unnamed'

/** Ids of duplicate employee records (same first + last name), keeping the first seen. */
export function findDuplicates(employees) {
  const seen = {}; const dupes = []
  for (const emp of employees) {
    const key = `${(emp.first_name ?? '').toLowerCase().trim()}|${(emp.last_name ?? '').toLowerCase().trim()}`
    if (seen[key]) dupes.push(emp.id)
    else seen[key] = emp.id
  }
  return dupes
}

/** Months of service from hire date to today (null when unknown). */
export function tenureMonths(hireDate, now = new Date()) {
  if (!hireDate) return null
  const h = new Date(`${hireDate.slice(0, 10)}T00:00:00`)
  if (Number.isNaN(h.getTime())) return null
  return Math.max(0, (now.getFullYear() - h.getFullYear()) * 12 + (now.getMonth() - h.getMonth()) - (now.getDate() < h.getDate() ? 1 : 0))
}

export function tenureLabel(hireDate) {
  const m = tenureMonths(hireDate)
  if (m == null) return '—'
  if (m < 1) return 'New'
  const y = Math.floor(m / 12), r = m % 12
  return y ? `${y}y${r ? ` ${r}m` : ''}` : `${r}m`
}

/** Department colour themes (index stored on the department as `color`). */
export const DEPT_THEMES = [
  { name: 'Indigo',  gradient: 'linear-gradient(135deg,#4f46e5,#6366f1)', solid: '#6366f1', soft: 'bg-indigo-50 text-indigo-600' },
  { name: 'Cyan',    gradient: 'linear-gradient(135deg,#0891b2,#06b6d4)', solid: '#06b6d4', soft: 'bg-cyan-50 text-cyan-600' },
  { name: 'Emerald', gradient: 'linear-gradient(135deg,#059669,#10b981)', solid: '#10b981', soft: 'bg-emerald-50 text-emerald-600' },
  { name: 'Amber',   gradient: 'linear-gradient(135deg,#d97706,#f59e0b)', solid: '#f59e0b', soft: 'bg-amber-50 text-amber-600' },
  { name: 'Rose',    gradient: 'linear-gradient(135deg,#e11d48,#f43f5e)', solid: '#f43f5e', soft: 'bg-rose-50 text-rose-600' },
  { name: 'Violet',  gradient: 'linear-gradient(135deg,#7c3aed,#a855f7)', solid: '#a855f7', soft: 'bg-violet-50 text-violet-600' },
]
export const deptTheme = (dept, idx = 0) => DEPT_THEMES[(Number.isInteger(dept?.color) ? dept.color : idx) % DEPT_THEMES.length]
