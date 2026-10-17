/**
 * Attendance Calendar — month view for one employee (status per day) or the
 * whole team (attendance rate per day), with streaks, a monthly breakdown and
 * a day detail modal.
 */
import { useState, useEffect, useMemo, useRef } from 'react'
import { Link } from 'react-router-dom'
import * as db from '../../lib/db'
import {
  ChevronLeft, ChevronRight, CalendarDays, Users, Flame, Timer, LogIn, CheckCircle2, Clock, UserX,
  StickyNote, ExternalLink, Trophy,
} from 'lucide-react'
import {
  Avatar, HeroCard, RateRing, StatCard, Modal, ModalHeader,
} from '../../components/ui'
import { empName } from '../../lib/people'
import {
  ATT_STATUS, ATT_KEYS, STACK_KEYS, ATTENDED, StatusPill, summarize, toDateStr, parseDate, fmtTime, fmtDur, fmtClock, workedMins,
} from '../../lib/attendance'

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const RAMP = ['#86b6ef', '#5598e7', '#2a78d6', '#1c5cab', '#104281']
const rampFor = r => (r == null ? null : RAMP[r < 60 ? 0 : r < 75 ? 1 : r < 90 ? 2 : r < 97 ? 3 : 4])
const pad = n => String(n).padStart(2, '0')

function buildCells(year, month) {
  const first = new Date(year, month, 1).getDay()
  const days  = new Date(year, month + 1, 0).getDate()
  const cells = [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => `${year}-${pad(month + 1)}-${pad(i + 1)}`)]
  while (cells.length % 7) cells.push(null)
  return cells
}

/** Longest and current runs of attended days (ignores days without records). */
function streaks(dates, byDate, today) {
  let best = 0, run = 0, current = 0
  dates.filter(d => d <= today && byDate[d]).forEach(d => {
    if (ATTENDED.includes(byDate[d].status)) { run++; best = Math.max(best, run) }
    else if (byDate[d].status !== 'holiday') run = 0
  })
  current = run
  return { best, current }
}

function DayModal({ date, mode, employee, records, employees, onClose }) {
  const label = parseDate(date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
  if (mode === 'one') {
    const r = records.find(x => x.employee_id === employee.id && x.date === date)
    return (
      <Modal onClose={onClose} maxWidth="440px">
        <ModalHeader person={{ id: employee.id, name: empName(employee) }} title={empName(employee)} sub={label} onClose={onClose} />
        <div className="px-6 py-5 space-y-4">
          <div className="flex items-center justify-between"><span className="text-sm text-gray-500">Status</span><StatusPill status={r?.status} /></div>
          <div className="grid grid-cols-3 gap-2">
            {[['In', fmtTime(r?.clock_in)], ['Out', fmtTime(r?.clock_out)], ['Worked', fmtDur(workedMins(r?.clock_in, r?.clock_out))]].map(([l, v]) => (
              <div key={l} className="rounded-xl bg-gray-50 py-2.5 text-center"><p className="text-[10px] text-gray-400 uppercase tracking-wider">{l}</p><p className="text-sm font-bold text-gray-800">{v}</p></div>
            ))}
          </div>
          {r?.note && <p className="text-xs text-gray-600 bg-gray-50 rounded-xl px-3 py-2.5 flex gap-2"><StickyNote size={13} className="shrink-0 mt-0.5" /> {r.note}</p>}
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end">
          <Link to={`/attendance/daily?date=${date}`} className="flex items-center gap-1.5 text-sm font-semibold text-[#1e3a8a] hover:underline">Edit in Daily attendance <ExternalLink size={13} /></Link>
        </div>
      </Modal>
    )
  }
  const dayRecs = records.filter(r => r.date === date)
  const byEmp = Object.fromEntries(dayRecs.map(r => [r.employee_id, r]))
  const order = { present: 0, late: 1, half_day: 2, absent: 3, holiday: 4 }
  const rows = employees.map(e => ({ e, r: byEmp[e.id] })).sort((a, b) => (order[a.r?.status] ?? 9) - (order[b.r?.status] ?? 9))
  const s = summarize(dayRecs)
  return (
    <Modal onClose={onClose} maxWidth="520px">
      <ModalHeader title={label} sub={`${s.attended} of ${employees.length} attended · ${dayRecs.length} marked`} onClose={onClose} />
      <div className="px-6 pt-4 flex flex-wrap gap-2">
        {ATT_KEYS.map(k => s[k] > 0 && <span key={k} className={`px-2.5 py-1 rounded-full text-xs font-semibold ${ATT_STATUS[k].badge}`}>{s[k]} {ATT_STATUS[k].label}</span>)}
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 divide-y divide-gray-50">
        {rows.map(({ e, r }) => (
          <div key={e.id} className="flex items-center gap-3 py-2.5">
            <Avatar id={e.id} name={empName(e)} src={e.avatar_url || null} size="w-8 h-8 text-[11px]" />
            <span className="text-sm font-medium text-gray-800 flex-1 truncate">{empName(e)}</span>
            {r?.clock_in && <span className="text-[11px] text-gray-400 tabular-nums">{fmtTime(r.clock_in)}{r.clock_out ? ` – ${fmtTime(r.clock_out)}` : ''}</span>}
            <StatusPill status={r?.status} />
          </div>
        ))}
      </div>
      <div className="px-6 py-4 border-t border-gray-100 flex justify-end">
        <Link to={`/attendance/daily?date=${date}`} className="flex items-center gap-1.5 text-sm font-semibold text-[#1e3a8a] hover:underline">Open in Daily attendance <ExternalLink size={13} /></Link>
      </div>
    </Modal>
  )
}

// ════════════════════════════════════════════════════════════════════════════════
export default function AttendanceCalendar() {
  const now      = new Date()
  const todayStr = toDateStr(now)
  const [year,  setYear]  = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [employees, setEmployees] = useState([])
  const [who,       setWho]       = useState('team')     // 'team' | employee id
  const [records,   setRecords]   = useState([])
  const [loading,   setLoading]   = useState(true)
  const [openDay,   setOpenDay]   = useState(null)
  const reqId = useRef(0)

  useEffect(() => {
    db.getEmployees().then(list => setEmployees(list.filter(e => e.status === 'active').sort((a, b) => empName(a).localeCompare(empName(b))))).catch(() => {})
  }, [])

  useEffect(() => {
    const id = ++reqId.current
    setLoading(true)
    const start = `${year}-${pad(month + 1)}-01`
    const end   = `${year}-${pad(month + 1)}-${pad(new Date(year, month + 1, 0).getDate())}`
    db.getAttendanceRange(start, end)
      .then(list => { if (id === reqId.current) setRecords(list) })
      .catch(() => {})
      .finally(() => { if (id === reqId.current) setLoading(false) })
  }, [year, month])

  function shift(dir) {
    const d = new Date(year, month + dir, 1)
    setYear(d.getFullYear()); setMonth(d.getMonth())
  }

  const activeIds = useMemo(() => new Set(employees.map(e => e.id)), [employees])
  const teamRecs  = useMemo(() => records.filter(r => activeIds.has(r.employee_id)), [records, activeIds])
  const person    = who === 'team' ? null : employees.find(e => e.id === who)
  const mode      = person ? 'one' : 'team'
  const scopeRecs = person ? teamRecs.filter(r => r.employee_id === person.id) : teamRecs
  const cells     = buildCells(year, month)
  const dates     = cells.filter(Boolean)
  const monthLabel = new Date(year, month, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const isThisMonth = year === now.getFullYear() && month === now.getMonth()

  const perDay = useMemo(() => {
    const m = {}
    scopeRecs.forEach(r => { (m[r.date] ??= []).push(r) })
    return m
  }, [scopeRecs])

  const dayStats = date => {
    const list = perDay[date]
    if (!list) return null
    const s = summarize(list)
    if (mode === 'one') return { ...s, rec: list[0] }
    const expected = employees.length - s.holiday
    return { ...s, teamRate: expected > 0 ? Math.round((s.attended / expected) * 100) : null }
  }

  const summary = useMemo(() => summarize(scopeRecs), [scopeRecs])
  const byDateOne = useMemo(() => Object.fromEntries(scopeRecs.map(r => [r.date, r])), [scopeRecs])
  const streak  = mode === 'one' ? streaks(dates, byDateOne, todayStr) : null

  const teamDays = useMemo(() => {
    if (mode !== 'team') return []
    return dates.map(d => ({ d, s: dayStats(d) })).filter(x => x.s && x.s.teamRate != null)
  }, [mode, dates.join(), perDay, employees.length]) // eslint-disable-line react-hooks/exhaustive-deps
  const bestDay  = teamDays.reduce((b, x) => (!b || x.s.teamRate > b.s.teamRate ? x : b), null)
  const avgTeam  = teamDays.length ? Math.round(teamDays.reduce((s, x) => s + x.s.teamRate, 0) / teamDays.length) : null

  const absentees = useMemo(() => {
    if (mode !== 'team') return []
    const m = {}
    teamRecs.forEach(r => {
      if (r.status !== 'absent' && r.status !== 'late') return
      const x = (m[r.employee_id] ??= { absent: 0, late: 0 })
      x[r.status]++
    })
    return Object.entries(m).map(([id, v]) => ({ emp: employees.find(e => e.id === id), ...v }))
      .filter(x => x.emp).sort((a, b) => (b.absent * 2 + b.late) - (a.absent * 2 + a.late)).slice(0, 6)
  }, [mode, teamRecs, employees])

  const rate = mode === 'one' ? (summary.rate == null ? 0 : Math.round(summary.rate)) : (avgTeam ?? 0)

  return (
    <div className="space-y-5 pb-10">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight">{monthLabel}</h2>
          <p className="text-sm text-gray-400 mt-1">{person ? `${empName(person)}'s attendance` : `Whole team · ${employees.length} active employees`}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            {person ? (
              <span className="absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none">
                <Avatar id={person.id} name={empName(person)} src={person.avatar_url || null} size="w-6 h-6 text-[9px]" rounded="rounded-full" />
              </span>
            ) : <Users size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />}
            <select value={who} onChange={e => setWho(e.target.value)}
              className="pl-10 pr-3 py-2.5 text-sm font-medium rounded-xl border border-gray-200 bg-white shadow-sm text-gray-700 min-w-[220px] focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/20">
              <option value="team">Whole team</option>
              {employees.map(e => <option key={e.id} value={e.id}>{empName(e)}</option>)}
            </select>
          </div>
          <div className="flex items-center bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            <button onClick={() => shift(-1)} title="Previous month" className="px-2.5 py-2.5 text-gray-500 hover:bg-gray-50"><ChevronLeft size={16} /></button>
            <span className="px-3 text-sm font-semibold text-gray-700 border-x border-gray-100 flex items-center gap-2 py-2"><CalendarDays size={15} className="text-gray-400" /> {new Date(year, month, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>
            <button onClick={() => shift(1)} title="Next month" className="px-2.5 py-2.5 text-gray-500 hover:bg-gray-50"><ChevronRight size={16} /></button>
          </div>
          {!isThisMonth && (
            <button onClick={() => { setYear(now.getFullYear()); setMonth(now.getMonth()) }}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-[#1e3a8a] text-white hover:bg-[#162d6e] shadow-sm">This month</button>
          )}
        </div>
      </div>

      {/* Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        <HeroCard
          ring={<RateRing pct={rate} label={mode === 'one' ? 'rate' : 'avg'} />}
          eyebrow={mode === 'one' ? 'Monthly attendance' : 'Team average'}
          headline={mode === 'one' ? empName(person) : `${avgTeam ?? 0}% attendance`}
          sub={mode === 'one' ? [person.job_title, person.departments?.name].filter(Boolean).join(' · ') || 'Employee' : `${teamDays.length} days with records`}
          stats={mode === 'one'
            ? [{ label: 'Streak', value: `${streak.current} days`, Icon: Flame }, { label: 'Avg in', value: fmtClock(summary.avgIn), Icon: LogIn }]
            : [{ label: 'Best day', value: bestDay ? `${parseDate(bestDay.d).getDate()} · ${bestDay.s.teamRate}%` : '—', Icon: Trophy }, { label: 'Avg in', value: fmtClock(summary.avgIn), Icon: LogIn }]}
        />
        <StatCard label={mode === 'one' ? 'Present days' : 'Present marks'} value={summary.present} Icon={CheckCircle2} iconCls="bg-emerald-50 text-emerald-500" sub={mode === 'one' ? `${summary.attended} attended in total` : `${summary.attended} attended in total`} />
        <StatCard label="Late" value={summary.late} Icon={Clock} iconCls="bg-amber-50 text-amber-500" sub={summary.onTime == null ? '—' : `${Math.round(summary.onTime)}% on time`} />
        <StatCard label="Absent" value={summary.absent} Icon={UserX} iconCls="bg-rose-50 text-rose-500" sub={`${summary.half_day} half day · ${summary.holiday} holiday`} />
        <StatCard label={mode === 'one' ? 'Best streak' : 'Avg worked'} value={mode === 'one' ? `${streak.best}d` : fmtDur(summary.avgWorked)} Icon={mode === 'one' ? Flame : Timer} iconCls="bg-indigo-50 text-indigo-500"
          sub={mode === 'one' ? `Avg worked ${fmtDur(summary.avgWorked)}` : 'per completed shift'} />
      </div>

      <div className="grid lg:grid-cols-12 gap-5 items-start">
        {/* Calendar */}
        <section className="lg:col-span-8 bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5">
          <div className="grid grid-cols-7 mb-2">
            {DOW.map(d => <div key={d} className="text-center text-[11px] font-semibold text-gray-400 uppercase tracking-widest py-2">{d}</div>)}
          </div>
          <div className={`grid grid-cols-7 gap-1.5 sm:gap-2 transition-opacity ${loading ? 'opacity-40' : ''}`}>
            {cells.map((d, i) => {
              if (!d) return <div key={`x${i}`} className="aspect-square" />
              const s = dayStats(d)
              const isToday = d === todayStr
              const future  = d > todayStr
              const day = parseDate(d).getDate()
              if (mode === 'one') {
                const st = s?.rec?.status
                const m  = ATT_STATUS[st]
                return (
                  <button key={d} onClick={() => setOpenDay(d)} disabled={future && !s}
                    className={`aspect-square rounded-xl border flex flex-col items-center justify-center gap-0.5 relative transition-all hover:-translate-y-0.5 hover:shadow-sm disabled:hover:translate-y-0 disabled:hover:shadow-none
                      ${m ? m.soft : future ? 'bg-white border-gray-50 text-gray-300' : 'bg-gray-50 border-gray-100 text-gray-500'}
                      ${isToday ? 'ring-2 ring-[#1e3a8a] ring-offset-1' : ''}`}>
                    <span className="text-sm font-bold leading-none">{day}</span>
                    {m && <m.Icon size={13} className="hidden sm:block" />}
                    {s?.rec?.clock_in && <span className="hidden md:block text-[9px] font-semibold opacity-80 tabular-nums">{fmtTime(s.rec.clock_in)}</span>}
                    {s?.rec?.note && <StickyNote size={9} className="absolute top-1.5 right-1.5 opacity-60" />}
                  </button>
                )
              }
              const bg = s?.teamRate != null ? rampFor(s.teamRate) : null
              const light = s?.teamRate != null && s.teamRate < 75
              return (
                <button key={d} onClick={() => setOpenDay(d)} disabled={future && !s}
                  title={s ? `${s.teamRate ?? '—'}% · ${s.attended} attended · ${s.absent} absent` : 'No records'}
                  className={`aspect-square rounded-xl border flex flex-col items-center justify-center relative transition-all hover:-translate-y-0.5 hover:shadow-sm disabled:hover:translate-y-0
                    ${bg ? 'border-transparent' : future ? 'bg-white border-gray-50 text-gray-300' : 'bg-gray-50 border-gray-100 text-gray-500'}
                    ${isToday ? 'ring-2 ring-[#1e3a8a] ring-offset-1' : ''}`}
                  style={bg ? { background: bg, color: light ? '#0f172a' : '#fff' } : undefined}>
                  <span className="text-sm font-bold leading-none">{day}</span>
                  {s?.teamRate != null && <span className="text-[10px] font-semibold mt-1 opacity-90 tabular-nums">{s.teamRate}%</span>}
                  {s && (
                    <span className="hidden sm:flex absolute bottom-1.5 left-2 right-2 h-1 rounded-full overflow-hidden bg-white/40">
                      {STACK_KEYS.map(k => s[k] > 0 && <span key={k} style={{ width: `${(s[k] / s.total) * 100}%`, background: ATT_STATUS[k].color }} />)}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
          <div className="flex flex-wrap items-center gap-3 mt-4 pt-3 border-t border-gray-100">
            {mode === 'one' ? ATT_KEYS.map(k => (
              <span key={k} className="flex items-center gap-1.5 text-[11px] font-medium text-gray-500"><span className={`w-2.5 h-2.5 rounded-sm ${ATT_STATUS[k].dot}`} /> {ATT_STATUS[k].label}</span>
            )) : (
              <span className="flex items-center gap-1.5 text-[11px] text-gray-400">
                Team rate: <span>Low</span>{RAMP.map(c => <span key={c} className="w-3 h-3 rounded-[3px]" style={{ background: c }} />)}<span>High</span>
                <span className="ml-3">· bar = status mix</span>
              </span>
            )}
            <span className="ml-auto text-[11px] text-gray-400">Click a day for details</span>
          </div>
        </section>

        {/* Side panel */}
        <section className="lg:col-span-4 space-y-5">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h3 className="text-[15px] font-bold text-gray-900">Month breakdown</h3>
            <p className="text-xs text-gray-400">{summary.total} record{summary.total !== 1 ? 's' : ''} in {monthLabel}</p>
            <div className="space-y-3 mt-4">
              {ATT_KEYS.map(k => {
                const pct = summary.total ? (summary[k] / summary.total) * 100 : 0
                return (
                  <div key={k}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="flex items-center gap-1.5 text-gray-600"><span className={`w-2 h-2 rounded-sm ${ATT_STATUS[k].dot}`} />{ATT_STATUS[k].label}</span>
                      <span className="font-bold text-gray-800 tabular-nums">{summary[k]} <span className="text-gray-300 font-medium">· {Math.round(pct)}%</span></span>
                    </div>
                    <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${pct}%`, background: ATT_STATUS[k].color }} /></div>
                  </div>
                )
              })}
            </div>
          </div>

          {mode === 'team' ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h3 className="text-[15px] font-bold text-gray-900">Watch list</h3>
              <p className="text-xs text-gray-400">Most absences and late arrivals this month</p>
              {absentees.length === 0 ? <p className="text-sm text-gray-400 py-6 text-center">No absences or late arrivals 🎉</p> : (
                <div className="divide-y divide-gray-50 mt-2">
                  {absentees.map(a => (
                    <button key={a.emp.id} onClick={() => setWho(a.emp.id)} className="w-full flex items-center gap-3 py-2.5 text-left">
                      <Avatar id={a.emp.id} name={empName(a.emp)} src={a.emp.avatar_url || null} size="w-8 h-8 text-[11px]" />
                      <span className="text-sm font-medium text-gray-800 flex-1 truncate">{empName(a.emp)}</span>
                      {a.absent > 0 && <span className="px-1.5 py-0.5 rounded-md text-[11px] font-bold bg-rose-50 text-rose-600">{a.absent} absent</span>}
                      {a.late > 0 && <span className="px-1.5 py-0.5 rounded-md text-[11px] font-bold bg-amber-50 text-amber-600">{a.late} late</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h3 className="text-[15px] font-bold text-gray-900">Recent days</h3>
              <div className="divide-y divide-gray-50 mt-2">
                {[...scopeRecs].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 7).map(r => (
                  <button key={r.id} onClick={() => setOpenDay(r.date)} className="w-full flex items-center gap-3 py-2.5 text-left">
                    <span className="w-10 text-center"><span className="block text-[10px] text-gray-400 uppercase">{DOW[parseDate(r.date).getDay()]}</span><span className="block text-sm font-bold text-gray-800">{parseDate(r.date).getDate()}</span></span>
                    <span className="flex-1 text-xs text-gray-500 tabular-nums">{r.clock_in ? `${fmtTime(r.clock_in)} – ${fmtTime(r.clock_out)}` : '—'}</span>
                    <StatusPill status={r.status} />
                  </button>
                ))}
                {!scopeRecs.length && <p className="text-sm text-gray-400 py-6 text-center">No records this month</p>}
              </div>
            </div>
          )}
        </section>
      </div>

      {openDay && (
        <DayModal date={openDay} mode={mode} employee={person} records={teamRecs} employees={employees} onClose={() => setOpenDay(null)} />
      )}
    </div>
  )
}
