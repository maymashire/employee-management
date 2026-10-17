/**
 * Analytics — yearly people analytics in three views:
 *   Workforce   — headcount growth, hires, departments, status, tenure
 *   Attendance  — monthly status mix, late vs absent, weekday & department rates
 *   Performance — attendance scorecard per employee (+ bonuses for payroll roles)
 */
import { useState, useEffect, useMemo, useRef } from 'react'
import * as db from '../../lib/db'
import {
  BarChart, Bar, AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import {
  Users, UserCheck, Star, Activity, UserPlus, CalendarRange, Building2, Clock, UserX, Timer, Award,
  Target, Gift, Download, Printer, RefreshCw, Hourglass, ArrowUpDown, TrendingUp, ShieldCheck,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { Avatar, SearchBox, downloadCSV } from '../../components/ui'
import { Panel, KpiTile, Delta, TrendLegend } from '../dashboard/widgets'
import { EMP_STATUS, EMP_STATUS_KEYS, empName, tenureMonths } from '../../lib/people'
import { ATT_STATUS, STACK_KEYS, summarize, parseDate, fmtClock, toDateStr } from '../../lib/attendance'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DOW    = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const BLUE   = '#2a78d6'
const USD0   = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const money  = n => USD0.format(Number(n) || 0)
const AXIS   = { fontSize: 10, fill: '#94a3b8' }

const TABS = [
  { id: 'workforce',   label: 'Workforce',   Icon: Users },
  { id: 'attendance',  label: 'Attendance',  Icon: UserCheck },
  { id: 'performance', label: 'Performance', Icon: Star },
]

function Tip({ active, payload, suffix = '', fmt }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-lg px-3.5 py-2.5 text-xs min-w-[140px]">
      <p className="font-bold text-gray-800 mb-1">{d.title ?? d.label ?? d.name}</p>
      {payload.map(p => (
        <p key={p.dataKey} className="flex items-center justify-between gap-4 text-gray-500 py-0.5">
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm" style={{ background: p.color ?? p.fill }} />{p.name}</span>
          <span className="font-semibold text-gray-800 tabular-nums">{p.value == null ? '—' : fmt ? fmt(p.value) : `${p.value}${suffix}`}</span>
        </p>
      ))}
    </div>
  )
}

function Legend2({ items }) {
  return (
    <span className="flex items-center gap-3 text-[11px] text-gray-500 mt-1">
      {items.map(([label, color]) => <span key={label} className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: color }} />{label}</span>)}
    </span>
  )
}

function HBars({ rows, valueLabel = v => v, color = BLUE, max }) {
  const m = max ?? Math.max(1, ...rows.map(r => r.value ?? 0))
  if (!rows.length) return <p className="text-sm text-gray-400 py-10 text-center">No data yet</p>
  return (
    <div className="space-y-2.5">
      {rows.map(r => (
        <div key={r.name} title={`${r.name}: ${valueLabel(r.value)}`}>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="font-medium text-gray-700 truncate">{r.name}</span>
            <span className="font-bold text-gray-800 tabular-nums">{valueLabel(r.value)}{r.sub && <span className="text-gray-300 font-medium"> · {r.sub}</span>}</span>
          </div>
          <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${((r.value ?? 0) / m) * 100}%`, background: r.color ?? color, transition: 'width .5s ease' }} />
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Workforce ─────────────────────────────────────────────────────────────────
function WorkforceTab({ employees, year }) {
  const active = employees.filter(e => e.status === 'active')
  const now = new Date()
  const endOf = m => { const d = new Date(year, m + 1, 0); const t = toDateStr(d); return t > toDateStr(now) ? toDateStr(now) : t }
  const lastMonth = year === now.getFullYear() ? now.getMonth() : 11
  const months = MONTHS.slice(0, lastMonth + 1).map((label, i) => ({
    label, title: `${label} ${year}`,
    headcount: active.filter(e => !e.hire_date || e.hire_date <= endOf(i)).length,
    hires: employees.filter(e => e.hire_date?.startsWith(`${year}-${String(i + 1).padStart(2, '0')}`)).length,
  }))
  const hiresYear = months.reduce((s, m) => s + m.hires, 0)
  const startHead = active.filter(e => !e.hire_date || e.hire_date < `${year}-01-01`).length
  const tenures = active.map(e => tenureMonths(e.hire_date)).filter(v => v != null)
  const avgTenure = tenures.length ? tenures.reduce((s, v) => s + v, 0) / tenures.length / 12 : null
  const nonActive = employees.length - active.length

  const depts = Object.entries(active.reduce((m, e) => { const k = e.departments?.name ?? 'Unassigned'; m[k] = (m[k] ?? 0) + 1; return m }, {}))
    .map(([name, value]) => ({ name, value, sub: `${Math.round((value / (active.length || 1)) * 100)}%` })).sort((a, b) => b.value - a.value)
  const status = EMP_STATUS_KEYS.map(k => ({ name: EMP_STATUS[k].label, value: employees.filter(e => e.status === k).length, color: { active: '#10b981', inactive: '#94a3b8', suspended: '#f59e0b', terminated: '#f43f5e' }[k] }))
  const BUCKETS = [['< 6 months', 0, 6], ['6–12 months', 6, 12], ['1–2 years', 12, 24], ['2–5 years', 24, 60], ['5+ years', 60, Infinity]]
  const tenureRows = BUCKETS.map(([name, a, b]) => ({ name, value: tenures.filter(t => t >= a && t < b).length }))

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiTile label="Active headcount" value={active.length} Icon={Users} tone="bg-indigo-50 text-indigo-500"
          delta={<Delta value={active.length - startHead} label={`since Jan ${year}`} />} series={months.map(m => m.headcount)} color="#6366f1" sub={`${employees.length} people on record`} />
        <KpiTile label={`Hires in ${year}`} value={hiresYear} Icon={UserPlus} tone="bg-emerald-50 text-emerald-500"
          delta={<span className="text-[11px] text-gray-400">{(hiresYear / Math.max(1, months.length)).toFixed(1)} per month</span>} series={months.map(m => m.hires)} color="#10b981" />
        <KpiTile label="Average tenure" value={avgTenure == null ? '—' : `${avgTenure.toFixed(1)} yrs`} Icon={CalendarRange} tone="bg-sky-50 text-sky-500"
          delta={<span className="text-[11px] text-gray-400">{tenures.filter(t => t < 12).length} under one year</span>} />
        <KpiTile label="Not active" value={nonActive} Icon={ShieldCheck} tone="bg-amber-50 text-amber-500"
          delta={<span className="text-[11px] text-gray-400">{employees.length ? Math.round((nonActive / employees.length) * 100) : 0}% of all records</span>} sub="inactive, suspended or terminated" />
      </div>
      <div className="grid lg:grid-cols-12 gap-5">
        <Panel className="lg:col-span-7" title="Headcount growth" sub={`Active employees at month end · ${year}`} Icon={TrendingUp}>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={months} margin={{ top: 6, right: 8, left: -20, bottom: 0 }}>
              <defs><linearGradient id="an-head" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={BLUE} stopOpacity={0.22} /><stop offset="100%" stopColor={BLUE} stopOpacity={0} /></linearGradient></defs>
              <CartesianGrid stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="label" tick={AXIS} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={AXIS} axisLine={false} tickLine={false} />
              <Tooltip content={<Tip />} cursor={{ stroke: '#cbd5e1', strokeDasharray: '4 3' }} />
              <Area type="monotone" dataKey="headcount" name="Headcount" stroke={BLUE} strokeWidth={2} fill="url(#an-head)" dot={{ r: 3, fill: BLUE, stroke: '#fff', strokeWidth: 1.5 }} activeDot={{ r: 5 }} />
            </AreaChart>
          </ResponsiveContainer>
        </Panel>
        <Panel className="lg:col-span-5" title="Hires per month" sub={`${hiresYear} new hires in ${year}`} Icon={UserPlus}>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={months} margin={{ top: 6, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="label" tick={AXIS} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={AXIS} axisLine={false} tickLine={false} />
              <Tooltip content={<Tip />} cursor={{ fill: '#f8fafc', radius: 6 }} />
              <Bar dataKey="hires" name="Hires" fill={BLUE} radius={[4, 4, 0, 0]} maxBarSize={30} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>
      </div>
      <div className="grid lg:grid-cols-3 gap-5">
        <Panel title="Departments" sub="Active employees" Icon={Building2}><HBars rows={depts} /></Panel>
        <Panel title="Employment status" sub="All records" Icon={UserCheck}><HBars rows={status} max={Math.max(1, employees.length)} /></Panel>
        <Panel title="Tenure" sub="Active employees by time with the company" Icon={Hourglass}><HBars rows={tenureRows} /></Panel>
      </div>
    </>
  )
}

// ── Attendance ────────────────────────────────────────────────────────────────
function AttendanceTab({ employees, att, year }) {
  const activeIds = new Set(employees.filter(e => e.status === 'active').map(e => e.id))
  const recs = att.filter(r => activeIds.has(r.employee_id))
  const S = summarize(recs)
  const months = MONTHS.map((label, i) => {
    const s = summarize(recs.filter(r => Number(r.date.slice(5, 7)) === i + 1))
    return { label, title: `${label} ${year}`, present: s.present, late: s.late, half_day: s.half_day, absent: s.absent, rate: s.total ? Math.round(s.rate ?? 0) : null, onTime: s.onTime == null ? null : Math.round(s.onTime) }
  })
  const withData = months.filter(m => m.rate != null)
  const lastTwo  = withData.slice(-2)
  const weekday = DOW.map((label, i) => { const s = summarize(recs.filter(r => parseDate(r.date).getDay() === i)); return { label, title: label, rate: s.total ? Math.round(s.rate ?? 0) : null } })
  const deptRows = Object.entries(recs.reduce((m, r) => {
    const e = employees.find(x => x.id === r.employee_id); const k = e?.departments?.name ?? 'Unassigned'; (m[k] ??= []).push(r); return m
  }, {})).map(([name, list]) => { const s = summarize(list); return { name, value: s.rate == null ? 0 : Math.round(s.rate), sub: `${s.late} late` } }).sort((a, b) => b.value - a.value)

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiTile label="Attendance rate" value={S.rate == null ? '—' : `${Math.round(S.rate)}%`} Icon={Activity} tone="bg-emerald-50 text-emerald-500"
          delta={<Delta value={lastTwo.length === 2 ? lastTwo[1].rate - lastTwo[0].rate : null} suffix=" pts" label="latest month vs previous" />} series={months.map(m => m.rate)} color="#10b981" />
        <KpiTile label="On-time rate" value={S.onTime == null ? '—' : `${Math.round(S.onTime)}%`} Icon={Timer} tone="bg-sky-50 text-sky-500"
          delta={<span className="text-[11px] text-gray-400">Avg check-in {fmtClock(S.avgIn)}</span>} series={months.map(m => m.onTime)} color="#0ea5e9" />
        <KpiTile label="Late arrivals" value={S.late} Icon={Clock} tone="bg-amber-50 text-amber-500"
          delta={<span className="text-[11px] text-gray-400">{withData.length ? (S.late / withData.length).toFixed(1) : 0} per month</span>} series={months.map(m => m.late)} color="#f59e0b" />
        <KpiTile label="Absences" value={S.absent} Icon={UserX} tone="bg-rose-50 text-rose-500"
          delta={<span className="text-[11px] text-gray-400">{S.half_day} half days · {S.holiday} holidays</span>} series={months.map(m => m.absent)} color="#f43f5e" />
      </div>
      <div className="grid lg:grid-cols-12 gap-5">
        <Panel className="lg:col-span-7" title="Monthly status mix" sub={`${S.total} records in ${year}`} Icon={UserCheck} action={<TrendLegend />}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={months} margin={{ top: 6, right: 4, left: -18, bottom: 0 }}>
              <CartesianGrid stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="label" tick={AXIS} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={AXIS} axisLine={false} tickLine={false} />
              <Tooltip content={<Tip />} cursor={{ fill: '#f8fafc', radius: 6 }} />
              {STACK_KEYS.map((k, i) => <Bar key={k} dataKey={k} name={ATT_STATUS[k].label} stackId="a" fill={ATT_STATUS[k].color} stroke="#fff" strokeWidth={1.5} maxBarSize={30} radius={i === STACK_KEYS.length - 1 ? [4, 4, 0, 0] : 0} />)}
            </BarChart>
          </ResponsiveContainer>
        </Panel>
        <Panel className="lg:col-span-5" title="Late vs absent" sub="Count per month" Icon={Clock}
          action={<Legend2 items={[['Late', ATT_STATUS.late.color], ['Absent', ATT_STATUS.absent.color]]} />}>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={months} margin={{ top: 6, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="label" tick={AXIS} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={AXIS} axisLine={false} tickLine={false} />
              <Tooltip content={<Tip />} cursor={{ stroke: '#cbd5e1', strokeDasharray: '4 3' }} />
              <Line type="monotone" dataKey="late" name="Late" stroke={ATT_STATUS.late.color} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
              <Line type="monotone" dataKey="absent" name="Absent" stroke={ATT_STATUS.absent.color} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </Panel>
      </div>
      <div className="grid lg:grid-cols-2 gap-5">
        <Panel title="By weekday" sub="Average attendance rate" Icon={CalendarRange}>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={weekday} margin={{ top: 6, right: 4, left: -18, bottom: 0 }}>
              <CartesianGrid stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="label" tick={AXIS} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} tick={AXIS} axisLine={false} tickLine={false} />
              <Tooltip content={<Tip suffix="%" />} cursor={{ fill: '#f8fafc', radius: 6 }} />
              <Bar dataKey="rate" name="Attendance" fill={BLUE} radius={[4, 4, 0, 0]} maxBarSize={36} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>
        <Panel title="By department" sub="Attendance rate" Icon={Building2}><HBars rows={deptRows} max={100} valueLabel={v => `${v}%`} color="#10b981" /></Panel>
      </div>
    </>
  )
}

// ── Performance ───────────────────────────────────────────────────────────────
const P_SORTS = {
  score:  { label: 'Attendance score', fn: (a, b) => b.score - a.score },
  punct:  { label: 'Punctuality',      fn: (a, b) => b.punct - a.punct },
  late:   { label: 'Most late',        fn: (a, b) => b.s.late - a.s.late },
  absent: { label: 'Most absent',      fn: (a, b) => b.s.absent - a.s.absent },
  bonus:  { label: 'Bonus',            fn: (a, b) => b.bonus - a.bonus },
}
const scoreColor = v => (v >= 90 ? '#10b981' : v >= 75 ? '#2a78d6' : v >= 60 ? '#f59e0b' : '#f43f5e')

function PerformanceTab({ employees, att, payroll, canPay, year }) {
  const [q, setQ] = useState('')
  const [sort, setSort] = useState('score')
  const bonusBy = useMemo(() => payroll.reduce((m, r) => {
    const id = r.employee_id ?? r.employee_salary_config?.employee_id
    if (id) m[id] = (m[id] ?? 0) + (Number(r.bonus) || 0)
    return m
  }, {}), [payroll])

  const rows = useMemo(() => employees.filter(e => e.status === 'active').map(e => {
    const s = summarize(att.filter(r => r.employee_id === e.id))
    return { emp: e, s, score: s.rate == null ? 0 : Math.round(s.rate), punct: s.onTime == null ? 0 : Math.round(s.onTime), bonus: bonusBy[e.id] ?? 0 }
  }).filter(r => r.s.total > 0), [employees, att, bonusBy])

  const shown = rows.filter(r => !q || empName(r.emp).toLowerCase().includes(q.toLowerCase())).sort(P_SORTS[sort].fn)
  const best  = [...rows].sort(P_SORTS.score.fn)[0]
  const punct = [...rows].sort(P_SORTS.punct.fn)[0]
  const avg   = rows.length ? Math.round(rows.reduce((s, r) => s + r.score, 0) / rows.length) : null
  const perfect = rows.filter(r => r.s.absent === 0 && r.s.late === 0).length
  const totalBonus = Object.values(bonusBy).reduce((s, v) => s + v, 0)
  const top10 = [...rows].sort(P_SORTS.score.fn).slice(0, 10).map(r => ({ name: empName(r.emp), value: r.score, color: scoreColor(r.score) }))

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiTile label="Best attendance" value={best ? empName(best.emp).split(' ')[0] : '—'} Icon={Award} tone="bg-emerald-50 text-emerald-500" delta={<span className="text-[11px] text-gray-400">{best ? `${best.score}% score` : 'No data yet'}</span>} />
        <KpiTile label="Most punctual" value={punct ? empName(punct.emp).split(' ')[0] : '—'} Icon={Target} tone="bg-sky-50 text-sky-500" delta={<span className="text-[11px] text-gray-400">{punct ? `${punct.punct}% on time` : 'No data yet'}</span>} />
        <KpiTile label="Average score" value={avg == null ? '—' : `${avg}%`} Icon={Activity} tone="bg-indigo-50 text-indigo-500" delta={<span className="text-[11px] text-gray-400">{perfect} with no late / absent</span>} />
        {canPay
          ? <KpiTile label={`Bonuses ${year}`} value={money(totalBonus)} Icon={Gift} tone="bg-amber-50 text-amber-500" delta={<span className="text-[11px] text-gray-400">{Object.values(bonusBy).filter(v => v > 0).length} employees received one</span>} />
          : <KpiTile label="Employees scored" value={rows.length} Icon={Users} tone="bg-amber-50 text-amber-500" delta={<span className="text-[11px] text-gray-400">with attendance in {year}</span>} />}
      </div>
      <div className="grid lg:grid-cols-12 gap-5">
        <Panel className="lg:col-span-5" title="Top 10" sub="Attendance score = attended ÷ (attended + absent)" Icon={Award}>
          <HBars rows={top10} max={100} valueLabel={v => `${v}%`} />
          <div className="flex flex-wrap gap-3 mt-4 text-[11px] text-gray-500">
            {[['90%+', '#10b981'], ['75–89%', '#2a78d6'], ['60–74%', '#f59e0b'], ['< 60%', '#f43f5e']].map(([l, c]) => <span key={l} className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: c }} />{l}</span>)}
          </div>
        </Panel>
        <section className="lg:col-span-7 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row gap-2.5">
            <SearchBox value={q} onChange={setQ} placeholder="Search employee…" />
            <div className="relative sm:w-48">
              <ArrowUpDown size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <select value={sort} onChange={e => setSort(e.target.value)} className="w-full pl-8 pr-3 py-2.5 text-sm rounded-xl border border-gray-200 bg-gray-50 text-gray-700 focus:outline-none">
                {Object.entries(P_SORTS).filter(([k]) => k !== 'bonus' || canPay).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}
              </select>
            </div>
          </div>
          <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
            <table className="w-full text-sm min-w-[600px]">
              <thead className="sticky top-0 bg-gray-50">
                <tr className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                  {['#', 'Employee', 'Score', 'On time', 'Late', 'Absent', ...(canPay ? ['Bonus'] : [])].map((h, i) => (
                    <th key={h} className={`px-4 py-2.5 ${i > 1 ? 'text-right' : 'text-left'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {shown.map((r, i) => (
                  <tr key={r.emp.id} className="hover:bg-gray-50/60">
                    <td className="px-4 py-2.5 text-xs font-bold text-gray-300">{i + 1}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2.5 min-w-[170px]">
                        <Avatar id={r.emp.id} name={empName(r.emp)} src={r.emp.avatar_url || null} size="w-8 h-8 text-[11px]" />
                        <div className="min-w-0"><p className="font-semibold text-gray-800 truncate">{empName(r.emp)}</p><p className="text-[11px] text-gray-400 truncate">{r.s.total} days recorded</p></div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 h-1.5 rounded-full bg-gray-100 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${r.score}%`, background: scoreColor(r.score) }} /></div>
                        <span className="text-xs font-bold text-gray-800 w-9 text-right tabular-nums">{r.score}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right text-gray-600 tabular-nums">{r.punct}%</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{r.s.late ? <span className="font-semibold text-amber-600">{r.s.late}</span> : <span className="text-gray-300">0</span>}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{r.s.absent ? <span className="font-semibold text-rose-600">{r.s.absent}</span> : <span className="text-gray-300">0</span>}</td>
                    {canPay && <td className="px-4 py-2.5 text-right tabular-nums">{r.bonus ? <span className="font-semibold text-emerald-600">{money(r.bonus)}</span> : <span className="text-gray-300">—</span>}</td>}
                  </tr>
                ))}
                {!shown.length && <tr><td colSpan={7} className="text-center text-sm text-gray-400 py-10">No attendance data for {year}</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  )
}

// ════════════════════════════════════════════════════════════════════════════════
export default function Analytics() {
  const { canAccessPayroll } = useAuth()
  const thisYear = new Date().getFullYear()
  const [tab,  setTab]  = useState(() => { try { return localStorage.getItem('analytics_tab') || 'workforce' } catch { return 'workforce' } })
  const [year, setYear] = useState(thisYear)
  const [employees, setEmployees] = useState([])
  const [att,       setAtt]       = useState([])
  const [payroll,   setPayroll]   = useState([])
  const [loading,   setLoading]   = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const reqId = useRef(0)

  async function load(soft = false) {
    const id = ++reqId.current
    soft ? setRefreshing(true) : setLoading(true)
    try {
      const [emps, a, p] = await Promise.all([
        db.getEmployees(),
        db.getAttendanceRange(`${year}-01-01`, `${year}-12-31`),
        canAccessPayroll ? db.getPayrollRecordsByYear(year) : Promise.resolve([]),
      ])
      if (id !== reqId.current) return
      setEmployees(emps); setAtt(a); setPayroll(p)
    } catch {}
    if (id === reqId.current) { setLoading(false); setRefreshing(false) }
  }
  useEffect(() => { load() }, [year, canAccessPayroll]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { try { localStorage.setItem('analytics_tab', tab) } catch {} }, [tab])

  const years = [thisYear, thisYear - 1, thisYear - 2]

  function exportCSV() {
    const active = employees.filter(e => e.status === 'active')
    if (tab === 'workforce') {
      downloadCSV(employees.map(e => ({ Name: empName(e), Status: e.status, Department: e.departments?.name ?? '', 'Job Title': e.job_title ?? '', 'Hire Date': e.hire_date ?? '' })), `workforce-${year}.csv`)
    } else if (tab === 'attendance') {
      const ids = new Set(active.map(e => e.id))
      downloadCSV(MONTHS.map((m, i) => {
        const s = summarize(att.filter(r => ids.has(r.employee_id) && Number(r.date.slice(5, 7)) === i + 1))
        return { Month: `${m} ${year}`, Records: s.total, Present: s.present, Late: s.late, 'Half Day': s.half_day, Absent: s.absent, Holiday: s.holiday, 'Attendance %': s.rate ?? '', 'On-time %': s.onTime ?? '' }
      }), `attendance-analytics-${year}.csv`)
    } else {
      downloadCSV(active.map(e => {
        const s = summarize(att.filter(r => r.employee_id === e.id))
        return { Employee: empName(e), Department: e.departments?.name ?? '', Days: s.total, 'Score %': s.rate ?? '', 'On-time %': s.onTime ?? '', Late: s.late, Absent: s.absent }
      }).filter(r => r.Days > 0), `performance-${year}.csv`)
    }
  }

  return (
    <div className="space-y-5 pb-10">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight">Analytics · {year}</h2>
          <p className="text-sm text-gray-400 mt-1">Workforce, attendance and performance insights</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 p-1 bg-white border border-gray-200 rounded-xl shadow-sm">
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors ${tab === t.id ? 'bg-[#1e3a8a] text-white shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}>
                <t.Icon size={14} /> {t.label}
              </button>
            ))}
          </div>
          <select value={year} onChange={e => setYear(Number(e.target.value))}
            className="px-3 py-2.5 text-sm font-semibold rounded-xl border border-gray-200 bg-white shadow-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/20">
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button onClick={exportCSV} title="Export CSV" className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-sm font-semibold bg-white border border-gray-200 shadow-sm text-gray-600 hover:bg-gray-50"><Download size={15} /> <span className="hidden sm:inline">Export</span></button>
          <button onClick={() => window.print()} title="Print / PDF" className="w-10 h-10 rounded-xl flex items-center justify-center bg-white border border-gray-200 shadow-sm text-gray-500 hover:bg-gray-50"><Printer size={15} /></button>
          <button onClick={() => load(true)} title="Refresh" className="w-10 h-10 rounded-xl flex items-center justify-center bg-white border border-gray-200 shadow-sm text-gray-500 hover:bg-gray-50"><RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} /></button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">{[0, 1, 2, 3].map(i => <div key={i} className="h-32 bg-white rounded-2xl border border-gray-100 shimmer" />)}</div>
          <div className="grid lg:grid-cols-2 gap-5">{[0, 1].map(i => <div key={i} className="h-72 bg-white rounded-2xl border border-gray-100 shimmer" />)}</div>
        </div>
      ) : tab === 'workforce' ? (
        <WorkforceTab employees={employees} year={year} />
      ) : tab === 'attendance' ? (
        <AttendanceTab employees={employees} att={att} year={year} />
      ) : (
        <PerformanceTab employees={employees} att={att.filter(r => employees.some(e => e.id === r.employee_id))} payroll={payroll} canPay={canAccessPayroll} year={year} />
      )}
    </div>
  )
}
