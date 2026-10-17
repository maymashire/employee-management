/** Attendance helpers shared by the attendance pages, analytics and employee profile. */
import { CheckCircle2, Clock, Hourglass, UserX, Sun } from 'lucide-react'

// Status palette — same hues as Daily Attendance; stack order validated for CVD.
export const ATT_STATUS = {
  present:  { label: 'Present',  color: '#10b981', Icon: CheckCircle2, badge: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200', soft: 'bg-emerald-50 border-emerald-200 text-emerald-700', dot: 'bg-emerald-500' },
  late:     { label: 'Late',     color: '#f59e0b', Icon: Clock,        badge: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',       soft: 'bg-amber-50 border-amber-200 text-amber-700',       dot: 'bg-amber-500' },
  half_day: { label: 'Half day', color: '#0ea5e9', Icon: Hourglass,    badge: 'bg-sky-50 text-sky-700 ring-1 ring-sky-200',             soft: 'bg-sky-50 border-sky-200 text-sky-700',             dot: 'bg-sky-500' },
  absent:   { label: 'Absent',   color: '#f43f5e', Icon: UserX,        badge: 'bg-rose-50 text-rose-700 ring-1 ring-rose-200',          soft: 'bg-rose-50 border-rose-200 text-rose-700',          dot: 'bg-rose-500' },
  holiday:  { label: 'Holiday',  color: '#8b5cf6', Icon: Sun,          badge: 'bg-violet-50 text-violet-700 ring-1 ring-violet-200',    soft: 'bg-violet-50 border-violet-200 text-violet-700',    dot: 'bg-violet-500' },
}
export const ATT_KEYS  = Object.keys(ATT_STATUS)
export const STACK_KEYS = ['present', 'late', 'half_day', 'absent']
export const ATTENDED  = ['present', 'late', 'half_day']

const pad = n => String(n).padStart(2, '0')
export const toDateStr = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const addDays   = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }
export const parseDate = s => new Date(`${s}T00:00:00`)
export const minsOf    = t => { if (!t) return null; const [h, m] = t.split(':').map(Number); return h * 60 + m }
export const hhmm      = d => `${pad(d.getHours())}:${pad(d.getMinutes())}`

export function fmtClock(mins) {
  if (mins == null) return '—'
  const d = new Date(); d.setHours(Math.floor(mins / 60), Math.round(mins % 60), 0, 0)
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}
export const fmtTime = t => (t ? fmtClock(minsOf(t)) : '—')
export const fmtDur  = m => (m == null ? '—' : `${Math.floor(m / 60)}h ${pad(Math.round(m % 60))}m`)
export const workedMins = (inT, outT) => {
  const a = minsOf(inT), b = minsOf(outT)
  return a != null && b != null && b > a ? b - a : null
}

/** Count statuses and derive rates for a list of attendance records. */
export function summarize(records) {
  const c = { present: 0, late: 0, half_day: 0, absent: 0, holiday: 0 }
  records.forEach(r => { if (r.status in c) c[r.status]++ })
  const attended = c.present + c.late + c.half_day
  const counted  = attended + c.absent
  const worked   = records.map(r => workedMins(r.clock_in, r.clock_out)).filter(v => v != null)
  const ins      = records.map(r => minsOf(r.clock_in)).filter(v => v != null)
  return {
    ...c, attended, total: records.length,
    rate:   counted ? Math.round((attended / counted) * 1000) / 10 : null,
    onTime: c.present + c.late ? Math.round((c.present / (c.present + c.late)) * 1000) / 10 : null,
    avgWorked: worked.length ? worked.reduce((s, v) => s + v, 0) / worked.length : null,
    avgIn:     ins.length ? ins.reduce((s, v) => s + v, 0) / ins.length : null,
  }
}

/** Minutes worked past the end of the shift, summed over records. */
export function overtimeMins(records, shiftEnd = '17:00') {
  const end = minsOf(shiftEnd)
  return records.reduce((s, r) => {
    const out = minsOf(r.clock_out)
    return out != null && out > end ? s + (out - end) : s
  }, 0)
}

export function StatusPill({ status, empty = 'Not marked' }) {
  const m = ATT_STATUS[status]
  if (!m) return <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold text-gray-400 bg-gray-50 ring-1 ring-gray-200 whitespace-nowrap">{empty}</span>
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap ${m.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${m.dot}`} /> {m.label}
    </span>
  )
}
