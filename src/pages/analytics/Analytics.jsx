import { useState, useEffect, useMemo } from 'react'
import { getEmployees, getAttendanceRange, getPayrollRecordsByYear } from '../../lib/db'
import {
  Users, UserCheck, Star, TrendingUp, Activity,
  FileText, Table, Loader2, Clock, UserX,
  Award, Target, Zap,
} from 'lucide-react'
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, Cell,
} from 'recharts'

// ── Constants ──────────────────────────────────────────────────────────────────
const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const DAY_LABELS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
// Day index: JS getDay() gives 0=Sun … 6=Sat; remap to Mon-first
const JS_DAY_TO_MON_FIRST = [6,0,1,2,3,4,5] // Mon=0 … Sun=6

const fmt$ = n =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n ?? 0)

// ── CSV helper ─────────────────────────────────────────────────────────────────
function downloadCSV(rows, filename) {
  if (!rows.length) return
  const keys = Object.keys(rows[0])
  const csv = [
    keys.join(','),
    ...rows.map(r => keys.map(k => JSON.stringify(r[k] ?? '')).join(',')),
  ].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url  = URL.createObjectURL(blob)
  const a    = Object.assign(document.createElement('a'), { href: url, download: filename })
  document.body.appendChild(a); a.click(); document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ── Tabs ───────────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'employee',    label: 'Employee',    Icon: Users     },
  { id: 'attendance',  label: 'Attendance',  Icon: UserCheck },
  { id: 'performance', label: 'Performance', Icon: Star      },
]

// ── Sub-components ─────────────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label, suffix = '', prefix = '' }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-lg px-3.5 py-2.5 text-xs">
      <p className="font-semibold text-gray-500 mb-1.5">{label}</p>
      {payload.map(p => (
        <p key={p.dataKey ?? p.name} className="flex items-center gap-1.5" style={{ color: p.color ?? p.fill }}>
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color ?? p.fill }} />
          {p.name}: <span className="font-bold ml-0.5">{prefix}{p.value}{suffix}</span>
        </p>
      ))}
    </div>
  )
}

function KpiCard({ label, value, sub, Icon, iconBg, iconColor }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-xs text-gray-500 font-medium">{label}</p>
        <p className="text-2xl font-extrabold text-gray-900 mt-1 tracking-tight truncate">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${iconBg}`}>
        <Icon size={22} className={iconColor} />
      </div>
    </div>
  )
}

function ChartCard({ title, subtitle, badge, badgeBg, children }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      <div className="flex items-start justify-between mb-5">
        <div>
          <h3 className="text-base font-bold text-gray-900">{title}</h3>
          <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>
        </div>
        {badge && (
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${badgeBg}`}>
            {badge}
          </div>
        )}
      </div>
      {children}
    </div>
  )
}

function EmptyChart({ height = 220, message = 'No data yet' }) {
  return (
    <div className={`flex items-center justify-center text-sm text-gray-300`} style={{ height }}>
      {message}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════════
// EMPLOYEE TAB
// ════════════════════════════════════════════════════════════════════════════════
function EmployeeTab({ employees }) {
  const now = new Date()

  const monthlyData = useMemo(() => {
    const result = []
    for (let i = 8; i >= 0; i--) {
      const d          = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const endOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59)
      result.push({
        month: d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        count: employees.filter(e => e.hire_date && new Date(e.hire_date) <= endOfMonth).length,
      })
    }
    return result
  }, [employees]) // eslint-disable-line

  const deptData = useMemo(() => {
    const map = {}
    employees.filter(e => e.status === 'active').forEach(e => {
      const dept = e.departments?.name ?? 'Unassigned'
      map[dept] = (map[dept] ?? 0) + 1
    })
    return Object.entries(map)
      .map(([dept, count]) => ({ dept, count }))
      .sort((a, b) => b.count - a.count)
  }, [employees])

  const totalActive = employees.filter(e => e.status === 'active').length

  return (
    <>
      {/* Mini stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Total Employees', value: employees.length, cls: 'text-indigo-600', bg: 'bg-indigo-50' },
          { label: 'Active Staff',    value: totalActive,      cls: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Departments',     value: deptData.length,  cls: 'text-purple-600',  bg: 'bg-purple-50' },
        ].map(({ label, value, cls, bg }) => (
          <div key={label} className={`${bg} rounded-2xl border border-gray-100 px-5 py-4`}>
            <p className="text-xs font-medium text-gray-500">{label}</p>
            <p className={`text-3xl font-extrabold mt-1 ${cls}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Monthly Headcount — teal smooth line */}
        <ChartCard
          title="Monthly Headcount"
          subtitle="Growth trajectory"
          badgeBg="bg-blue-50"
          badge={<TrendingUp size={20} className="text-blue-500" />}
        >
          {monthlyData.every(d => d.count === 0)
            ? <EmptyChart />
            : (
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={monthlyData} margin={{ top: 6, right: 6, left: -22, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTooltip />} cursor={{ stroke: '#00bfa5', strokeWidth: 1, strokeDasharray: '4 2' }} />
                  <Line
                    type="monotone" dataKey="count" name="Employees"
                    stroke="#00bfa5" strokeWidth={2.5}
                    dot={{ fill: '#00bfa5', r: 5, stroke: '#fff', strokeWidth: 2.5 }}
                    activeDot={{ r: 7, fill: '#00bfa5', stroke: '#fff', strokeWidth: 2.5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
        </ChartCard>

        {/* Dept Headcount — blue bars */}
        <ChartCard
          title="Dept Headcount"
          subtitle="Current distribution"
          badgeBg="bg-purple-50"
          badge={<Users size={20} className="text-purple-500" />}
        >
          {deptData.length === 0
            ? <EmptyChart />
            : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={deptData} margin={{ top: 6, right: 6, left: -22, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="dept" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: '#f8fafc' }} />
                  <Bar dataKey="count" name="Employees" fill="#1e3a8a" radius={[4, 4, 0, 0]} maxBarSize={52} />
                </BarChart>
              </ResponsiveContainer>
            )}
        </ChartCard>
      </div>
    </>
  )
}

// ════════════════════════════════════════════════════════════════════════════════
// ATTENDANCE TAB
// ════════════════════════════════════════════════════════════════════════════════
function AttendanceTab({ attYear, attMonth }) {
  const yr = new Date().getFullYear()

  // ── KPIs from this-month data ──
  const kpis = useMemo(() => {
    const total   = attMonth.length
    const present = attMonth.filter(r => r.status === 'present').length
    const late    = attMonth.filter(r => r.status === 'late').length
    const absent  = attMonth.filter(r => r.status === 'absent').length
    const rate    = total > 0 ? (((present + late) / total) * 100).toFixed(1) : '0.0'
    const onTime  = total > 0 ? ((present / total) * 100).toFixed(1) : '0.0'
    return { total, present, late, absent, rate, onTime }
  }, [attMonth])

  // ── Monthly late & absence trend (Jan–Dec) ──
  const monthlyTrend = useMemo(() =>
    MONTH_ABBR.map((month, i) => {
      const rows = attYear.filter(r => parseInt(r.date.slice(5, 7), 10) - 1 === i)
      return {
        month,
        Late:   rows.filter(r => r.status === 'late').length,
        Absent: rows.filter(r => r.status === 'absent').length,
      }
    }),
  [attYear])

  // ── Dept breakdown for THIS year ──
  // (uses empDeptMap passed in via closure)
  const dayPattern = useMemo(() => {
    const slots = DAY_LABELS.map(day => ({ day, Present: 0, Late: 0, Absent: 0 }))
    attYear.forEach(r => {
      const jsDay  = new Date(r.date + 'T00:00:00').getDay()
      const idx    = JS_DAY_TO_MON_FIRST[jsDay]
      const s      = slots[idx]
      if (!s) return
      if (r.status === 'present') s.Present++
      else if (r.status === 'late')    s.Late++
      else if (r.status === 'absent')  s.Absent++
    })
    return slots
  }, [attYear])

  const hasMonth = attMonth.length > 0
  const hasYear  = attYear.length  > 0

  return (
    <>
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Attendance Rate"  value={`${kpis.rate}%`}    sub="present + late / total"       Icon={Activity} iconBg="bg-indigo-50"  iconColor="text-indigo-500" />
        <KpiCard label="On-Time Rate"     value={`${kpis.onTime}%`}  sub="present only this month"      Icon={Zap}      iconBg="bg-emerald-50" iconColor="text-emerald-500" />
        <KpiCard label="Late Arrivals"    value={kpis.late}          sub={`this month (${MONTH_ABBR[new Date().getMonth()]})`} Icon={Clock}    iconBg="bg-amber-50"   iconColor="text-amber-500" />
        <KpiCard label="Absences"         value={kpis.absent}        sub={`this month (${MONTH_ABBR[new Date().getMonth()]})`} Icon={UserX}    iconBg="bg-red-50"     iconColor="text-red-500" />
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Late & Absence trend — dual area */}
        <ChartCard
          title="Late Arrivals & Absences"
          subtitle={`Monthly trend — ${yr}`}
          badgeBg="bg-amber-50"
          badge={<Clock size={20} className="text-amber-500" />}
        >
          {!hasYear ? <EmptyChart /> : (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={monthlyTrend} margin={{ top: 6, right: 6, left: -22, bottom: 0 }}>
                <defs>
                  <linearGradient id="lateGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#f59e0b" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}    />
                  </linearGradient>
                  <linearGradient id="absentGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#ef4444" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0}   />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Legend iconType="circle" iconSize={8}
                  wrapperStyle={{ fontSize: 11, paddingTop: 14 }}
                  formatter={v => <span style={{ color: '#64748b' }}>{v}</span>}
                />
                <Area type="monotone" dataKey="Late"   stroke="#f59e0b" strokeWidth={2} fill="url(#lateGrad)"
                  dot={{ r: 4, fill: '#f59e0b', stroke: '#fff', strokeWidth: 2 }}
                  activeDot={{ r: 6, stroke: '#fff', strokeWidth: 2 }} />
                <Area type="monotone" dataKey="Absent" stroke="#ef4444" strokeWidth={2} fill="url(#absentGrad)"
                  dot={{ r: 4, fill: '#ef4444', stroke: '#fff', strokeWidth: 2 }}
                  activeDot={{ r: 6, stroke: '#fff', strokeWidth: 2 }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Day of week pattern — stacked bar */}
        <ChartCard
          title="Attendance by Day of Week"
          subtitle={`${yr} — which days have the most absences`}
          badgeBg="bg-rose-50"
          badge={<UserX size={20} className="text-rose-500" />}
        >
          {!hasYear ? <EmptyChart /> : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={dayPattern} margin={{ top: 6, right: 6, left: -22, bottom: 0 }} barCategoryGap="35%">
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: '#f8fafc' }} />
                <Legend iconType="square" iconSize={8}
                  wrapperStyle={{ fontSize: 11, paddingTop: 14 }}
                  formatter={v => <span style={{ color: '#64748b' }}>{v}</span>}
                />
                <Bar dataKey="Absent"  stackId="s" fill="#ef4444" radius={[0,0,0,0]} />
                <Bar dataKey="Late"    stackId="s" fill="#f59e0b" radius={[0,0,0,0]} />
                <Bar dataKey="Present" stackId="s" fill="#10b981" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* Summary stats row */}
      {hasMonth && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h3 className="text-sm font-bold text-gray-800 mb-4">This Month at a Glance</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Marked Records', value: kpis.total,   bar: 100,  color: 'bg-indigo-500' },
              { label: 'Present',        value: kpis.present, bar: kpis.total > 0 ? Math.round(kpis.present / kpis.total * 100) : 0, color: 'bg-emerald-500' },
              { label: 'Late',           value: kpis.late,    bar: kpis.total > 0 ? Math.round(kpis.late    / kpis.total * 100) : 0, color: 'bg-amber-400'  },
              { label: 'Absent',         value: kpis.absent,  bar: kpis.total > 0 ? Math.round(kpis.absent  / kpis.total * 100) : 0, color: 'bg-red-400'    },
            ].map(({ label, value, bar, color }) => (
              <div key={label}>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="text-gray-500 font-medium">{label}</span>
                  <span className="font-bold text-gray-900">{value}</span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${bar}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}

// ════════════════════════════════════════════════════════════════════════════════
// PERFORMANCE TAB
// ════════════════════════════════════════════════════════════════════════════════
function PerformanceTab({ employees, attYear, bonusRows }) {
  const yr = new Date().getFullYear()

  // Map employee_id → full name
  const empMap = useMemo(() => {
    const m = {}
    employees.forEach(e => { m[e.id] = `${e.first_name} ${e.last_name}` })
    return m
  }, [employees])

  // Per-employee attendance stats
  const empScores = useMemo(() => {
    const map = {}
    attYear.forEach(r => {
      const name = empMap[r.employee_id] ?? r.employee_id
      if (!map[name]) map[name] = { name, total: 0, present: 0, late: 0, absent: 0 }
      map[name].total++
      if      (r.status === 'present') map[name].present++
      else if (r.status === 'late')    map[name].late++
      else if (r.status === 'absent')  map[name].absent++
    })
    return Object.values(map).map(e => ({
      ...e,
      shortName:   e.name.split(' ')[0],
      score:       e.total > 0 ? Math.round(((e.present + e.late) / e.total) * 100) : 0,
      punctuality: e.total > 0 ? Math.round((e.present / e.total) * 100) : 0,
    })).sort((a, b) => b.score - a.score)
  }, [attYear, empMap])

  // Per-employee bonus totals
  const bonusData = useMemo(() => {
    const map = {}
    bonusRows.forEach(r => {
      const name = r.employee_salary_config?.employee_name ?? empMap[r.employee_id] ?? r.employee_id
      const firstName = name.split(' ')[0]
      map[firstName] = (map[firstName] ?? 0) + Number(r.bonus || 0)
    })
    return Object.entries(map)
      .map(([name, bonus]) => ({ name, bonus }))
      .sort((a, b) => b.bonus - a.bonus)
  }, [bonusRows, empMap])

  // KPI derivations
  const best      = empScores[0]
  const topPunct  = [...empScores].sort((a, b) => b.punctuality - a.punctuality)[0]
  const avgScore  = empScores.length > 0
    ? Math.round(empScores.reduce((s, e) => s + e.score, 0) / empScores.length)
    : 0
  const totalBonus = bonusRows.reduce((s, r) => s + Number(r.bonus || 0), 0)

  const hasAtt   = attYear.length > 0
  const hasBonus = bonusData.some(d => d.bonus > 0)

  // Color for score bar
  const scoreColor = pct => pct >= 80 ? '#10b981' : pct >= 60 ? '#f59e0b' : '#ef4444'

  return (
    <>
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Best Attendance"
          value={best?.shortName ?? '—'}
          sub={best ? `${best.score}% score` : 'No data yet'}
          Icon={Award} iconBg="bg-emerald-50" iconColor="text-emerald-500"
        />
        <KpiCard
          label="Most Punctual"
          value={topPunct?.shortName ?? '—'}
          sub={topPunct ? `${topPunct.punctuality}% on-time` : 'No data yet'}
          Icon={Target} iconBg="bg-blue-50" iconColor="text-blue-500"
        />
        <KpiCard
          label="Avg Attendance Score"
          value={`${avgScore}%`}
          sub={`across ${empScores.length} employee${empScores.length !== 1 ? 's' : ''}`}
          Icon={Activity} iconBg="bg-purple-50" iconColor="text-purple-500"
        />
        <KpiCard
          label={`Total Bonus (${yr})`}
          value={fmt$(totalBonus)}
          sub="all payroll records"
          Icon={Zap} iconBg="bg-amber-50" iconColor="text-amber-500"
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Employee Attendance Score — horizontal bar */}
        <ChartCard
          title="Attendance Score by Employee"
          subtitle={`${yr} — present + late days / total marked`}
          badgeBg="bg-indigo-50"
          badge={<Activity size={20} className="text-indigo-500" />}
        >
          {!hasAtt ? <EmptyChart /> : (
            <ResponsiveContainer width="100%" height={Math.max(220, empScores.length * 60)}>
              <BarChart
                layout="vertical"
                data={empScores.map(e => ({ ...e, name: e.shortName }))}
                margin={{ top: 4, right: 30, left: 10, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: '#94a3b8' }}
                  axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: '#374151', fontWeight: 600 }}
                  axisLine={false} tickLine={false} width={60} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null
                    const d = payload[0].payload
                    return (
                      <div className="bg-white border border-gray-100 rounded-xl shadow-lg px-3.5 py-2.5 text-xs">
                        <p className="font-bold text-gray-800 mb-1">{d.name}</p>
                        <p className="text-gray-600">Score: <span className="font-bold text-gray-900">{d.score}%</span></p>
                        <p className="text-gray-600">Punctuality: <span className="font-bold text-blue-600">{d.punctuality}%</span></p>
                        <p className="text-gray-600">Late: <span className="font-bold text-amber-600">{d.late}</span></p>
                        <p className="text-gray-600">Absent: <span className="font-bold text-red-600">{d.absent}</span></p>
                      </div>
                    )
                  }}
                />
                <Bar dataKey="score" name="Score" radius={[0, 4, 4, 0]} maxBarSize={28}>
                  {empScores.map((e, i) => (
                    <Cell key={`cell-${i}`} fill={scoreColor(e.score)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Bonus Distribution — vertical bar */}
        <ChartCard
          title="Bonus Distribution"
          subtitle={`${yr} — total bonus from payroll records`}
          badgeBg="bg-amber-50"
          badge={<Zap size={20} className="text-amber-500" />}
        >
          {!hasBonus ? <EmptyChart message="No bonus data in payroll records yet" /> : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={bonusData} margin={{ top: 6, right: 6, left: -5, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#374151', fontWeight: 600 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false}
                  tickFormatter={v => v === 0 ? '$0' : `$${(v/1000).toFixed(0)}k`} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null
                    return (
                      <div className="bg-white border border-gray-100 rounded-xl shadow-lg px-3.5 py-2.5 text-xs">
                        <p className="font-bold text-gray-800 mb-1">{label}</p>
                        <p className="text-amber-600 font-bold">{fmt$(payload[0].value)}</p>
                      </div>
                    )
                  }}
                />
                <Bar dataKey="bonus" name="Bonus" fill="#f59e0b" radius={[4,4,0,0]} maxBarSize={56} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* Employee scorecard table */}
      {empScores.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="text-sm font-bold text-gray-800">Employee Performance Scorecard — {yr}</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-50 bg-gray-50/60">
                  {['#','Employee','Attendance Score','Punctuality','Late Days','Absent Days','Bonus Earned'].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {empScores.map((e, i) => {
                  const bonus = bonusData.find(b => b.name === e.shortName)?.bonus ?? 0
                  const barW  = `${e.score}%`
                  return (
                    <tr key={e.name} className="hover:bg-gray-50/40 transition-colors">
                      <td className="px-5 py-4 text-gray-400 font-medium text-xs">{i + 1}</td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                            <span className="text-xs font-bold text-indigo-600">
                              {e.name.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase()}
                            </span>
                          </div>
                          <p className="font-semibold text-gray-800">{e.name}</p>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-gray-100 rounded-full h-1.5 w-20">
                            <div className="h-1.5 rounded-full transition-all" style={{ width: barW, background: scoreColor(e.score) }} />
                          </div>
                          <span className="text-xs font-bold" style={{ color: scoreColor(e.score) }}>{e.score}%</span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-xs font-semibold text-blue-600">{e.punctuality}%</span>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`text-xs font-semibold ${e.late > 0 ? 'text-amber-600' : 'text-gray-400'}`}>{e.late}</span>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`text-xs font-semibold ${e.absent > 0 ? 'text-red-500' : 'text-gray-400'}`}>{e.absent}</span>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`text-xs font-semibold ${bonus > 0 ? 'text-emerald-600' : 'text-gray-300'}`}>{fmt$(bonus)}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  )
}

// ════════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ════════════════════════════════════════════════════════════════════════════════
export default function Analytics() {
  const [activeTab, setActiveTab] = useState('employee')
  const [loading,   setLoading]   = useState(true)

  // ── Shared data ──
  const [employees, setEmployees] = useState([])
  const [attYear,   setAttYear]   = useState([])
  const [attMonth,  setAttMonth]  = useState([])
  const [bonusRows, setBonusRows] = useState([])

  useEffect(() => {
    async function loadAll() {
      setLoading(true)
      const now = new Date()
      const yr  = now.getFullYear()
      const mo  = now.getMonth()
      const pad = n => String(n).padStart(2, '0')
      const monthStart = `${yr}-${pad(mo + 1)}-01`
      const monthEnd   = `${yr}-${pad(mo + 1)}-${pad(new Date(yr, mo + 1, 0).getDate())}`

      const [r1, r2, r3, r4] = await Promise.all([
        getEmployees(),
        getAttendanceRange(`${yr}-01-01`, `${yr}-12-31`),
        getAttendanceRange(monthStart, monthEnd),
        getPayrollRecordsByYear(yr),
      ])

      r1.sort((a, b) => (a.created_at ?? '').localeCompare(b.created_at ?? ''))
      setEmployees(r1)
      setAttYear(r2)
      setAttMonth(r3)
      setBonusRows(r4)
      setLoading(false)
    }
    loadAll()
  }, [])

  // ── Export ──
  function exportPDF() { window.print() }

  function exportExcel() {
    const yr = new Date().getFullYear()
    if (activeTab === 'employee') {
      downloadCSV(
        employees.map(e => ({
          Name:       `${e.first_name} ${e.last_name}`,
          Status:     e.status,
          Department: e.departments?.name ?? '',
          Joined:     e.created_at?.slice(0, 10) ?? '',
        })),
        `employee-analytics-${yr}.csv`,
      )
    } else if (activeTab === 'attendance') {
      downloadCSV(
        MONTH_ABBR.map((month, i) => {
          const rows = attYear.filter(r => parseInt(r.date.slice(5, 7), 10) - 1 === i)
          return {
            Month:  month,
            Total:  rows.length,
            Present: rows.filter(r => r.status === 'present').length,
            Late:    rows.filter(r => r.status === 'late').length,
            Absent:  rows.filter(r => r.status === 'absent').length,
          }
        }),
        `attendance-analytics-${yr}.csv`,
      )
    } else {
      const empMap = {}
      employees.forEach(e => { empMap[e.id] = `${e.first_name} ${e.last_name}` })
      const map = {}
      attYear.forEach(r => {
        const name = empMap[r.employee_id] ?? r.employee_id
        if (!map[name]) map[name] = { total: 0, present: 0, late: 0, absent: 0 }
        map[name].total++
        if      (r.status === 'present') map[name].present++
        else if (r.status === 'late')    map[name].late++
        else if (r.status === 'absent')  map[name].absent++
      })
      downloadCSV(
        Object.entries(map).map(([name, d]) => ({
          Employee:        name,
          Score:           d.total > 0 ? Math.round(((d.present + d.late) / d.total) * 100) : 0,
          Punctuality:     d.total > 0 ? Math.round((d.present / d.total) * 100) : 0,
          'Late Days':     d.late,
          'Absent Days':   d.absent,
          'Total Marked':  d.total,
        })),
        `performance-analytics-${yr}.csv`,
      )
    }
  }

  return (
    <div className="space-y-5">

      {/* ── Action bar ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">

        {/* Pill tabs */}
        <div className="inline-flex items-center bg-gray-100 rounded-full p-1 gap-0.5">
          {TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all duration-200
                ${activeTab === id
                  ? 'bg-[#1e3a8a] text-white shadow-md'
                  : 'text-gray-500 hover:text-gray-700'
                }`}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>

        {/* Export buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={exportPDF}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold
              bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 transition-colors">
            <FileText size={14} className="text-red-500" /> PDF
          </button>
          <button onClick={exportExcel}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold
              bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors">
            <Table size={14} className="text-emerald-600" /> Excel
          </button>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex items-center justify-center gap-3 py-24 text-gray-400">
          <Loader2 size={22} className="animate-spin text-blue-500" />
          <span className="text-sm">Loading analytics…</span>
        </div>
      )}

      {/* Tabs */}
      {!loading && activeTab === 'employee' && (
        <EmployeeTab employees={employees} />
      )}
      {!loading && activeTab === 'attendance' && (
        <AttendanceTab attYear={attYear} attMonth={attMonth} />
      )}
      {!loading && activeTab === 'performance' && (
        <PerformanceTab employees={employees} attYear={attYear} bonusRows={bonusRows} />
      )}
    </div>
  )
}
