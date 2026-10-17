/**
 * Payroll-specific helpers + UI. Generic pieces live in components/ui.jsx
 * and are re-exported here so payroll tabs import from one place.
 */
import {
  ChevronLeft, ChevronRight, CalendarDays, CircleDashed, Clock, BadgeCheck,
} from 'lucide-react'
import { computeNet } from '../../lib/db'
import { Avatar, INPUT_CLS, fullName } from '../../components/ui'

export * from '../../components/ui'
export { computeNet }

const USD  = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

const USD0 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

export const fmt$  = n => USD.format(Number(n) || 0)

export const fmt$0 = n => USD0.format(Number(n) || 0)

export const fmtK  = n => {
  const v = Number(n) || 0
  return Math.abs(v) >= 1000 ? `$${(v / 1000).toFixed(v >= 100000 ? 0 : 1)}k` : fmt$0(v)
}

export const pad          = n => String(n).padStart(2, '0')

export const monthOf      = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`

export const currentMonth = () => monthOf(new Date())

export const periodOf     = ym => `${ym}-01`

export const shiftMonth   = (ym, dir) => {
  const [y, m] = ym.split('-').map(Number)
  return monthOf(new Date(y, m - 1 + dir, 1))
}

export const fmtMonth = (ym, month = 'long') =>
  ym ? new Date(`${ym.slice(0, 7)}-01T00:00:00`).toLocaleDateString('en-US', { month, year: 'numeric' }) : '—'

export const fmtPeriod = iso => fmtMonth(iso, 'short')

export const num      = v => Number(v) || 0

export const grossOf  = r => num(r.basic_salary) + num(r.overtime) + num(r.bonus)

export const deductOf = r => num(r.deductions) + num(r.tax)

export const netOf    = r => (r.net_salary != null ? num(r.net_salary) : computeNet(r))

export const recEmpId = r => r?.employee_id ?? r?.employee_salary_config?.employee_id ?? null

export function personOf(src, empMap) {
  const id  = recEmpId(src)
  const emp = id ? empMap[id] : null
  return {
    id:     id ?? src?.id,
    emp,
    name:   emp ? fullName(emp) : (src?.employee_salary_config?.employee_name ?? src?.employee_name ?? 'Unknown'),
    dept:   emp?.departments?.name ?? src?.employee_salary_config?.department ?? src?.department ?? '',
    job:    emp?.job_title ?? '',
    former: !emp,
  }
}

export const PAY_STATUS = {
  Unpaid: {
    label: 'Unpaid', Icon: CircleDashed,
    badge:  'bg-slate-50 text-slate-600 ring-1 ring-slate-200',
    active: 'bg-slate-600 text-white shadow-sm shadow-slate-600/30',
    hover:  'hover:bg-slate-100 hover:text-slate-700',
    dot:    'bg-slate-400', bar: 'bg-slate-400', icon: 'bg-slate-100 text-slate-500',
  },
  Processing: {
    label: 'Processing', Icon: Clock,
    badge:  'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
    active: 'bg-amber-500 text-white shadow-sm shadow-amber-500/30',
    hover:  'hover:bg-amber-50 hover:text-amber-600',
    dot:    'bg-amber-500', bar: 'bg-amber-500', icon: 'bg-amber-50 text-amber-500',
  },
  Paid: {
    label: 'Paid', Icon: BadgeCheck,
    badge:  'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
    active: 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/30',
    hover:  'hover:bg-emerald-50 hover:text-emerald-600',
    dot:    'bg-emerald-500', bar: 'bg-emerald-500', icon: 'bg-emerald-50 text-emerald-500',
  },
}

export const PAY_KEYS = Object.keys(PAY_STATUS)

export function statusPatch(rec, status) {
  const now = new Date().toISOString()
  if (status === 'Unpaid')     return { status, processed_at: null, paid_at: null }
  if (status === 'Processing') return { status, processed_at: now,  paid_at: null }
  return { status, processed_at: rec.processed_at ?? now, paid_at: now }
}

export function PersonCell({ person, sub, extra }) {
  return (
    <div className="flex items-center gap-3 min-w-[190px]">
      <Avatar id={person.id} name={person.name} />
      <div className="min-w-0">
        <p className="font-semibold text-gray-800 truncate flex items-center gap-1.5">
          {person.name}
          {person.former && (
            <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-gray-100 text-gray-500">Former</span>
          )}
          {extra}
        </p>
        <p className="text-xs text-gray-400 truncate">
          {sub ?? ([person.job, person.dept].filter(Boolean).join(' · ') || '—')}
        </p>
      </div>
    </div>
  )
}

export function PayBadge({ status, fallback }) {
  const m = PAY_STATUS[status]
  if (!m) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold text-gray-400 bg-gray-50 ring-1 ring-gray-200 whitespace-nowrap">
        <CircleDashed size={12} /> {fallback ?? 'Not generated'}
      </span>
    )
  }
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap ${m.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${m.dot}`} /> {m.label}
    </span>
  )
}

export function StatusSwitch({ status, busy, onSet, stretch = false }) {
  return (
    <div className={`${stretch ? 'flex w-full' : 'inline-flex'} items-center gap-1 p-1 bg-gray-50 rounded-xl border border-gray-100`}>
      {PAY_KEYS.map(key => {
        const m  = PAY_STATUS[key]
        const on = status === key
        return (
          <button
            key={key} title={m.label} disabled={busy}
            onClick={() => !on && onSet(key)}
            className={`${stretch ? 'flex-1' : ''} h-8 px-2.5 rounded-lg flex items-center justify-center gap-1.5 text-xs font-semibold transition-all duration-150
              disabled:opacity-40 disabled:cursor-not-allowed
              ${on ? m.active : `text-gray-400 ${m.hover}`}`}
          >
            <m.Icon size={14} />
            <span className={stretch ? '' : 'hidden xl:inline'}>{m.label}</span>
          </button>
        )
      })}
    </div>
  )
}

export function MonthPicker({ value, onChange, allowAll = false }) {
  const isAll   = value === 'all'
  const isThis  = value === currentMonth()
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className={`flex items-center bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden ${isAll ? 'opacity-60' : ''}`}>
        <button onClick={() => onChange(shiftMonth(isAll ? currentMonth() : value, -1))} title="Previous month"
          className="px-2.5 py-2.5 text-gray-500 hover:bg-gray-50 hover:text-gray-800 transition-colors">
          <ChevronLeft size={16} />
        </button>
        <div className="flex items-center gap-2 px-2 border-x border-gray-100">
          <CalendarDays size={15} className="text-gray-400" />
          <input
            type="month" value={isAll ? '' : value}
            onChange={e => e.target.value && onChange(e.target.value)}
            className="py-2 text-sm font-medium text-gray-700 bg-transparent focus:outline-none"
          />
        </div>
        <button onClick={() => onChange(shiftMonth(isAll ? currentMonth() : value, 1))} title="Next month"
          className="px-2.5 py-2.5 text-gray-500 hover:bg-gray-50 hover:text-gray-800 transition-colors">
          <ChevronRight size={16} />
        </button>
      </div>
      {!isThis && (
        <button onClick={() => onChange(currentMonth())}
          className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-[#1e3a8a] text-white hover:bg-[#162d6e] shadow-sm transition-colors">
          This month
        </button>
      )}
      {allowAll && (
        <button onClick={() => onChange(isAll ? currentMonth() : 'all')}
          className={`px-4 py-2.5 rounded-xl text-sm font-semibold border shadow-sm transition-colors
            ${isAll ? 'bg-indigo-50 text-[#1e3a8a] border-[#1e3a8a]/30' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
          All periods
        </button>
      )}
    </div>
  )
}

export function MoneyInput({ label, value, onChange, tone = 'text-gray-800', disabled, hint }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-gray-500">{label}</span>
      <div className="relative mt-1">
        <span className={`absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold ${tone}`}>$</span>
        <input
          type="number" min={0} step="0.01" inputMode="decimal"
          value={value} disabled={disabled} placeholder="0.00"
          onChange={e => onChange(e.target.value)}
          className={`${INPUT_CLS} pl-7 font-semibold ${tone} disabled:opacity-60 disabled:cursor-not-allowed`}
        />
      </div>
      {hint && <span className="block text-[11px] text-gray-400 mt-1">{hint}</span>}
    </label>
  )
}
