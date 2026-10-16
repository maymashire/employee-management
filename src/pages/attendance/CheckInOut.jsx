import { useState, useEffect, useCallback } from 'react'
import * as db from '../../lib/db'
import { AlertCircle, CheckCircle2, Loader2, Users } from 'lucide-react'

const SHIFT_START = 9  // 09:00

function localDateStr(d) {
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function calcDuration(clockIn, clockOut) {
  if (!clockIn || !clockOut) return null
  const [ih, im] = clockIn.split(':').map(Number)
  const [oh, om] = clockOut.split(':').map(Number)
  const mins = (oh * 60 + om) - (ih * 60 + im)
  if (mins <= 0) return null
  return `${Math.floor(mins / 60)}h ${mins % 60}m`
}

const fmtTime = t => {
  if (!t) return '—'
  const [h, m] = t.split(':')
  const d = new Date()
  d.setHours(+h, +m)
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

const initials = emp =>
  `${emp?.first_name?.[0] ?? ''}${emp?.last_name?.[0] ?? ''}`.toUpperCase() || '?'

export default function CheckInOut() {
  const [employees,     setEmployees]     = useState([])
  const [selected,      setSelected]      = useState(null)   // employee object
  const [attendance,    setAttendance]    = useState(null)
  const [loading,       setLoading]       = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [message,       setMessage]       = useState(null)
  const [now,           setNow]           = useState(new Date())

  // ── live clock ──
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const TODAY   = localDateStr(now)
  const nowMins = now.getHours() * 60 + now.getMinutes()
  const isLate  = nowMins > SHIFT_START * 60

  const clockStr = now.toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  })
  const dateStr = now.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })

  // ── fetch employees ──
  const fetchEmployees = useCallback(async () => {
    try {
      const data = await db.getEmployees()
      setEmployees(data.filter(e => e.status === 'active'))
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => { fetchEmployees() }, [fetchEmployees])

  // ── fetch attendance for selected employee ──
  const fetchAttendance = useCallback(async (empId) => {
    if (!empId) { setAttendance(null); return }
    try {
      const data = await db.getAttendanceByEmployeeDate(empId, TODAY)
      setAttendance(data)
    } catch {
      setAttendance(null)
    }
  }, [])

  function selectEmployee(emp) {
    setSelected(emp)
    setMessage(null)
    fetchAttendance(emp?.id)
  }

  // ── clock in ──
  async function clockIn() {
    if (!selected) return
    setActionLoading(true)
    setMessage(null)

    const h   = String(now.getHours()).padStart(2, '0')
    const m   = String(now.getMinutes()).padStart(2, '0')
    const timeNow = `${h}:${m}`
    const status  = isLate ? 'late' : 'present'

    try {
      await db.upsertAttendance(selected.id, TODAY, { clock_in: timeNow, status })
      setMessage({ type: 'success', text: `Clocked in at ${fmtTime(timeNow)}${status === 'late' ? ' — marked Late' : ''}` })
      await fetchAttendance(selected.id)
    } catch (err) {
      setMessage({ type: 'error', text: err.message })
    }
    setActionLoading(false)
  }

  // ── clock out ──
  async function clockOut() {
    if (!selected || !attendance) return
    setActionLoading(true)
    setMessage(null)

    const h   = String(now.getHours()).padStart(2, '0')
    const m   = String(now.getMinutes()).padStart(2, '0')
    const timeNow = `${h}:${m}`

    try {
      await db.updateAttendance(attendance.id, { clock_out: timeNow })
      setMessage({ type: 'success', text: `Clocked out at ${fmtTime(timeNow)}` })
      await fetchAttendance(selected.id)
    } catch (err) {
      setMessage({ type: 'error', text: err.message })
    }
    setActionLoading(false)
  }

  const canClockIn  = selected && !attendance?.clock_in
  const canClockOut = selected && !!attendance?.clock_in && !attendance?.clock_out
  const isComplete  = selected && !!attendance?.clock_in && !!attendance?.clock_out
  const duration    = calcDuration(attendance?.clock_in, attendance?.clock_out)

  // ── status label ──
  function statusLabel() {
    if (!selected)           return 'No employee selected'
    if (!attendance?.clock_in) return 'Not checked in'
    if (!attendance?.clock_out) return attendance.status === 'late' ? 'Checked In (Late)' : 'Checked In'
    return `Shift complete · ${duration ?? ''}`
  }

  function statusColor() {
    if (!attendance?.clock_in) return 'text-slate-400'
    if (!attendance?.clock_out) return 'text-emerald-400'
    return 'text-blue-400'
  }

  return (
    <div className="space-y-6">

      {/* ── Time Banner ── */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-6 text-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-lg overflow-hidden relative">
        {/* decorative blur orb */}
        <div className="absolute -top-10 -left-10 w-48 h-48 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />

        <div className="space-y-2 z-10">
          <div className="flex items-center gap-2 text-slate-400 text-sm">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span>{dateStr}</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-mono font-bold tracking-wider text-white tabular-nums">
            {clockStr}
          </h1>
          <div className="flex items-center gap-6 text-xs text-slate-400 pt-2 border-t border-slate-800">
            <span>☕ Shift starts 09:00</span>
            <span>⏱ Ends 17:00</span>
          </div>
        </div>

        <div className="bg-white/5 border border-white/10 backdrop-blur-md p-4 rounded-xl min-w-[200px] text-center z-10">
          <span className="text-xs text-slate-400 block uppercase tracking-wider mb-2">Today's Status</span>
          <span className={`text-sm font-semibold ${statusColor()}`}>{statusLabel()}</span>
          {attendance?.clock_in && (
            <div className="mt-3 pt-3 border-t border-white/10 grid grid-cols-2 gap-2 text-xs">
              <div>
                <p className="text-slate-500">In</p>
                <p className="text-white font-medium">{fmtTime(attendance.clock_in)}</p>
              </div>
              <div>
                <p className="text-slate-500">Out</p>
                <p className="text-white font-medium">{fmtTime(attendance.clock_out)}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Lower grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Employee selector */}
        <div className="lg:col-span-4 bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
            <Users size={15} className="text-gray-400" /> Select Employee
          </h3>

          {loading ? (
            <div className="flex items-center gap-2 text-gray-400 py-4 justify-center">
              <Loader2 size={18} className="animate-spin" />
              <span className="text-sm">Loading…</span>
            </div>
          ) : (
            <select
              value={selected?.id ?? ''}
              onChange={e => {
                const emp = employees.find(x => x.id === e.target.value) ?? null
                selectEmployee(emp)
              }}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/25 focus:border-[#1e3a8a] transition-colors"
            >
              <option value="">— Select an employee —</option>
              {employees.map(e => (
                <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>
              ))}
            </select>
          )}

          {selected ? (
            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 flex items-center gap-3">
              <div className="w-10 h-10 bg-[#1e3a8a] text-white font-bold rounded-xl flex items-center justify-center text-sm shrink-0">
                {initials(selected)}
              </div>
              <div>
                <h4 className="text-sm font-bold text-gray-800">{selected.first_name} {selected.last_name}</h4>
                <span className="text-xs text-gray-400">
                  {selected.job_title ?? 'Employee'}
                  {selected.departments?.name ? ` · ${selected.departments.name}` : ''}
                </span>
              </div>
            </div>
          ) : (
            <div className="bg-gray-50 border border-dashed border-gray-200 rounded-xl p-4 text-center text-xs text-gray-400">
              No employee selected
            </div>
          )}

          {/* Time summary row */}
          {attendance?.clock_in && (
            <div className="grid grid-cols-3 gap-2 pt-1">
              {[
                { label: 'Clock In',  value: fmtTime(attendance.clock_in) },
                { label: 'Clock Out', value: fmtTime(attendance.clock_out) },
                { label: 'Duration',  value: duration ?? '—' },
              ].map(({ label, value }) => (
                <div key={label} className="bg-gray-50 rounded-xl p-2.5 text-center border border-gray-100">
                  <p className="text-[10px] text-gray-400 mb-1">{label}</p>
                  <p className="text-xs font-bold text-gray-700">{value}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Action panel */}
        <div className="lg:col-span-8 bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col items-center justify-center min-h-[320px] relative">
          <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2 absolute top-5 left-5">
            <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Attendance Action
          </h3>

          {isComplete ? (
            <div className="text-center space-y-3">
              <div className="w-32 h-32 rounded-full bg-blue-50 border-4 border-blue-100 flex flex-col items-center justify-center mx-auto">
                <CheckCircle2 size={40} className="text-blue-500" />
              </div>
              <p className="text-sm font-semibold text-gray-700">Shift complete for today</p>
              <p className="text-xs text-gray-400">
                {fmtTime(attendance.clock_in)} → {fmtTime(attendance.clock_out)} · {duration}
              </p>
            </div>
          ) : canClockIn ? (
            <div className="text-center space-y-4">
              <button
                onClick={clockIn}
                disabled={actionLoading}
                className="w-36 h-36 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white rounded-full flex flex-col items-center justify-center gap-2 shadow-lg shadow-emerald-500/30 transition-all duration-200 hover:scale-105 active:scale-95"
              >
                {actionLoading
                  ? <Loader2 size={32} className="animate-spin" />
                  : <>
                      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                      </svg>
                      <span className="font-bold tracking-wide text-sm">CHECK IN</span>
                    </>
                }
              </button>
              <div className="space-y-1">
                <p className="text-xs text-gray-400">Click to record your arrival</p>
                {isLate && (
                  <p className="text-xs text-amber-500 font-medium flex items-center justify-center gap-1">
                    <AlertCircle size={12} /> After 9:00 AM — will mark Late
                  </p>
                )}
              </div>
            </div>
          ) : canClockOut ? (
            <div className="text-center space-y-4">
              <button
                onClick={clockOut}
                disabled={actionLoading}
                className="w-36 h-36 bg-red-500 hover:bg-red-600 disabled:opacity-60 text-white rounded-full flex flex-col items-center justify-center gap-2 shadow-lg shadow-red-500/30 transition-all duration-200 hover:scale-105 active:scale-95"
              >
                {actionLoading
                  ? <Loader2 size={32} className="animate-spin" />
                  : <>
                      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      <span className="font-bold tracking-wide text-sm">CHECK OUT</span>
                    </>
                }
              </button>
              <div className="space-y-1">
                <p className="text-xs text-gray-400">Click to record your departure</p>
                <p className="text-xs text-emerald-600 font-medium">
                  Clocked in at {fmtTime(attendance?.clock_in)}
                </p>
              </div>
            </div>
          ) : (
            <div className="text-center space-y-3">
              <div className="w-32 h-32 rounded-full bg-gray-50 border-4 border-dashed border-gray-200 flex flex-col items-center justify-center mx-auto">
                <svg className="w-10 h-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                </svg>
              </div>
              <p className="text-sm text-gray-400">Select an employee to begin</p>
            </div>
          )}

          {/* Feedback message */}
          {message && (
            <div className={`absolute bottom-5 left-5 right-5 flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm
              ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>
              {message.type === 'success'
                ? <CheckCircle2 size={15} className="shrink-0" />
                : <AlertCircle  size={15} className="shrink-0" />}
              {message.text}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
