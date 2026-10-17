import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import * as db from '../../lib/db'
import { useCompany } from '../../context/CompanyContext'
import {
  CalendarDays, ChevronLeft, ChevronRight, Loader2, CheckCircle2, AlertCircle, X,
  Search, Download, RefreshCw, Pencil, Trash2, UserCheck, Clock, UserX, Sun,
  Hourglass, CircleDashed, CheckCheck, StickyNote, Timer, LogIn, Info,
} from 'lucide-react'

// ── Constants ──────────────────────────────────────────────────────────────────

const STATUS_META = {
  present: {
    label: 'Present', Icon: UserCheck,
    badge:  'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
    active: 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/30',
    hover:  'hover:bg-emerald-50 hover:text-emerald-600',
    dot:    'bg-emerald-500',
  },
  late: {
    label: 'Late', Icon: Clock,
    badge:  'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
    active: 'bg-amber-500 text-white shadow-sm shadow-amber-500/30',
    hover:  'hover:bg-amber-50 hover:text-amber-600',
    dot:    'bg-amber-500',
  },
  absent: {
    label: 'Absent', Icon: UserX,
    badge:  'bg-rose-50 text-rose-700 ring-1 ring-rose-200',
    active: 'bg-rose-500 text-white shadow-sm shadow-rose-500/30',
    hover:  'hover:bg-rose-50 hover:text-rose-600',
    dot:    'bg-rose-500',
  },
  half_day: {
    label: 'Half Day', Icon: Hourglass,
    badge:  'bg-sky-50 text-sky-700 ring-1 ring-sky-200',
    active: 'bg-sky-500 text-white shadow-sm shadow-sky-500/30',
    hover:  'hover:bg-sky-50 hover:text-sky-600',
    dot:    'bg-sky-500',
  },
  holiday: {
    label: 'Holiday', Icon: Sun,
    badge:  'bg-violet-50 text-violet-700 ring-1 ring-violet-200',
    active: 'bg-violet-500 text-white shadow-sm shadow-violet-500/30',
    hover:  'hover:bg-violet-50 hover:text-violet-600',
    dot:    'bg-violet-500',
  },
}
const STATUS_KEYS = Object.keys(STATUS_META)
const TIMED_STATUSES = ['present', 'late', 'half_day']

const AVATAR_BG = [
  'bg-indigo-500', 'bg-sky-500', 'bg-emerald-500', 'bg-amber-500',
  'bg-rose-500', 'bg-violet-500', 'bg-teal-500', 'bg-fuchsia-500',
]

// ── Helpers ────────────────────────────────────────────────────────────────────
const pad       = n => String(n).padStart(2, '0')
const toDateStr = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const parseDate = s => new Date(`${s}T00:00:00`)
const minutesOf = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m }
const workedMins = (i, o) => (i && o ? Math.max(0, minutesOf(o) - minutesOf(i)) : null)
const fmtDur    = m => (m == null ? '—' : `${Math.floor(m / 60)}h ${pad(m % 60)}m`)
const fullName  = e => `${e.first_name ?? ''} ${e.last_name ?? ''}`.trim()
const initials  = e => `${e.first_name?.[0] ?? ''}${e.last_name?.[0] ?? ''}`.toUpperCase() || '?'
const avatarBg  = id => AVATAR_BG[[...(id ?? '')].reduce((s, c) => s + c.charCodeAt(0), 0) % AVATAR_BG.length]

const fmtTime = t => {
  if (!t) return '—'
  const d = new Date(); d.setHours(...t.split(':').map(Number))
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

function countByStatus(list) {
  const c = { all: list.length, unmarked: 0 }
  STATUS_KEYS.forEach(k => { c[k] = 0 })
  list.forEach(r => {
    const s = r.attendance?.status
    if (s in STATUS_META) c[s]++
    else c.unmarked++
  })
  return c
}

function downloadCSV(rows, filename) {
  if (!rows.length) return
  const keys = Object.keys(rows[0])
  const csv  = [keys.join(','), ...rows.map(r => keys.map(k => JSON.stringify(r[k] ?? '')).join(','))].join('\n')
  const url  = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const a    = Object.assign(document.createElement('a'), { href: url, download: filename })
  document.body.appendChild(a); a.click(); document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ── Small components ───────────────────────────────────────────────────────────
function Toast({ toast, onDismiss }) {
  useEffect(() => {
    if (!toast) return
    const id = setTimeout(onDismiss, 4000)
    return () => clearTimeout(id)
  }, [toast, onDismiss])
  if (!toast) return null
  const ok = toast.type === 'success'
  return (
    <div className={`fixed top-20 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-sm z-[70] flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl border text-sm font-medium
      ${ok ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
      {ok ? <CheckCircle2 size={17} className="text-emerald-500 shrink-0" /> : <AlertCircle size={17} className="text-red-500 shrink-0" />}
      <span className="flex-1">{toast.message}</span>
      <button onClick={onDismiss} className="opacity-50 hover:opacity-100"><X size={14} /></button>
    </div>
  )
}

function Avatar({ emp, size = 'w-10 h-10 text-xs' }) {
  return (
    <div className={`${size} ${avatarBg(emp.id)} rounded-xl flex items-center justify-center text-white font-bold shrink-0`}>
      {initials(emp)}
    </div>
  )
}

function StatusBadge({ status }) {
  const m = STATUS_META[status]
  if (!m) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold text-gray-400 bg-gray-50 ring-1 ring-gray-200 whitespace-nowrap">
        <CircleDashed size={12} /> Not marked
      </span>
    )
  }
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap ${m.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${m.dot}`} /> {m.label}
    </span>
  )
}

function RateRing({ pct }) {
  const r = 36
  const c = 2 * Math.PI * r
  return (
    <div className="relative w-[88px] h-[88px] shrink-0">
      <svg width="88" height="88" viewBox="0 0 88 88" className="-rotate-90">
        <circle cx="44" cy="44" r={r} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="9" />
        <circle
          cx="44" cy="44" r={r} fill="none" stroke="#34d399" strokeWidth="9" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)}
          style={{ transition: 'stroke-dashoffset .6s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-extrabold text-white leading-none">{pct}%</span>
      </div>
    </div>
  )
}

function StatCard({ label, value, total, Icon, iconCls, barCls, active, onClick }) {
  const pct = total ? Math.round((value / total) * 100) : 0
  return (
    <button
      onClick={onClick}
      className={`text-left bg-white rounded-2xl border p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md
        ${active ? 'border-[#1e3a8a] ring-2 ring-[#1e3a8a]/15' : 'border-gray-100'}`}
    >
      <div className="flex items-center justify-between">
        <span className={`w-9 h-9 rounded-xl flex items-center justify-center ${iconCls}`}><Icon size={17} /></span>
        <span className="text-[11px] font-semibold text-gray-400">{pct}%</span>
      </div>
      <p className="text-2xl font-extrabold text-gray-900 mt-3 leading-none">{value}</p>
      <p className="text-xs font-medium text-gray-500 mt-1">{label}</p>
      <div className="h-1 bg-gray-100 rounded-full mt-3 overflow-hidden">
        <div className={`h-full rounded-full ${barCls}`} style={{ width: `${pct}%`, transition: 'width .5s ease' }} />
      </div>
    </button>
  )
}

function QuickMark({ row, busy, isAllowed, onMark, stretch = false }) {
  return (
    <div className={`${stretch ? 'flex w-full justify-between' : 'inline-flex'} items-center gap-1 p-1 bg-gray-50 rounded-xl border border-gray-100`}>
      {STATUS_KEYS.map(key => {
        const m  = STATUS_META[key]
        const on = row.attendance?.status === key
        return (
          <button
            key={key}
            title={m.label}
            disabled={busy || !isAllowed(key)}
            onClick={() => onMark(row, key)}
            className={`${stretch ? 'flex-1' : 'w-8'} h-8 rounded-lg flex items-center justify-center transition-all duration-150
              disabled:opacity-35 disabled:cursor-not-allowed
              ${on ? m.active : `text-gray-400 ${m.hover}`}`}
          >
            <m.Icon size={15} />
          </button>
        )
      })}
    </div>
  )
}

// ── Edit modal ─────────────────────────────────────────────────────────────────
function EditModal({ row, isFuture, shiftStart, onClose, onSave, onClear }) {
  const a = row.attendance
  const [form, setForm] = useState({
    status:    a?.status ?? (isFuture ? 'holiday' : 'present'),
    clock_in:  a?.clock_in ?? '',
    clock_out: a?.clock_out ?? '',
    note:      a?.note ?? '',
  })
  const [busy,         setBusy]         = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const [error,        setError]        = useState('')

  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const timed    = TIMED_STATUSES.includes(form.status)
  const worked   = timed ? workedMins(form.clock_in, form.clock_out) : null
  const lateHint = form.status === 'present' && form.clock_in && form.clock_in > shiftStart
  const set      = patch => { setForm(f => ({ ...f, ...patch })); setError('') }

  async function submit(e) {
    e.preventDefault()
    if (isFuture && form.status !== 'holiday') {
      setError('Only holidays can be set for a future date.'); return
    }
    if (timed && form.clock_in && form.clock_out && minutesOf(form.clock_out) <= minutesOf(form.clock_in)) {
      setError('Clock out must be after clock in.'); return
    }
    setBusy(true)
    try {
      await onSave(row, {
        status:    form.status,
        clock_in:  timed ? form.clock_in || null : null,
        clock_out: timed ? form.clock_out || null : null,
        note:      form.note.trim(),
      })
      onClose()
    } catch (err) {
      setError(err.message); setBusy(false)
    }
  }

  async function clear() {
    if (!confirmClear) { setConfirmClear(true); return }
    setBusy(true)
    try {
      await onClear(row)
      onClose()
    } catch (err) {
      setError(err.message); setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(3px)' }}
      onClick={onClose}
    >
      <form
        onSubmit={submit}
        onClick={e => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl flex flex-col mx-auto"
        style={{ width: '100%', maxWidth: '500px', maxHeight: '90vh', animation: 'attModalIn .2s cubic-bezier(.4,0,.2,1) forwards' }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100 shrink-0">
          <Avatar emp={row} />
          <div className="min-w-0 flex-1">
            <p className="font-bold text-gray-900 truncate">{fullName(row)}</p>
            <p className="text-xs text-gray-400 truncate">
              {row.job_title || 'Employee'}{row.departments?.name ? ` · ${row.departments.name}` : ''}
            </p>
          </div>
          <button type="button" onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-700 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-5">
          <div>
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">Status</p>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {STATUS_KEYS.map(key => {
                const m  = STATUS_META[key]
                const on = form.status === key
                const disabled = isFuture && key !== 'holiday'
                return (
                  <button
                    key={key} type="button" disabled={disabled}
                    onClick={() => set({ status: key })}
                    className={`flex flex-col items-center gap-1.5 py-2.5 rounded-xl border text-[11px] font-semibold transition-all
                      disabled:opacity-35 disabled:cursor-not-allowed
                      ${on ? `${m.active} border-transparent` : `border-gray-200 text-gray-500 ${m.hover}`}`}
                  >
                    <m.Icon size={16} />
                    {m.label}
                  </button>
                )
              })}
            </div>
          </div>

          {timed && (
            <div>
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">Working hours</p>
              <div className="grid grid-cols-2 gap-3">
                {[['clock_in', 'Clock in'], ['clock_out', 'Clock out']].map(([key, label]) => (
                  <label key={key} className="block">
                    <span className="text-xs font-medium text-gray-500">{label}</span>
                    <input
                      type="time" value={form[key]}
                      onChange={e => set({ [key]: e.target.value })}
                      className="mt-1 w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/20 focus:border-[#1e3a8a] transition-colors"
                    />
                  </label>
                ))}
              </div>
              <div className="flex items-center gap-2 mt-3 text-xs text-gray-500">
                <Timer size={14} className="text-gray-400" />
                Worked: <span className="font-bold text-gray-800">{fmtDur(worked)}</span>
              </div>
              {lateHint && (
                <div className="mt-3 flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800">
                  <span className="flex items-center gap-2"><AlertCircle size={14} /> Arrived after {fmtTime(shiftStart)}</span>
                  <button type="button" onClick={() => set({ status: 'late' })}
                    className="px-2.5 py-1 rounded-lg bg-amber-500 text-white font-semibold hover:bg-amber-600 transition-colors">
                    Mark Late
                  </button>
                </div>
              )}
            </div>
          )}

          <label className="block">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Note</span>
            <textarea
              rows={3} value={form.note} maxLength={300}
              onChange={e => set({ note: e.target.value })}
              placeholder="e.g. Doctor appointment, approved by manager"
              className="mt-2 w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/20 focus:border-[#1e3a8a] transition-colors resize-none"
            />
          </label>

          {error && (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
              <AlertCircle size={14} className="shrink-0" /> {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-gray-100 shrink-0">
          {a ? (
            <button type="button" onClick={clear} disabled={busy}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors disabled:opacity-50
                ${confirmClear ? 'bg-red-500 text-white hover:bg-red-600' : 'text-red-500 hover:bg-red-50'}`}>
              <Trash2 size={14} /> {confirmClear ? 'Confirm remove' : 'Remove record'}
            </button>
          ) : <span />}
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-100 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={busy}
              className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold text-white bg-[#1e3a8a] hover:bg-[#162d6e] disabled:opacity-60 transition-colors">
              {busy && <Loader2 size={14} className="animate-spin" />} Save
            </button>
          </div>
        </div>
      </form>
      <style>{`
        @keyframes attModalIn {
          from { opacity: 0; transform: translateY(8px) scale(.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════════
// PAGE
// ════════════════════════════════════════════════════════════════════════════════
export default function DailyAttendance() {
  const { company } = useCompany()
  const SHIFT_START = company.shift_start || '09:00'
  const today = toDateStr(new Date())

  const [params]                    = useSearchParams()
  const [date,       setDate]       = useState(() => (/^\d{4}-\d{2}-\d{2}$/.test(params.get('date') ?? '') ? params.get('date') : today))
  const [employees,  setEmployees]  = useState([])
  const [records,    setRecords]    = useState({})   // employee_id → attendance doc
  const [loading,    setLoading]    = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [savingIds,  setSavingIds]  = useState(() => new Set())
  const [selected,   setSelected]   = useState(() => new Set())
  const [search,     setSearch]     = useState('')
  const [dept,       setDept]       = useState('all')
  const [filter,     setFilter]     = useState('all')
  const [editing,    setEditing]    = useState(null)
  const [bulkBusy,   setBulkBusy]   = useState(false)
  const [confirmAll, setConfirmAll] = useState(false)
  const [toast,      setToast]      = useState(null)
  const reqId = useRef(0)

  const showToast    = useCallback((type, message) => setToast({ type, message }), [])
  const dismissToast = useCallback(() => setToast(null), [])

  const isToday  = date === today
  const isFuture = date > today
  const isAllowed = useCallback(status => !isFuture || status === 'holiday', [isFuture])

  // ── Data ──
  const loadRecords = useCallback(async d => {
    const att = await db.getAttendanceByDate(d)
    const map = {}
    att.forEach(r => { map[r.employee_id] = r })
    return map
  }, [])

  const fetchData = useCallback(async (soft = false) => {
    const id = ++reqId.current
    soft ? setRefreshing(true) : setLoading(true)
    try {
      const [allEmps, map] = await Promise.all([db.getEmployees(), loadRecords(date)])
      if (id !== reqId.current) return
      setEmployees(allEmps.filter(e => e.status === 'active'))
      setRecords(map)
    } catch (err) {
      if (id === reqId.current) showToast('error', err.message)
    }
    if (id === reqId.current) { setLoading(false); setRefreshing(false) }
  }, [date, loadRecords, showToast])

  useEffect(() => { fetchData(); setSelected(new Set()) }, [fetchData])

  useEffect(() => {
    if (!confirmAll) return
    const t = setTimeout(() => setConfirmAll(false), 3500)
    return () => clearTimeout(t)
  }, [confirmAll])

  // ── Derived ──
  const rows = useMemo(
    () => employees.map(e => ({ ...e, attendance: records[e.id] ?? null })),
    [employees, records],
  )

  const departments = useMemo(
    () => [...new Set(employees.map(e => e.departments?.name).filter(Boolean))].sort(),
    [employees],
  )

  const scoped = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter(r =>
      (dept === 'all' || (r.departments?.name ?? '') === dept) &&
      (!q || fullName(r).toLowerCase().includes(q) || (r.job_title ?? '').toLowerCase().includes(q)),
    )
  }, [rows, search, dept])

  const visible = useMemo(() => scoped.filter(r =>
    filter === 'all' ? true
      : filter === 'unmarked' ? !(r.attendance?.status in STATUS_META)
      : r.attendance?.status === filter,
  ), [scoped, filter])

  const dayCounts   = useMemo(() => countByStatus(rows),   [rows])
  const scopeCounts = useMemo(() => countByStatus(scoped), [scoped])

  const insights = useMemo(() => {
    const attended = dayCounts.present + dayCounts.late + dayCounts.half_day
    const expected = dayCounts.all - dayCounts.holiday
    const ins  = rows.map(r => r.attendance?.clock_in).filter(Boolean).map(minutesOf)
    const work = rows.map(r => workedMins(r.attendance?.clock_in, r.attendance?.clock_out)).filter(m => m)
    const avgIn = ins.length ? Math.round(ins.reduce((s, m) => s + m, 0) / ins.length) : null
    return {
      attended,
      marked:  dayCounts.all - dayCounts.unmarked,
      rate:    expected > 0 ? Math.round((attended / expected) * 100) : 0,
      avgIn:   avgIn == null ? '—' : fmtTime(`${pad(Math.floor(avgIn / 60))}:${pad(avgIn % 60)}`),
      avgWork: work.length ? fmtDur(Math.round(work.reduce((s, m) => s + m, 0) / work.length)) : '—',
    }
  }, [rows, dayCounts])

  const unmarkedScoped = scoped.filter(r => !r.attendance)
  const selectedRows   = rows.filter(r => selected.has(r.id))
  const allVisibleSel  = visible.length > 0 && visible.every(r => selected.has(r.id))

  // ── Mutations ──
  async function saveRecord(row, patch) {
    const existing = row.attendance
    if (existing) {
      await db.updateAttendance(existing.id, patch)
      return { ...existing, ...patch }
    }
    return db.addAttendance({ employee_id: row.id, date, clock_in: null, clock_out: null, ...patch })
  }

  async function markStatus(row, status) {
    if (savingIds.has(row.id) || row.attendance?.status === status || !isAllowed(status)) return
    setSavingIds(s => new Set(s).add(row.id))
    try {
      const rec = await saveRecord(row, { status })
      setRecords(r => ({ ...r, [row.id]: rec }))
      showToast('success', `${row.first_name} marked as ${STATUS_META[status].label}`)
    } catch (err) {
      showToast('error', err.message)
    }
    setSavingIds(s => { const n = new Set(s); n.delete(row.id); return n })
  }

  async function bulkMark(targets, status) {
    if (!targets.length || bulkBusy) return
    if (!isAllowed(status)) { showToast('error', 'Only holidays can be marked for a future date'); return }
    setBulkBusy(true)
    try {
      await db.batchSetAttendanceStatus(
        date,
        targets.map(r => ({ employee_id: r.id, id: r.attendance?.id ?? null, status })),
      )
      setRecords(await loadRecords(date))
      setSelected(new Set())
      showToast('success', `${targets.length} employee${targets.length !== 1 ? 's' : ''} marked as ${STATUS_META[status].label}`)
    } catch (err) {
      showToast('error', err.message)
    }
    setBulkBusy(false)
  }

  function handleMarkRemaining() {
    if (!confirmAll) { setConfirmAll(true); return }
    setConfirmAll(false)
    bulkMark(unmarkedScoped, 'present')
  }

  async function saveEdit(row, patch) {
    const rec = await saveRecord(row, patch)
    setRecords(r => ({ ...r, [row.id]: rec }))
    showToast('success', `Attendance updated for ${row.first_name}`)
  }

  async function clearRecord(row) {
    await db.deleteAttendance(row.attendance.id)
    setRecords(r => { const n = { ...r }; delete n[row.id]; return n })
    showToast('success', `Record removed for ${row.first_name}`)
  }

  // ── Selection / nav / export ──
  function toggleOne(id) {
    setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  function toggleAllVisible() {
    setSelected(s => {
      const n = new Set(s)
      visible.forEach(r => (allVisibleSel ? n.delete(r.id) : n.add(r.id)))
      return n
    })
  }
  function stepDate(dir) {
    const d = parseDate(date)
    d.setDate(d.getDate() + dir)
    setDate(toDateStr(d))
  }
  function exportCSV() {
    downloadCSV(
      visible.map(r => ({
        Employee:   fullName(r),
        Department: r.departments?.name ?? '',
        'Job Title': r.job_title ?? '',
        Status:     STATUS_META[r.attendance?.status]?.label ?? 'Not marked',
        'Clock In':  r.attendance?.clock_in ?? '',
        'Clock Out': r.attendance?.clock_out ?? '',
        Worked:     fmtDur(workedMins(r.attendance?.clock_in, r.attendance?.clock_out)),
        Note:       r.attendance?.note ?? '',
      })),
      `attendance-${date}.csv`,
    )
  }

  const dateLabel = parseDate(date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })

  const FILTERS = [
    { key: 'all',      label: 'All',        dot: 'bg-gray-400' },
    { key: 'unmarked', label: 'Not marked', dot: 'bg-gray-300' },
    ...STATUS_KEYS.map(k => ({ key: k, label: STATUS_META[k].label, dot: STATUS_META[k].dot })),
  ]

  // ── Render ──
  return (
    <div className="space-y-5 pb-24">

      {/* ── Header ── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight">{dateLabel}</h2>
            {isToday && (
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200">Today</span>
            )}
            {isFuture && (
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-600 ring-1 ring-amber-200">Upcoming</span>
            )}
          </div>
          <p className="text-sm text-gray-400 mt-1">
            {insights.marked} of {rows.length} employees marked · Shift starts {fmtTime(SHIFT_START)}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            <button onClick={() => stepDate(-1)} title="Previous day"
              className="px-2.5 py-2.5 text-gray-500 hover:bg-gray-50 hover:text-gray-800 transition-colors">
              <ChevronLeft size={16} />
            </button>
            <div className="flex items-center gap-2 px-2 border-x border-gray-100">
              <CalendarDays size={15} className="text-gray-400" />
              <input
                type="date" value={date}
                onChange={e => e.target.value && setDate(e.target.value)}
                className="py-2 text-sm font-medium text-gray-700 bg-transparent focus:outline-none"
              />
            </div>
            <button onClick={() => stepDate(1)} title="Next day"
              className="px-2.5 py-2.5 text-gray-500 hover:bg-gray-50 hover:text-gray-800 transition-colors">
              <ChevronRight size={16} />
            </button>
          </div>
          {!isToday && (
            <button onClick={() => setDate(today)}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-[#1e3a8a] text-white hover:bg-[#162d6e] shadow-sm transition-colors">
              Today
            </button>
          )}
        </div>
      </div>

      {isFuture && (
        <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-800">
          <Info size={16} className="shrink-0" />
          This date is in the future — you can only mark holidays in advance.
        </div>
      )}

      {/* ── Overview ── */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        <div className="col-span-2 rounded-2xl p-5 text-white shadow-lg relative overflow-hidden bg-gradient-to-br from-[#1e3a8a] via-[#1e3a8a] to-indigo-900">
          <div className="absolute -top-12 -right-12 w-40 h-40 bg-indigo-400/20 rounded-full blur-3xl pointer-events-none" />
          <div className="relative flex items-center gap-5">
            <RateRing pct={insights.rate} />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-indigo-200 uppercase tracking-widest">Attendance rate</p>
              <p className="text-sm text-white/90 mt-1">
                <span className="font-bold text-white">{insights.attended}</span> of {dayCounts.all - dayCounts.holiday} attended
              </p>
              <div className="flex gap-5 mt-3">
                <div>
                  <p className="text-[10px] text-indigo-200 uppercase tracking-wider flex items-center gap-1"><LogIn size={11} /> Avg in</p>
                  <p className="text-sm font-bold mt-0.5">{insights.avgIn}</p>
                </div>
                <div>
                  <p className="text-[10px] text-indigo-200 uppercase tracking-wider flex items-center gap-1"><Timer size={11} /> Avg worked</p>
                  <p className="text-sm font-bold mt-0.5">{insights.avgWork}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <StatCard label="Present"    value={dayCounts.present}  total={dayCounts.all} Icon={UserCheck}    iconCls="bg-emerald-50 text-emerald-500" barCls="bg-emerald-500" active={filter === 'present'}  onClick={() => setFilter(f => f === 'present'  ? 'all' : 'present')} />
        <StatCard label="Late"       value={dayCounts.late}     total={dayCounts.all} Icon={Clock}        iconCls="bg-amber-50 text-amber-500"     barCls="bg-amber-500"   active={filter === 'late'}     onClick={() => setFilter(f => f === 'late'     ? 'all' : 'late')} />
        <StatCard label="Absent"     value={dayCounts.absent}   total={dayCounts.all} Icon={UserX}        iconCls="bg-rose-50 text-rose-500"       barCls="bg-rose-500"    active={filter === 'absent'}   onClick={() => setFilter(f => f === 'absent'   ? 'all' : 'absent')} />
        <StatCard label="Not marked" value={dayCounts.unmarked} total={dayCounts.all} Icon={CircleDashed} iconCls="bg-gray-100 text-gray-500"      barCls="bg-gray-400"    active={filter === 'unmarked'} onClick={() => setFilter(f => f === 'unmarked' ? 'all' : 'unmarked')} />
      </div>

      {/* ── List card ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

        {/* Toolbar */}
        <div className="p-4 border-b border-gray-100 space-y-3">
          <div className="flex flex-col md:flex-row md:items-center gap-2.5">
            <div className="relative flex-1 min-w-0">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search employee or job title…"
                className="w-full pl-9 pr-8 py-2.5 text-sm rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/20 focus:border-[#1e3a8a] transition-colors"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700">
                  <X size={14} />
                </button>
              )}
            </div>
            <select
              value={dept} onChange={e => setDept(e.target.value)}
              className="md:w-48 px-3 py-2.5 text-sm rounded-xl border border-gray-200 bg-gray-50 text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/20 focus:border-[#1e3a8a] transition-colors"
            >
              <option value="all">All departments</option>
              {departments.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <div className="flex items-center gap-2">
              {!isFuture && unmarkedScoped.length > 0 && (
                <button onClick={handleMarkRemaining} disabled={bulkBusy}
                  className={`flex-1 md:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-colors disabled:opacity-60
                    ${confirmAll
                      ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                      : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'}`}>
                  {bulkBusy ? <Loader2 size={15} className="animate-spin" /> : <CheckCheck size={15} />}
                  {confirmAll ? `Confirm · ${unmarkedScoped.length}` : `Mark ${unmarkedScoped.length} present`}
                </button>
              )}
              <button onClick={exportCSV} disabled={!visible.length} title="Export CSV"
                className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-sm font-semibold text-gray-600 border border-gray-200 hover:bg-gray-50 disabled:opacity-40 transition-colors">
                <Download size={15} /> <span className="hidden sm:inline">Export</span>
              </button>
              <button onClick={() => fetchData(true)} title="Refresh"
                className="p-2.5 rounded-xl text-gray-500 border border-gray-200 hover:bg-gray-50 transition-colors">
                <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          {/* Status filter pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto -mx-1 px-1 pb-0.5">
            {FILTERS.map(f => {
              const on = filter === f.key
              return (
                <button key={f.key} onClick={() => setFilter(f.key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors
                    ${on ? 'bg-[#1e3a8a] text-white shadow-sm' : 'bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-gray-700'}`}>
                  {!on && <span className={`w-1.5 h-1.5 rounded-full ${f.dot}`} />}
                  {f.label}
                  <span className={`px-1.5 rounded-full text-[10px] ${on ? 'bg-white/20' : 'bg-white text-gray-400 ring-1 ring-gray-200'}`}>
                    {scopeCounts[f.key]}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="divide-y divide-gray-50">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-5 py-4 animate-pulse">
                <div className="w-10 h-10 rounded-xl bg-gray-100" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-40 bg-gray-100 rounded" />
                  <div className="h-2.5 w-24 bg-gray-100 rounded" />
                </div>
                <div className="hidden md:block h-8 w-44 bg-gray-100 rounded-xl" />
              </div>
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-2 text-gray-400">
            <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center">
              <CalendarDays size={26} className="text-gray-300" />
            </div>
            <p className="text-sm font-semibold text-gray-500 mt-1">
              {rows.length === 0 ? 'No active employees found' : 'No employees match these filters'}
            </p>
            {rows.length > 0 && (
              <button onClick={() => { setSearch(''); setDept('all'); setFilter('all') }}
                className="text-xs font-semibold text-[#1e3a8a] hover:underline">
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/60">
                    <th className="pl-5 pr-2 py-3 w-10">
                      <input type="checkbox" checked={allVisibleSel} onChange={toggleAllVisible}
                        className="w-4 h-4 rounded border-gray-300 accent-[#1e3a8a] cursor-pointer" />
                    </th>
                    {['Employee', 'Check In', 'Check Out', 'Worked', 'Status', 'Quick mark', ''].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {visible.map(row => {
                    const a       = row.attendance
                    const busy    = savingIds.has(row.id) || bulkBusy
                    const isSel   = selected.has(row.id)
                    const lateIn  = a?.clock_in && a.clock_in > SHIFT_START
                    return (
                      <tr key={row.id} className={`transition-colors ${isSel ? 'bg-indigo-50/50' : 'hover:bg-gray-50/60'}`}>
                        <td className="pl-5 pr-2 py-3">
                          <input type="checkbox" checked={isSel} onChange={() => toggleOne(row.id)}
                            className="w-4 h-4 rounded border-gray-300 accent-[#1e3a8a] cursor-pointer" />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3 min-w-[200px]">
                            <Avatar emp={row} />
                            <div className="min-w-0">
                              <p className="font-semibold text-gray-800 truncate flex items-center gap-1.5">
                                {fullName(row)}
                                {a?.note && (
                                  <span title={a.note} className="text-gray-300 hover:text-gray-500 cursor-help">
                                    <StickyNote size={13} />
                                  </span>
                                )}
                              </p>
                              <p className="text-xs text-gray-400 truncate">
                                {row.job_title || 'Employee'}{row.departments?.name ? ` · ${row.departments.name}` : ''}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`text-sm ${lateIn ? 'text-amber-600 font-semibold' : 'text-gray-600'}`}>{fmtTime(a?.clock_in)}</span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{fmtTime(a?.clock_out)}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-700">
                          {fmtDur(workedMins(a?.clock_in, a?.clock_out))}
                        </td>
                        <td className="px-4 py-3">
                          {savingIds.has(row.id)
                            ? <Loader2 size={16} className="animate-spin text-[#1e3a8a]" />
                            : <StatusBadge status={a?.status} />}
                        </td>
                        <td className="px-4 py-3">
                          <QuickMark row={row} busy={busy} isAllowed={isAllowed} onMark={markStatus} />
                        </td>
                        <td className="pr-5 pl-2 py-3 text-right">
                          <button onClick={() => setEditing(row)} title="Edit details"
                            className="w-8 h-8 rounded-lg inline-flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-[#1e3a8a] transition-colors">
                            <Pencil size={15} />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-gray-100">
              {visible.map(row => {
                const a     = row.attendance
                const busy  = savingIds.has(row.id) || bulkBusy
                const isSel = selected.has(row.id)
                return (
                  <div key={row.id} className={`p-4 space-y-3 ${isSel ? 'bg-indigo-50/50' : ''}`}>
                    <div className="flex items-center gap-3">
                      <input type="checkbox" checked={isSel} onChange={() => toggleOne(row.id)}
                        className="w-4 h-4 rounded border-gray-300 accent-[#1e3a8a] shrink-0" />
                      <Avatar emp={row} />
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-gray-800 truncate">{fullName(row)}</p>
                        <p className="text-xs text-gray-400 truncate">{row.job_title || 'Employee'}</p>
                      </div>
                      {savingIds.has(row.id)
                        ? <Loader2 size={16} className="animate-spin text-[#1e3a8a]" />
                        : <StatusBadge status={a?.status} />}
                    </div>
                    {a?.clock_in && (
                      <div className="flex items-center gap-4 text-xs text-gray-500 pl-7">
                        <span>In <b className="text-gray-700">{fmtTime(a.clock_in)}</b></span>
                        <span>Out <b className="text-gray-700">{fmtTime(a.clock_out)}</b></span>
                        <span>Worked <b className="text-gray-700">{fmtDur(workedMins(a.clock_in, a.clock_out))}</b></span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 pl-7">
                      <QuickMark row={row} busy={busy} isAllowed={isAllowed} onMark={markStatus} stretch />
                      <button onClick={() => setEditing(row)}
                        className="w-10 h-10 rounded-xl border border-gray-100 bg-gray-50 flex items-center justify-center text-gray-500 shrink-0">
                        <Pencil size={15} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="px-5 py-3 border-t border-gray-100 text-xs text-gray-400">
              Showing {visible.length} of {rows.length} employees
            </div>
          </>
        )}
      </div>

      {/* ── Floating bulk bar ── */}
      {selectedRows.length > 0 && (
        <div className="fixed bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-2rem)] sm:w-auto">
          <div className="flex items-center gap-2 sm:gap-3 bg-slate-900 text-white rounded-2xl shadow-2xl px-3 sm:px-4 py-2.5">
            <span className="text-sm font-semibold whitespace-nowrap pl-1">{selectedRows.length} selected</span>
            <div className="w-px h-6 bg-white/15" />
            <div className="flex items-center gap-1 overflow-x-auto">
              {STATUS_KEYS.map(key => {
                const m = STATUS_META[key]
                return (
                  <button key={key} onClick={() => bulkMark(selectedRows, key)}
                    disabled={bulkBusy || !isAllowed(key)} title={`Mark as ${m.label}`}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-white/80 hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed whitespace-nowrap transition-colors">
                    <span className={`w-2 h-2 rounded-full ${m.dot}`} />
                    <span className="hidden sm:inline">{m.label}</span>
                  </button>
                )
              })}
            </div>
            {bulkBusy && <Loader2 size={16} className="animate-spin text-white/70" />}
            <button onClick={() => setSelected(new Set())} title="Clear selection"
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white/60 hover:bg-white/10 hover:text-white transition-colors shrink-0">
              <X size={15} />
            </button>
          </div>
        </div>
      )}

      {editing && (
        <EditModal
          shiftStart={SHIFT_START}
          row={rows.find(r => r.id === editing.id) ?? editing}
          isFuture={isFuture}
          onClose={() => setEditing(null)}
          onSave={saveEdit}
          onClear={clearRecord}
        />
      )}

      <Toast toast={toast} onDismiss={dismissToast} />
    </div>
  )
}
