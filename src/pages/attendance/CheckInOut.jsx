/**
 * Check In / Out — kiosk-style time clock.
 * Pick an employee from the searchable list, then check in / out with one tap.
 * Shows live counters, a running timer for people on shift, overtime, undo,
 * and today's activity feed.
 */
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import * as db from '../../lib/db'
import { useCompany } from '../../context/CompanyContext'
import {
  LogIn, LogOut, Search, Undo2, Loader2, Users, UserCheck, Clock, Coffee, Timer, Sun, CheckCircle2,
  AlertCircle, X, RefreshCw,
} from 'lucide-react'
import { Avatar, Toast, useToast, Tabs } from '../../components/ui'
import { empName } from '../../lib/people'
import { ATT_STATUS, StatusPill, toDateStr, minsOf, hhmm, fmtTime, fmtDur, fmtClock, workedMins } from '../../lib/attendance'

const nowMins = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60 }

function LiveClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => { const id = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(id) }, [])
  return (
    <div>
      <p className="text-5xl sm:text-6xl font-extrabold tracking-tight tabular-nums leading-none">
        {now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
        <span className="text-2xl sm:text-3xl text-indigo-300/80 ml-1">{String(now.getSeconds()).padStart(2, '0')}</span>
      </p>
      <p className="text-sm text-indigo-200 mt-2">{now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p>
    </div>
  )
}

/** Ticking elapsed time + shift progress for someone currently checked in. */
function OnShiftTimer({ clockIn, shiftStart, shiftEnd }) {
  const [, tick] = useState(0)
  useEffect(() => { const id = setInterval(() => tick(t => t + 1), 1000); return () => clearInterval(id) }, [])
  const start   = minsOf(clockIn)
  const elapsed = Math.max(0, nowMins() - start)
  const shiftLen = Math.max(1, minsOf(shiftEnd) - minsOf(shiftStart))
  const pct  = Math.min(100, (elapsed / shiftLen) * 100)
  const over = nowMins() - minsOf(shiftEnd)
  const h = Math.floor(elapsed / 60), m = Math.floor(elapsed % 60), s = Math.floor((elapsed * 60) % 60)
  return (
    <div className="w-full max-w-sm">
      <p className="text-4xl font-extrabold text-gray-900 tabular-nums text-center">
        {String(h).padStart(2, '0')}:{String(m).padStart(2, '0')}<span className="text-xl text-gray-300">:{String(s).padStart(2, '0')}</span>
      </p>
      <p className="text-xs text-gray-400 text-center mt-1">on shift since {fmtTime(clockIn)}</p>
      <div className="h-2 rounded-full bg-gray-100 overflow-hidden mt-4">
        <div className={`h-full rounded-full transition-all ${over > 0 ? 'bg-violet-500' : 'bg-emerald-500'}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="flex justify-between text-[11px] text-gray-400 mt-1.5">
        <span>{fmtTime(shiftStart)}</span>
        <span className={over > 0 ? 'text-violet-600 font-semibold' : ''}>{over > 0 ? `+${fmtDur(over)} overtime` : `${fmtDur(minsOf(shiftEnd) - nowMins())} to go`}</span>
        <span>{fmtTime(shiftEnd)}</span>
      </div>
    </div>
  )
}

function stateOf(rec) {
  if (!rec) return 'out'
  if (rec.clock_in && !rec.clock_out) return 'in'
  if (rec.clock_in && rec.clock_out) return 'done'
  return rec.status   // absent / holiday / present without times
}

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'out', label: 'Not in' },
  { key: 'in', label: 'On shift' },
  { key: 'done', label: 'Done' },
]

// ════════════════════════════════════════════════════════════════════════════════
export default function CheckInOut() {
  const { company } = useCompany()
  const shiftStart = company.shift_start || '09:00'
  const shiftEnd   = company.shift_end || '17:00'

  const [employees, setEmployees] = useState([])
  const [records,   setRecords]   = useState({})     // employee_id → today's record
  const [loading,   setLoading]   = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [selectedId, setSelectedId] = useState(null)
  const [search,    setSearch]    = useState('')
  const [filter,    setFilter]    = useState('all')
  const [busy,      setBusy]      = useState(false)
  const [undo,      setUndo]      = useState(null)   // { empId, prev, recId, label }
  const [toast, showToast, dismissToast] = useToast()
  const [today, setToday] = useState(() => toDateStr(new Date()))
  const searchRef = useRef(null)

  const fetchData = useCallback(async (soft = false) => {
    soft ? setRefreshing(true) : setLoading(true)
    const day = toDateStr(new Date())
    setToday(day)
    try {
      const [emps, att] = await Promise.all([db.getEmployees(), db.getAttendanceByDate(day)])
      setEmployees(emps.filter(e => e.status === 'active').sort((a, b) => empName(a).localeCompare(empName(b))))
      setRecords(Object.fromEntries(att.map(r => [r.employee_id, r])))
    } catch (err) { showToast('error', err.message) }
    setLoading(false); setRefreshing(false)
  }, [showToast])

  useEffect(() => { fetchData() }, [fetchData])
  useEffect(() => { const id = setInterval(() => fetchData(true), 60_000); return () => clearInterval(id) }, [fetchData])

  // ── Derived ──
  const counts = useMemo(() => {
    const c = { all: employees.length, out: 0, in: 0, done: 0, late: 0 }
    employees.forEach(e => {
      const st = stateOf(records[e.id])
      if (st === 'in') c.in++
      else if (st === 'done') c.done++
      else if (st === 'out' || !records[e.id]?.clock_in) c.out++
      if (records[e.id]?.status === 'late') c.late++
    })
    return c
  }, [employees, records])

  const list = useMemo(() => {
    const q = search.trim().toLowerCase()
    return employees.filter(e => {
      const st = stateOf(records[e.id])
      const matchesFilter = filter === 'all' ? true : filter === 'out' ? !['in', 'done'].includes(st) : st === filter
      return matchesFilter && (!q || empName(e).toLowerCase().includes(q) || (e.job_title ?? '').toLowerCase().includes(q) || (e.departments?.name ?? '').toLowerCase().includes(q))
    })
  }, [employees, records, search, filter])

  const feed = useMemo(() => Object.values(records).flatMap(r => {
    const emp = employees.find(e => e.id === r.employee_id)
    if (!emp) return []
    const ev = []
    if (r.clock_in)  ev.push({ key: `${r.id}-in`, emp, kind: 'in', time: r.clock_in, late: r.status === 'late' })
    if (r.clock_out) ev.push({ key: `${r.id}-out`, emp, kind: 'out', time: r.clock_out })
    return ev
  }).sort((a, b) => b.time.localeCompare(a.time)), [records, employees])

  const selected = employees.find(e => e.id === selectedId) ?? null
  const rec      = selected ? records[selected.id] : null
  const state    = stateOf(rec)
  const lateBy   = Math.round(nowMins() - minsOf(shiftStart))

  // ── Actions ──
  async function checkIn() {
    if (!selected || busy) return
    setBusy(true)
    const time   = hhmm(new Date())
    const status = time > shiftStart ? 'late' : 'present'
    try {
      let saved
      if (rec) {
        await db.updateAttendance(rec.id, { clock_in: time, clock_out: null, status })
        saved = { ...rec, clock_in: time, clock_out: null, status }
      } else {
        saved = await db.addAttendance({ employee_id: selected.id, date: today, clock_in: time, clock_out: null, status })
      }
      setRecords(r => ({ ...r, [selected.id]: saved }))
      setUndo({ empId: selected.id, prev: rec ?? null, recId: saved.id, label: `${selected.first_name} checked in` })
      showToast('success', `${selected.first_name} checked in at ${fmtTime(time)}${status === 'late' ? ' · late' : ''}`)
    } catch (err) { showToast('error', err.message) }
    setBusy(false)
  }

  async function checkOut() {
    if (!selected || !rec || busy) return
    setBusy(true)
    const time = hhmm(new Date())
    try {
      await db.updateAttendance(rec.id, { clock_out: time })
      setRecords(r => ({ ...r, [selected.id]: { ...rec, clock_out: time } }))
      setUndo({ empId: selected.id, prev: rec, recId: rec.id, label: `${selected.first_name} checked out` })
      showToast('success', `${selected.first_name} checked out at ${fmtTime(time)} · ${fmtDur(workedMins(rec.clock_in, time))} worked`)
    } catch (err) { showToast('error', err.message) }
    setBusy(false)
  }

  async function undoLast() {
    if (!undo || busy) return
    setBusy(true)
    try {
      if (undo.prev) {
        const { id, ...fields } = undo.prev
        await db.updateAttendance(id, { clock_in: fields.clock_in ?? null, clock_out: fields.clock_out ?? null, status: fields.status })
        setRecords(r => ({ ...r, [undo.empId]: undo.prev }))
      } else {
        await db.deleteAttendance(undo.recId)
        setRecords(r => { const n = { ...r }; delete n[undo.empId]; return n })
      }
      showToast('success', `Undone: ${undo.label}`)
      setUndo(null)
    } catch (err) { showToast('error', err.message) }
    setBusy(false)
  }

  function chip(e) {
    const r = records[e.id]
    const st = stateOf(r)
    if (st === 'in')   return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> In · {fmtTime(r.clock_in)}</span>
    if (st === 'done') return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-sky-50 text-sky-700">Done · {fmtDur(workedMins(r.clock_in, r.clock_out))}</span>
    if (r?.status && ATT_STATUS[r.status]) return <StatusPill status={r.status} />
    return <span className="text-[11px] text-gray-400">Not in</span>
  }

  // ── Render ──
  return (
    <div className="space-y-5 pb-10">
      {/* Banner */}
      <section className="relative rounded-2xl text-white shadow-lg overflow-hidden" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 45%, #1e3a8a 100%)' }}>
        <div className="absolute -top-20 -left-16 w-72 h-72 rounded-full opacity-25 pointer-events-none" style={{ background: 'radial-gradient(circle, #6366f1, transparent 70%)' }} />
        <div className="relative p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <LiveClock />
            <div className="flex flex-wrap items-center gap-4 mt-4 text-xs text-indigo-200">
              <span className="flex items-center gap-1.5"><Coffee size={13} /> Shift {fmtTime(shiftStart)} – {fmtTime(shiftEnd)}</span>
              <span className="flex items-center gap-1.5"><Clock size={13} /> Check-ins after {fmtTime(shiftStart)} are marked late</span>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2 sm:gap-3">
            {[
              ['On shift', counts.in, 'bg-emerald-400'],
              ['Done', counts.done, 'bg-sky-400'],
              ['Late', counts.late, 'bg-amber-400'],
              ['Not in', counts.out, 'bg-slate-400'],
            ].map(([l, v, dot]) => (
              <div key={l} className="rounded-xl bg-white/10 border border-white/10 px-3 sm:px-4 py-3 min-w-[72px]">
                <p className="text-2xl font-extrabold tabular-nums leading-none">{loading ? '—' : v}</p>
                <p className="text-[11px] text-indigo-200 mt-1.5 flex items-center gap-1.5"><span className={`w-1.5 h-1.5 rounded-full ${dot}`} />{l}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="grid lg:grid-cols-12 gap-5 items-start">
        {/* Employee picker */}
        <section className="lg:col-span-5 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-[15px] font-bold text-gray-900 flex items-center gap-2"><Users size={16} className="text-[#1e3a8a]" /> Who's checking in?</h3>
              <button onClick={() => fetchData(true)} title="Refresh" className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100">
                <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
              </button>
            </div>
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input ref={searchRef} value={search} onChange={e => setSearch(e.target.value)} placeholder="Type a name…"
                className="w-full pl-9 pr-8 py-2.5 text-sm rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/20 focus:border-[#1e3a8a]" />
              {search && <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400"><X size={14} /></button>}
            </div>
            <Tabs value={filter} onChange={setFilter} items={FILTERS.map(f => ({ ...f, count: counts[f.key] }))} />
          </div>
          <div className="max-h-[480px] overflow-y-auto divide-y divide-gray-50">
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-14 mx-4 my-2 rounded-xl bg-gray-50 animate-pulse" />)
            ) : list.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-12">No one matches</p>
            ) : list.map(e => {
              const on = e.id === selectedId
              return (
                <button key={e.id} onClick={() => setSelectedId(e.id)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${on ? 'bg-indigo-50' : 'hover:bg-gray-50'}`}>
                  <Avatar id={e.id} name={empName(e)} src={e.avatar_url || null} size="w-10 h-10 text-xs" />
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-semibold truncate ${on ? 'text-[#1e3a8a]' : 'text-gray-800'}`}>{empName(e)}</p>
                    <p className="text-[11px] text-gray-400 truncate">{[e.job_title, e.departments?.name].filter(Boolean).join(' · ') || 'Employee'}</p>
                  </div>
                  {chip(e)}
                </button>
              )
            })}
          </div>
        </section>

        {/* Action panel */}
        <section className="lg:col-span-7 space-y-5">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 min-h-[380px] flex flex-col items-center justify-center text-center">
            {!selected ? (
              <div className="space-y-3">
                <div className="w-28 h-28 rounded-full border-4 border-dashed border-gray-200 flex items-center justify-center mx-auto">
                  <UserCheck size={34} className="text-gray-300" />
                </div>
                <p className="text-sm font-semibold text-gray-500">Select an employee to check in or out</p>
                <button onClick={() => searchRef.current?.focus()} className="text-xs font-semibold text-[#1e3a8a] hover:underline">Search by name</button>
              </div>
            ) : (
              <div className="w-full flex flex-col items-center gap-5">
                <div className="flex flex-col items-center">
                  <Avatar id={selected.id} name={empName(selected)} src={selected.avatar_url || null} size="w-20 h-20 text-xl" rounded="rounded-2xl" />
                  <p className="text-xl font-extrabold text-gray-900 mt-3">{empName(selected)}</p>
                  <p className="text-sm text-gray-400">{[selected.job_title, selected.departments?.name].filter(Boolean).join(' · ') || 'Employee'}</p>
                </div>

                {state === 'in' ? (
                  <>
                    <OnShiftTimer clockIn={rec.clock_in} shiftStart={shiftStart} shiftEnd={shiftEnd} />
                    <button onClick={checkOut} disabled={busy}
                      className="w-36 h-36 rounded-full bg-rose-500 hover:bg-rose-600 disabled:opacity-60 text-white flex flex-col items-center justify-center gap-2 shadow-xl shadow-rose-500/30 transition-all hover:scale-105 active:scale-95 ring-8 ring-rose-100">
                      {busy ? <Loader2 size={30} className="animate-spin" /> : <><LogOut size={30} /><span className="font-bold tracking-wide text-sm">CHECK OUT</span></>}
                    </button>
                    {nowMins() < minsOf(shiftEnd) && <p className="text-xs text-amber-600 flex items-center gap-1"><AlertCircle size={12} /> Before {fmtTime(shiftEnd)} — leaving early</p>}
                  </>
                ) : state === 'done' ? (
                  <div className="space-y-4 w-full max-w-sm">
                    <div className="w-20 h-20 rounded-full bg-sky-50 flex items-center justify-center mx-auto ring-8 ring-sky-50/50"><CheckCircle2 size={36} className="text-sky-500" /></div>
                    <p className="text-sm font-semibold text-gray-700">Shift complete for today</p>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        ['In', fmtTime(rec.clock_in)], ['Out', fmtTime(rec.clock_out)], ['Worked', fmtDur(workedMins(rec.clock_in, rec.clock_out))],
                      ].map(([l, v]) => (
                        <div key={l} className="rounded-xl bg-gray-50 py-2.5"><p className="text-[10px] text-gray-400 uppercase tracking-wider">{l}</p><p className="text-sm font-bold text-gray-800">{v}</p></div>
                      ))}
                    </div>
                    {minsOf(rec.clock_out) > minsOf(shiftEnd) && (
                      <p className="text-xs font-semibold text-violet-600">+{fmtDur(minsOf(rec.clock_out) - minsOf(shiftEnd))} overtime</p>
                    )}
                  </div>
                ) : (
                  <>
                    {rec?.status && ATT_STATUS[rec.status] && (
                      <p className="text-xs text-gray-500 flex items-center gap-2">Currently marked <StatusPill status={rec.status} /> — checking in will update it</p>
                    )}
                    <button onClick={checkIn} disabled={busy}
                      className="w-36 h-36 rounded-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white flex flex-col items-center justify-center gap-2 shadow-xl shadow-emerald-500/30 transition-all hover:scale-105 active:scale-95 ring-8 ring-emerald-100">
                      {busy ? <Loader2 size={30} className="animate-spin" /> : <><LogIn size={30} /><span className="font-bold tracking-wide text-sm">CHECK IN</span></>}
                    </button>
                    {lateBy > 0
                      ? <p className="text-xs text-amber-600 font-semibold flex items-center gap-1"><AlertCircle size={12} /> {fmtDur(lateBy)} after shift start — will be marked late</p>
                      : <p className="text-xs text-emerald-600 font-semibold flex items-center gap-1"><Sun size={12} /> On time — shift starts {fmtTime(shiftStart)}</p>}
                  </>
                )}

                {undo?.empId === selected.id && (
                  <button onClick={undoLast} disabled={busy}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-500 hover:bg-gray-100 hover:text-gray-800 disabled:opacity-50">
                    <Undo2 size={13} /> Undo “{undo.label}”
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Activity feed */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between px-5 pt-4 pb-2">
              <h3 className="text-[15px] font-bold text-gray-900 flex items-center gap-2"><Timer size={16} className="text-[#1e3a8a]" /> Today's activity</h3>
              <span className="text-xs text-gray-400">{feed.length} event{feed.length !== 1 ? 's' : ''}</span>
            </div>
            {feed.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">No check-ins yet today</p>
            ) : (
              <div className="px-5 pb-4 max-h-72 overflow-y-auto divide-y divide-gray-50">
                {feed.slice(0, 30).map(ev => (
                  <button key={ev.key} onClick={() => setSelectedId(ev.emp.id)} className="w-full flex items-center gap-3 py-2.5 text-left">
                    <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${ev.kind === 'in' ? 'bg-emerald-50 text-emerald-600' : 'bg-sky-50 text-sky-600'}`}>
                      {ev.kind === 'in' ? <LogIn size={14} /> : <LogOut size={14} />}
                    </span>
                    <span className="text-sm text-gray-700 flex-1 min-w-0 truncate">
                      <b className="font-semibold">{empName(ev.emp)}</b> {ev.kind === 'in' ? 'checked in' : 'checked out'}
                      {ev.late && <span className="ml-1.5 px-1.5 rounded bg-amber-50 text-amber-600 text-[11px] font-semibold">late</span>}
                    </span>
                    <span className="text-xs font-semibold text-gray-500 tabular-nums">{fmtClock(minsOf(ev.time))}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      <Toast toast={toast} onDismiss={dismissToast} />
    </div>
  )
}
