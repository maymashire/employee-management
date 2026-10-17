/**
 * Attendance Reports — period analytics with comparison to the previous
 * period: KPIs, status trend, attendance-rate trend, weekday pattern,
 * check-in time distribution, department comparison and an employee
 * leaderboard. Filterable by department; exportable.
 */
import { useState, useEffect, useMemo, useRef } from 'react'
import * as db from '../../lib/db'
import {
  BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell,
} from 'recharts'
import {
  Activity, Timer, Clock, UserX, TrendingUp, Hourglass, Download, Printer, RefreshCw, BarChart3,
  CalendarRange, Building2, Users, ArrowUpDown, LogIn,
} from 'lucide-react'
import { useCompany } from '../../context/CompanyContext'
import { SearchBox, Avatar, downloadCSV, EmptyState } from '../../components/ui'
import { Panel, KpiTile, Delta, TrendLegend } from '../dashboard/widgets'
import { empName } from '../../lib/people'
import {
  ATT_STATUS, STACK_KEYS, summarize, overtimeMins, toDateStr, addDays, parseDate, minsOf, fmtClock, fmtDur,
} from '../../lib/attendance'

const PERIODS = [
  { key: '7',     label: '7 days' },
  { key: 'month', label: 'This month' },
  { key: '30',    label: '30 days' },
  { key: '90',    label: '90 days' },
  { key: 'year',  label: 'This year' },
]
const BLUE = '#2a78d6'
const DOW  = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function periodRange(key, now = new Date()) {
  const end = toDateStr(now)
  if (key === 'month') return { start: toDateStr(new Date(now.getFullYear(), now.getMonth(), 1)), end }
  if (key === 'year')  return { start: `${now.getFullYear()}-01-01`, end }
  return { start: toDateStr(addDays(now, -(Number(key) - 1))), end }
}
const daysBetween = (a, b) => Math.round((parseDate(b) - parseDate(a)) / 864e5) + 1

const SORTS = {
  rate:     { label: 'Attendance rate', fn: (a, b) => (b.s.rate ?? -1) - (a.s.rate ?? -1) },
  late:     { label: 'Most late',       fn: (a, b) => b.s.late - a.s.late },
  absent:   { label: 'Most absent',     fn: (a, b) => b.s.absent - a.s.absent },
  overtime: { label: 'Most overtime',   fn: (a, b) => b.ot - a.ot },
  name:     { label: 'Name A–Z',        fn: (a, b) => empName(a.emp).localeCompare(empName(b.emp)) },
}

function ChartTip({ active, payload, suffix = '' }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-lg px-3.5 py-2.5 text-xs min-w-[150px]">
      <p className="font-bold text-gray-800 mb-1">{d.title ?? d.label}</p>
      {payload.map(p => (
        <p key={p.dataKey} className="flex items-center justify-between gap-4 text-gray-500 py-0.5">
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm" style={{ background: p.color ?? p.fill }} />{p.name}</span>
          <span className="font-semibold text-gray-800 tabular-nums">{p.value ?? '—'}{p.value != null ? suffix : ''}</span>
        </p>
      ))}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════════
export default function AttendanceReports() {
  const { company } = useCompany()
  const shiftStart = company.shift_start || '09:00'
  const shiftEnd   = company.shift_end || '17:00'

  const [period,    setPeriod]    = useState(() => { try { return localStorage.getItem('att_report_period') || 'month' } catch { return 'month' } })
  const [dept,      setDept]      = useState('all')
  const [employees, setEmployees] = useState([])
  const [records,   setRecords]   = useState([])
  const [loading,   setLoading]   = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search,    setSearch]    = useState('')
  const [sort,      setSort]      = useState('rate')
  const reqId = useRef(0)

  const range = useMemo(() => periodRange(period), [period])
  const len   = daysBetween(range.start, range.end)
  const prev  = useMemo(() => (period === 'year'
    ? { start: `${Number(range.start.slice(0, 4)) - 1}-01-01`, end: `${Number(range.start.slice(0, 4)) - 1}${range.end.slice(4)}` }
    : { start: toDateStr(addDays(parseDate(range.start), -len)), end: toDateStr(addDays(parseDate(range.start), -1)) }), [period, range, len])

  async function load(soft = false) {
    const id = ++reqId.current
    soft ? setRefreshing(true) : setLoading(true)
    try {
      const [emps, recs] = await Promise.all([db.getEmployees(), db.getAttendanceRange(prev.start, range.end)])
      if (id !== reqId.current) return
      setEmployees(emps); setRecords(recs)
    } catch {}
    if (id === reqId.current) { setLoading(false); setRefreshing(false) }
  }
  useEffect(() => { load() }, [prev.start, range.end]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { try { localStorage.setItem('att_report_period', period) } catch {} }, [period])

  // ── Scope ──
  const active = useMemo(() => employees.filter(e => e.status === 'active'), [employees])
  const deptNames = useMemo(() => [...new Set(active.map(e => e.departments?.name ?? 'Unassigned'))].sort(), [active])
  const scopeEmps = useMemo(() => active.filter(e => dept === 'all' || (e.departments?.name ?? 'Unassigned') === dept), [active, dept])
  const scopeIds  = useMemo(() => new Set(scopeEmps.map(e => e.id)), [scopeEmps])
  const inScope   = useMemo(() => records.filter(r => scopeIds.has(r.employee_id)), [records, scopeIds])
  const cur       = useMemo(() => inScope.filter(r => r.date >= range.start && r.date <= range.end), [inScope, range])
  const before    = useMemo(() => inScope.filter(r => r.date >= prev.start && r.date <= prev.end), [inScope, prev])

  const S  = useMemo(() => summarize(cur), [cur])
  const P  = useMemo(() => summarize(before), [before])
  const ot = overtimeMins(cur, shiftEnd)
  const otPrev = overtimeMins(before, shiftEnd)
  const diff = (a, b) => (a == null || b == null ? null : a - b)
  const pctDiff = (a, b) => (b ? ((a - b) / b) * 100 : null)

  // ── Trend buckets (days, or months for the year view) ──
  const buckets = useMemo(() => {
    const monthly = period === 'year'
    const keys = monthly
      ? Array.from({ length: Number(range.end.slice(5, 7)) }, (_, i) => `${range.start.slice(0, 4)}-${String(i + 1).padStart(2, '0')}`)
      : Array.from({ length: len }, (_, i) => toDateStr(addDays(parseDate(range.start), i)))
    const by = {}
    cur.forEach(r => { (by[monthly ? r.date.slice(0, 7) : r.date] ??= []).push(r) })
    return keys.map(k => {
      const s = summarize(by[k] ?? [])
      const d = parseDate(monthly ? `${k}-01` : k)
      return {
        key: k,
        label: monthly ? d.toLocaleDateString('en-US', { month: 'short' }) : len > 14 ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' }),
        title: monthly ? d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }),
        present: s.present, late: s.late, half_day: s.half_day, absent: s.absent,
        rate: s.total ? (s.rate == null ? null : Math.round(s.rate)) : null,
      }
    })
  }, [cur, period, range, len])

  const weekday = useMemo(() => DOW.map((label, i) => {
    const s = summarize(cur.filter(r => parseDate(r.date).getDay() === i))
    return { label, title: label, rate: s.total ? Math.round(s.rate ?? 0) : null, n: s.total }
  }), [cur])

  const histogram = useMemo(() => {
    const start = minsOf(shiftStart)
    const lo = start - 90, hi = start + 120, step = 15
    const bins = Array.from({ length: (hi - lo) / step }, (_, i) => ({ from: lo + i * step, n: 0 }))
    cur.forEach(r => {
      const m = minsOf(r.clock_in)
      if (m == null) return
      const idx = Math.min(bins.length - 1, Math.max(0, Math.floor((m - lo) / step)))
      bins[idx].n++
    })
    return bins.map(b => ({ ...b, label: fmtClock(b.from), title: `${fmtClock(b.from)} – ${fmtClock(b.from + step)}`, late: b.from >= start }))
  }, [cur, shiftStart])

  const deptRows = useMemo(() => deptNames.filter(n => dept === 'all' || n === dept).map(name => {
    const ids = new Set(active.filter(e => (e.departments?.name ?? 'Unassigned') === name).map(e => e.id))
    const recs = cur.filter(r => ids.has(r.employee_id))
    return { name, headcount: ids.size, s: summarize(recs) }
  }).sort((a, b) => (b.s.rate ?? -1) - (a.s.rate ?? -1)), [deptNames, dept, active, cur])

  const people = useMemo(() => {
    const q = search.trim().toLowerCase()
    return scopeEmps
      .filter(e => !q || empName(e).toLowerCase().includes(q) || (e.departments?.name ?? '').toLowerCase().includes(q))
      .map(e => { const recs = cur.filter(r => r.employee_id === e.id); return { emp: e, s: summarize(recs), ot: overtimeMins(recs, shiftEnd) } })
      .sort(SORTS[sort].fn)
  }, [scopeEmps, cur, search, sort, shiftEnd])

  const rangeLabel = `${parseDate(range.start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${parseDate(range.end).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
  const rateSeries = buckets.map(b => b.rate)

  function exportCSV() {
    downloadCSV(people.map(p => ({
      Employee: empName(p.emp), Department: p.emp.departments?.name ?? '', 'Days Recorded': p.s.total,
      'Attendance %': p.s.rate ?? '', 'On-time %': p.s.onTime ?? '', Present: p.s.present, Late: p.s.late,
      'Half Day': p.s.half_day, Absent: p.s.absent, Holiday: p.s.holiday,
      'Avg Check-in': p.s.avgIn == null ? '' : fmtClock(p.s.avgIn), 'Avg Worked': fmtDur(p.s.avgWorked), 'Overtime': fmtDur(p.ot),
    })), `attendance-report-${range.start}-to-${range.end}.csv`)
  }

  return (
    <div className="space-y-5 pb-10">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight">Attendance reports</h2>
          <p className="text-sm text-gray-400 mt-1 flex items-center gap-1.5"><CalendarRange size={14} /> {rangeLabel} · compared with the previous {period === 'year' ? 'year' : `${len} days`}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 p-1 bg-white border border-gray-200 rounded-xl shadow-sm overflow-x-auto">
            {PERIODS.map(p => (
              <button key={p.key} onClick={() => setPeriod(p.key)}
                className={`px-3 py-1.5 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors ${period === p.key ? 'bg-[#1e3a8a] text-white shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}>
                {p.label}
              </button>
            ))}
          </div>
          <div className="relative">
            <Building2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <select value={dept} onChange={e => setDept(e.target.value)}
              className="pl-8 pr-3 py-2.5 text-sm rounded-xl border border-gray-200 bg-white shadow-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/20">
              <option value="all">All departments</option>
              {deptNames.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <button onClick={() => window.print()} title="Print" className="w-10 h-10 rounded-xl flex items-center justify-center bg-white border border-gray-200 shadow-sm text-gray-500 hover:bg-gray-50"><Printer size={15} /></button>
          <button onClick={() => load(true)} title="Refresh" className="w-10 h-10 rounded-xl flex items-center justify-center bg-white border border-gray-200 shadow-sm text-gray-500 hover:bg-gray-50"><RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} /></button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6 gap-4">
        <KpiTile label="Attendance rate" value={S.rate == null ? '—' : `${Math.round(S.rate)}%`} Icon={Activity} tone="bg-emerald-50 text-emerald-500"
          delta={<Delta value={diff(S.rate, P.rate)} suffix=" pts" label="vs previous" />} series={rateSeries} color="#10b981" sub={`${S.attended} attended of ${S.attended + S.absent}`} />
        <KpiTile label="On-time rate" value={S.onTime == null ? '—' : `${Math.round(S.onTime)}%`} Icon={Timer} tone="bg-sky-50 text-sky-500"
          delta={<Delta value={diff(S.onTime, P.onTime)} suffix=" pts" label="vs previous" />} sub={`Shift starts ${fmtClock(minsOf(shiftStart))}`} />
        <KpiTile label="Late arrivals" value={S.late} Icon={Clock} tone="bg-amber-50 text-amber-500"
          delta={<Delta value={pctDiff(S.late, P.late)} suffix="%" goodWhenUp={false} label="vs previous" />} sub={`${P.late} in the previous period`} />
        <KpiTile label="Absences" value={S.absent} Icon={UserX} tone="bg-rose-50 text-rose-500"
          delta={<Delta value={pctDiff(S.absent, P.absent)} suffix="%" goodWhenUp={false} label="vs previous" />} sub={`${S.half_day} half days · ${S.holiday} holidays`} />
        <KpiTile label="Overtime" value={fmtDur(ot)} Icon={TrendingUp} tone="bg-violet-50 text-violet-500"
          delta={<Delta value={pctDiff(ot, otPrev)} suffix="%" label="vs previous" />} sub={`Worked past ${fmtClock(minsOf(shiftEnd))}`} />
        <KpiTile label="Avg worked / day" value={fmtDur(S.avgWorked)} Icon={Hourglass} tone="bg-indigo-50 text-indigo-500"
          delta={<Delta value={S.avgWorked == null || P.avgWorked == null ? null : (S.avgWorked - P.avgWorked)} suffix=" min" label="vs previous" />} sub={`Avg check-in ${fmtClock(S.avgIn)}`} />
      </div>

      {loading ? (
        <div className="grid lg:grid-cols-2 gap-5">{[0, 1].map(i => <div key={i} className="h-80 bg-white rounded-2xl border border-gray-100 shimmer" />)}</div>
      ) : cur.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
          <EmptyState Icon={BarChart3} title="No attendance recorded in this period" sub="Pick a longer period or mark attendance from Daily Attendance." />
        </div>
      ) : (
        <>
          <div className="grid lg:grid-cols-12 gap-5">
            <Panel className="lg:col-span-7" title="Status mix" sub={period === 'year' ? 'Per month' : 'Per day'} Icon={BarChart3} action={<TrendLegend />}>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={buckets} margin={{ top: 6, right: 4, left: -18, bottom: 0 }} barCategoryGap={buckets.length > 31 ? '10%' : '24%'}>
                  <CartesianGrid stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} interval={buckets.length > 31 ? 13 : buckets.length > 14 ? 2 : 0} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTip />} cursor={{ fill: '#f8fafc', radius: 6 }} />
                  {STACK_KEYS.map((k, i) => (
                    <Bar key={k} dataKey={k} name={ATT_STATUS[k].label} stackId="a" fill={ATT_STATUS[k].color} maxBarSize={30}
                      stroke="#fff" strokeWidth={buckets.length > 31 ? 0 : 1.5} radius={i === STACK_KEYS.length - 1 ? [4, 4, 0, 0] : 0} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </Panel>
            <Panel className="lg:col-span-5" title="Attendance rate" sub="Attended ÷ (attended + absent)" Icon={Activity}>
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={buckets} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
                  <defs>
                    <linearGradient id="rep-rate" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={BLUE} stopOpacity={0.22} /><stop offset="100%" stopColor={BLUE} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} interval={buckets.length > 31 ? 13 : buckets.length > 14 ? 2 : 0} />
                  <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTip suffix="%" />} cursor={{ stroke: '#cbd5e1', strokeDasharray: '4 3' }} />
                  <Area type="monotone" dataKey="rate" name="Attendance" stroke={BLUE} strokeWidth={2} fill="url(#rep-rate)" connectNulls
                    dot={buckets.length <= 31 ? { r: 3, fill: BLUE, stroke: '#fff', strokeWidth: 1.5 } : false} activeDot={{ r: 5, stroke: '#fff', strokeWidth: 2 }} />
                </AreaChart>
              </ResponsiveContainer>
            </Panel>
          </div>

          <div className="grid lg:grid-cols-12 gap-5">
            <Panel className="lg:col-span-5" title="By weekday" sub="Average attendance rate" Icon={CalendarRange}>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={weekday} margin={{ top: 6, right: 4, left: -18, bottom: 0 }}>
                  <CartesianGrid stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTip suffix="%" />} cursor={{ fill: '#f8fafc', radius: 6 }} />
                  <Bar dataKey="rate" name="Attendance" fill={BLUE} radius={[4, 4, 0, 0]} maxBarSize={36} />
                </BarChart>
              </ResponsiveContainer>
            </Panel>
            <Panel className="lg:col-span-7" title="Check-in times" sub={`15-minute buckets · line = shift start ${fmtClock(minsOf(shiftStart))}`} Icon={LogIn}
              action={
                <span className="flex items-center gap-3 text-[11px] text-gray-500 mt-1">
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: ATT_STATUS.present.color }} />On time</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: ATT_STATUS.late.color }} />Late</span>
                </span>
              }>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={histogram} margin={{ top: 6, right: 4, left: -18, bottom: 0 }} barCategoryGap="12%">
                  <CartesianGrid stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} interval={1} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTip />} cursor={{ fill: '#f8fafc', radius: 6 }} />
                  <ReferenceLine x={fmtClock(minsOf(shiftStart))} stroke="#0f172a" strokeDasharray="4 3" />
                  <Bar dataKey="n" name="Check-ins" radius={[4, 4, 0, 0]}>
                    {histogram.map(b => <Cell key={b.from} fill={b.late ? ATT_STATUS.late.color : ATT_STATUS.present.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Panel>
          </div>

          {/* Departments */}
          <Panel title="Departments" sub="Ranked by attendance rate" Icon={Building2} bodyClass="pt-3 pb-2">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[640px]">
                <thead>
                  <tr className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                    {['Department', 'People', 'Attendance', 'On time', 'Late', 'Absent', 'Avg check-in'].map((h, i) => (
                      <th key={h} className={`px-5 pb-2 ${i > 1 ? 'text-right' : 'text-left'}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {deptRows.map(d => (
                    <tr key={d.name} className="hover:bg-gray-50/60">
                      <td className="px-5 py-2.5 font-semibold text-gray-800">{d.name}</td>
                      <td className="px-5 py-2.5 text-gray-500">{d.headcount}</td>
                      <td className="px-5 py-2.5">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-20 h-1.5 rounded-full bg-gray-100 overflow-hidden"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${d.s.rate ?? 0}%` }} /></div>
                          <span className="text-xs font-bold text-gray-800 w-10 text-right tabular-nums">{d.s.rate == null ? '—' : `${Math.round(d.s.rate)}%`}</span>
                        </div>
                      </td>
                      <td className="px-5 py-2.5 text-right text-gray-600 tabular-nums">{d.s.onTime == null ? '—' : `${Math.round(d.s.onTime)}%`}</td>
                      <td className="px-5 py-2.5 text-right tabular-nums">{d.s.late ? <span className="font-semibold text-amber-600">{d.s.late}</span> : <span className="text-gray-300">0</span>}</td>
                      <td className="px-5 py-2.5 text-right tabular-nums">{d.s.absent ? <span className="font-semibold text-rose-600">{d.s.absent}</span> : <span className="text-gray-300">0</span>}</td>
                      <td className="px-5 py-2.5 text-right text-gray-600 tabular-nums">{fmtClock(d.s.avgIn)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          {/* Leaderboard */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex flex-col md:flex-row md:items-center gap-2.5">
              <div className="flex items-center gap-2.5 md:mr-2">
                <span className="w-8 h-8 rounded-xl bg-indigo-50 text-[#1e3a8a] flex items-center justify-center"><Users size={16} /></span>
                <div><h3 className="text-[15px] font-bold text-gray-900">Employees</h3><p className="text-xs text-gray-400">{people.length} in scope</p></div>
              </div>
              <SearchBox value={search} onChange={setSearch} placeholder="Search employee…" />
              <div className="relative md:w-48">
                <ArrowUpDown size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <select value={sort} onChange={e => setSort(e.target.value)}
                  className="w-full pl-8 pr-3 py-2.5 text-sm rounded-xl border border-gray-200 bg-gray-50 text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/20">
                  {Object.entries(SORTS).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}
                </select>
              </div>
              <button onClick={exportCSV} disabled={!people.length}
                className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl text-sm font-semibold text-gray-600 border border-gray-200 hover:bg-gray-50 disabled:opacity-40">
                <Download size={15} /> Export
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[820px]">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/60 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                    {['#', 'Employee', 'Days', 'Attendance', 'On time', 'Late', 'Absent', 'Avg in', 'Avg worked', 'Overtime'].map((h, i) => (
                      <th key={h} className={`px-4 py-3 whitespace-nowrap ${i > 2 ? 'text-right' : 'text-left'}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {people.map((p, i) => (
                    <tr key={p.emp.id} className="hover:bg-gray-50/60">
                      <td className="px-4 py-2.5 text-xs text-gray-300 font-bold">{i + 1}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2.5 min-w-[180px]">
                          <Avatar id={p.emp.id} name={empName(p.emp)} src={p.emp.avatar_url || null} size="w-8 h-8 text-[11px]" />
                          <div className="min-w-0"><p className="font-semibold text-gray-800 truncate">{empName(p.emp)}</p><p className="text-[11px] text-gray-400 truncate">{p.emp.departments?.name ?? 'Unassigned'}</p></div>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-gray-500 tabular-nums">{p.s.total}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-1.5 rounded-full bg-gray-100 overflow-hidden"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${p.s.rate ?? 0}%` }} /></div>
                          <span className="text-xs font-bold text-gray-800 w-10 text-right tabular-nums">{p.s.rate == null ? '—' : `${Math.round(p.s.rate)}%`}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-right text-gray-600 tabular-nums">{p.s.onTime == null ? '—' : `${Math.round(p.s.onTime)}%`}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{p.s.late ? <span className="font-semibold text-amber-600">{p.s.late}</span> : <span className="text-gray-300">0</span>}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{p.s.absent ? <span className="font-semibold text-rose-600">{p.s.absent}</span> : <span className="text-gray-300">0</span>}</td>
                      <td className="px-4 py-2.5 text-right text-gray-600 tabular-nums">{fmtClock(p.s.avgIn)}</td>
                      <td className="px-4 py-2.5 text-right text-gray-600 tabular-nums">{fmtDur(p.s.avgWorked)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{p.ot ? <span className="font-semibold text-violet-600">{fmtDur(p.ot)}</span> : <span className="text-gray-300">—</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
