import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { Activity, Clock, UserX, TrendingUp, Loader2 } from 'lucide-react'
import {
  BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts'

// ── constants ──────────────────────────────────────────────────────────────────
const DAY_ABBR   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const STD_END_MINS = 17 * 60    // standard checkout 17:00

// ── helpers ────────────────────────────────────────────────────────────────────
function pad2(n) { return String(n).padStart(2, '0') }
function toISO(d) { return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}` }
function addDays(d, n) { const r = new Date(d); r.setDate(r.getDate() + n); return r }

// ── KPI card ───────────────────────────────────────────────────────────────────
function KpiCard({ label, value, Icon, iconBg, iconColor }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm text-gray-500 font-medium leading-snug">{label}</p>
        <p className="text-3xl font-extrabold text-gray-900 mt-1 tracking-tight truncate">{value}</p>
      </div>
      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${iconBg}`}>
        <Icon size={26} className={iconColor} />
      </div>
    </div>
  )
}

// ── custom tooltip ─────────────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label, suffix = '' }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-lg px-3.5 py-2.5 text-xs">
      <p className="font-semibold text-gray-700 mb-1.5">{label}</p>
      {payload.map(p => (
        <p key={p.dataKey} style={{ color: p.color }} className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full inline-block" style={{ background: p.color }} />
          {p.name}: <span className="font-bold">{p.value}{suffix}</span>
        </p>
      ))}
    </div>
  )
}

// ── main component ─────────────────────────────────────────────────────────────
export default function AttendanceReports() {
  const [loading,    setLoading]    = useState(true)
  const [monthRows,  setMonthRows]  = useState([])
  const [weekRows,   setWeekRows]   = useState([])
  const [yearRows,   setYearRows]   = useState([])

  const today = useMemo(() => new Date(), [])

  useEffect(() => {
    async function load() {
      setLoading(true)
      const yr  = today.getFullYear()
      const mo  = today.getMonth()

      const monthStart = toISO(new Date(yr, mo, 1))
      const monthEnd   = toISO(new Date(yr, mo + 1, 0))
      const weekStart  = toISO(addDays(today, -6))
      const weekEnd    = toISO(today)
      const yearStart  = `${yr}-01-01`
      const yearEnd    = `${yr}-12-31`

      const [r1, r2, r3] = await Promise.all([
        supabase.from('attendance').select('status, clock_in, clock_out, date')
          .gte('date', monthStart).lte('date', monthEnd),
        supabase.from('attendance').select('date, status')
          .gte('date', weekStart).lte('date', weekEnd),
        supabase.from('attendance').select('date, status')
          .gte('date', yearStart).lte('date', yearEnd),
      ])

      setMonthRows(r1.data ?? [])
      setWeekRows(r2.data  ?? [])
      setYearRows(r3.data  ?? [])
      setLoading(false)
    }
    load()
  }, [today])

  // ── KPI computations ─────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const total   = monthRows.length
    const present = monthRows.filter(r => r.status === 'present').length
    const late    = monthRows.filter(r => r.status === 'late').length
    const absent  = monthRows.filter(r => r.status === 'absent').length

    const rate = total > 0
      ? (((present + late) / total) * 100).toFixed(1)
      : '0.0'

    let overtimeMins = 0
    monthRows.forEach(r => {
      if (!r.clock_out) return
      const [h, m] = r.clock_out.split(':').map(Number)
      const mins = h * 60 + m
      if (mins > STD_END_MINS) overtimeMins += mins - STD_END_MINS
    })

    return {
      rate,
      late,
      absent,
      overtime: (overtimeMins / 60).toFixed(1),
    }
  }, [monthRows])

  // ── Weekly chart data (trailing 7 days) ───────────────────────────────────
  const weekChartData = useMemo(() => {
    const slots = Array.from({ length: 7 }, (_, i) => {
      const d = addDays(today, i - 6)
      return { date: toISO(d), day: DAY_ABBR[d.getDay()], present: 0, late: 0, absent: 0 }
    })
    const byDate = Object.fromEntries(slots.map(s => [s.date, s]))
    weekRows.forEach(r => {
      const s = byDate[r.date]
      if (!s) return
      if      (r.status === 'present') s.present++
      else if (r.status === 'late')    s.late++
      else if (r.status === 'absent')  s.absent++
    })
    return slots
  }, [weekRows, today])

  // ── Monthly chart data (Jan–Dec) ──────────────────────────────────────────
  const monthChartData = useMemo(() => {
    const slots = MONTH_ABBR.map(name => ({
      month: name, total: 0, present: 0, late: 0, rate: 0,
    }))
    yearRows.forEach(r => {
      const mi = parseInt(r.date.slice(5, 7), 10) - 1
      slots[mi].total++
      if (r.status === 'present') slots[mi].present++
      if (r.status === 'late')    slots[mi].late++
    })
    slots.forEach(s => {
      s.rate = s.total > 0 ? Math.round(((s.present + s.late) / s.total) * 100) : 0
    })
    return slots
  }, [yearRows])

  // ── render ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-32 gap-3 text-gray-400">
        <Loader2 size={24} className="animate-spin text-blue-500" />
        <span className="text-sm">Loading analytics…</span>
      </div>
    )
  }

  return (
    <div className="space-y-5">

      {/* ── KPI cards ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Avg Attendance Rate"
          value={`${kpis.rate}%`}
          Icon={Activity}
          iconBg="bg-indigo-50"
          iconColor="text-indigo-500"
        />
        <KpiCard
          label="Total Late Arrivals"
          value={kpis.late}
          Icon={Clock}
          iconBg="bg-amber-50"
          iconColor="text-amber-500"
        />
        <KpiCard
          label="Total Absences"
          value={kpis.absent}
          Icon={UserX}
          iconBg="bg-red-50"
          iconColor="text-red-500"
        />
        <KpiCard
          label="Overtime Hours"
          value={`${kpis.overtime}h`}
          Icon={TrendingUp}
          iconBg="bg-purple-50"
          iconColor="text-purple-500"
        />
      </div>

      {/* ── Charts row ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Weekly Breakdown — stacked bar chart */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="mb-5">
            <h3 className="text-base font-bold text-gray-900">Weekly Attendance Breakdown</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              Trailing 7 days — Present, Late, and Absent distribution
            </p>
          </div>

          <ResponsiveContainer width="100%" height={260}>
            <BarChart
              data={weekChartData}
              margin={{ top: 4, right: 4, left: -22, bottom: 0 }}
              barCategoryGap="38%"
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis
                dataKey="day"
                tick={{ fontSize: 12, fill: '#94a3b8' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 12, fill: '#94a3b8' }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip
                content={<ChartTooltip />}
                cursor={{ fill: '#f8fafc', radius: 6 }}
              />
              <Legend
                iconType="square"
                iconSize={9}
                wrapperStyle={{ fontSize: 12, paddingTop: 18 }}
                formatter={v => (
                  <span style={{ color: '#64748b' }}>
                    {v.charAt(0).toUpperCase() + v.slice(1)}
                  </span>
                )}
              />
              {/* Stacked: bottom=absent, mid=late, top=present */}
              <Bar
                dataKey="absent"
                name="Absent"
                stackId="s"
                fill="#ef4444"
                radius={[0, 0, 0, 0]}
              />
              <Bar
                dataKey="late"
                name="Late"
                stackId="s"
                fill="#f59e0b"
                radius={[0, 0, 0, 0]}
              />
              <Bar
                dataKey="present"
                name="Present"
                stackId="s"
                fill="#10b981"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Monthly Attendance Rate — smooth area chart */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="mb-5">
            <h3 className="text-base font-bold text-gray-900">Monthly Attendance Rate</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              {today.getFullYear()} — % attendance by month
            </p>
          </div>

          <ResponsiveContainer width="100%" height={260}>
            <AreaChart
              data={monthChartData}
              margin={{ top: 4, right: 4, left: -22, bottom: 0 }}
            >
              <defs>
                <linearGradient id="rateGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#818cf8" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#818cf8" stopOpacity={0}    />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 12, fill: '#94a3b8' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 12, fill: '#94a3b8' }}
                axisLine={false}
                tickLine={false}
                domain={[0, 100]}
                ticks={[0, 25, 50, 75, 100]}
                tickFormatter={v => `${v}%`}
              />
              <Tooltip
                content={<ChartTooltip suffix="%" />}
                cursor={{ stroke: '#c7d2fe', strokeWidth: 1.5, strokeDasharray: '4 2' }}
              />
              <Area
                type="monotone"
                dataKey="rate"
                name="Attendance"
                stroke="#818cf8"
                strokeWidth={2.5}
                fill="url(#rateGrad)"
                dot={{
                  r: 4,
                  fill: '#818cf8',
                  stroke: '#ffffff',
                  strokeWidth: 2,
                }}
                activeDot={{
                  r: 6,
                  fill: '#6366f1',
                  stroke: '#ffffff',
                  strokeWidth: 2,
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
