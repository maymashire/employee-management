import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { CalendarDays, ChevronLeft, ChevronRight, Loader2, CheckCircle2, AlertCircle, X } from 'lucide-react'

const STATUS_META = {
  present:  { label: 'Present',  cls: 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200' },
  absent:   { label: 'Absent',   cls: 'bg-red-100 text-red-700 ring-1 ring-red-200' },
  late:     { label: 'Late',     cls: 'bg-amber-100 text-amber-700 ring-1 ring-amber-200' },
  half_day: { label: 'Half Day', cls: 'bg-blue-100 text-blue-700 ring-1 ring-blue-200' },
  holiday:  { label: 'Holiday',  cls: 'bg-purple-100 text-purple-700 ring-1 ring-purple-200' },
}

const fmtTime = t => {
  if (!t) return '—'
  const [h, m] = t.split(':')
  const d = new Date(); d.setHours(+h, +m)
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

function Toast({ toast, onDismiss }) {
  useEffect(() => {
    if (!toast) return
    const id = setTimeout(onDismiss, 4000)
    return () => clearTimeout(id)
  }, [toast, onDismiss])
  if (!toast) return null
  const ok = toast.type === 'success'
  return (
    <div className={`fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:bottom-6 sm:max-w-sm z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl border text-sm font-medium
      ${ok ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
      {ok ? <CheckCircle2 size={17} className="text-emerald-500" /> : <AlertCircle size={17} className="text-red-500" />}
      <span>{toast.message}</span>
      <button onClick={onDismiss} className="opacity-50 hover:opacity-100 ml-1"><X size={14} /></button>
    </div>
  )
}

export default function DailyAttendance() {
  const [date,       setDate]       = useState(new Date().toISOString().slice(0, 10))
  const [rows,       setRows]       = useState([]) // merged employees + attendance
  const [loading,    setLoading]    = useState(true)
  const [savingId,   setSavingId]   = useState(null)
  const [toast,      setToast]      = useState(null)

  const showToast   = useCallback((type, message) => setToast({ type, message }), [])
  const dismissToast = useCallback(() => setToast(null), [])

  const fetchData = useCallback(async () => {
    setLoading(true)
    const [{ data: emps }, { data: att }] = await Promise.all([
      supabase.from('employees').select('id, first_name, last_name, departments(name), job_title').eq('status', 'active').order('first_name'),
      supabase.from('attendance').select('*').eq('date', date),
    ])

    const attMap = {}
    ;(att ?? []).forEach(r => { attMap[r.employee_id] = r })

    setRows((emps ?? []).map(e => ({ ...e, attendance: attMap[e.id] ?? null })))
    setLoading(false)
  }, [date])

  useEffect(() => { fetchData() }, [fetchData])

  async function markStatus(employee, status) {
    setSavingId(employee.id)

    const existing = employee.attendance

    let error
    if (existing) {
      ;({ error } = await supabase.from('attendance').update({ status }).eq('id', existing.id))
    } else {
      ;({ error } = await supabase.from('attendance').insert({
        employee_id: employee.id,
        date,
        status,
        clock_in:  null,
        clock_out: null,
      }))
    }

    setSavingId(null)
    if (error) {
      showToast('error', error.message)
    } else {
      showToast('success', `${employee.first_name} marked as ${STATUS_META[status].label}`)
      await fetchData()
    }
  }

  function stepDate(dir) {
    const d = new Date(date)
    d.setDate(d.getDate() + dir)
    setDate(d.toISOString().slice(0, 10))
  }

  // Summary counts
  const summary = Object.fromEntries(
    Object.keys(STATUS_META).map(s => [s, rows.filter(r => r.attendance?.status === s).length])
  )
  const marked = rows.filter(r => r.attendance).length

  return (
    <div className="space-y-5">

      {/* Date navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Daily Attendance</h2>
          <p className="text-sm text-gray-400 mt-0.5">
            {marked} of {rows.length} employees marked for{' '}
            {new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => stepDate(-1)} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
            <ChevronLeft size={16} />
          </button>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="px-3 py-2 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/25 focus:border-[#1e3a8a] transition-colors"
          />
          <button onClick={() => stepDate(1)} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Summary badges */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(STATUS_META).map(([key, meta]) => (
          <span key={key} className={`px-3 py-1 rounded-full text-xs font-semibold ${meta.cls}`}>
            {meta.label}: {summary[key]}
          </span>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center gap-3 py-20 text-gray-400">
            <Loader2 size={22} className="animate-spin text-blue-600" />
            <span className="text-sm">Loading…</span>
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-2 text-gray-400">
            <CalendarDays size={36} className="text-gray-200" />
            <p className="text-sm font-medium">No active employees found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[1000px]">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60">
                  <th className="px-5 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider w-56">Employee</th>
                  <th className="px-5 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider w-36">Department</th>
                  <th className="px-5 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider w-28">Clock In</th>
                  <th className="px-5 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider w-28">Clock Out</th>
                  <th className="px-5 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider w-28">Status</th>
                  <th className="px-5 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Mark As</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {rows.map(row => {
                  const saving = savingId === row.id
                  const meta   = STATUS_META[row.attendance?.status]
                  return (
                    <tr key={row.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-full bg-[#1e3a8a] flex items-center justify-center text-white text-xs font-bold shrink-0">
                            {`${row.first_name?.[0] ?? ''}${row.last_name?.[0] ?? ''}`.toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold text-gray-800">{row.first_name} {row.last_name}</p>
                            <p className="text-xs text-gray-400">{row.job_title ?? '—'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-gray-500 whitespace-nowrap">{row.departments?.name ?? '—'}</td>
                      <td className="px-5 py-3 text-gray-500 whitespace-nowrap">{fmtTime(row.attendance?.clock_in)}</td>
                      <td className="px-5 py-3 text-gray-500 whitespace-nowrap">{fmtTime(row.attendance?.clock_out)}</td>
                      <td className="px-5 py-3">
                        {meta
                          ? <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${meta.cls}`}>{meta.label}</span>
                          : <span className="text-xs text-gray-300">Not marked</span>}
                      </td>
                      <td className="px-5 py-3">
                        {saving ? (
                          <Loader2 size={16} className="animate-spin text-blue-600" />
                        ) : (
                          <div className="flex items-center gap-1.5 flex-nowrap">
                            {Object.entries(STATUS_META).map(([key, m]) => (
                              <button key={key} onClick={() => markStatus(row, key)}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border whitespace-nowrap transition-colors
                                  ${row.attendance?.status === key
                                    ? m.cls
                                    : 'border-gray-200 text-gray-500 hover:bg-gray-100 bg-white'}`}>
                                {m.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Toast toast={toast} onDismiss={dismissToast} />
    </div>
  )
}
