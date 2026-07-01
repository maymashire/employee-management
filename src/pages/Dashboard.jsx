import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { Users, Building2, Clock, DollarSign, ArrowRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts'

// ─── constants ────────────────────────────────────────────────────────────────

const DEPT_COLORS = ['#1e3a8a', '#2563eb', '#3b82f6', '#60a5fa', '#34d399', '#a78bfa']

const fmtCurrency = n =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)

const fmtDate = iso =>
  iso
    ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '—'

function last12Months() {
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date()
    d.setDate(1)
    d.setMonth(d.getMonth() - (11 - i))
    return {
      label:   d.toLocaleString('default', { month: 'short', year: '2-digit' }),
      endDate: new Date(d.getFullYear(), d.getMonth() + 1, 0),
    }
  })
}

// ─── sub-components ───────────────────────────────────────────────────────────

function StatCard({ label, value, sub, icon: Icon, iconBg, iconColor, accent }) {
  return (
    <div className={`bg-white rounded-xl p-5 shadow-sm border border-gray-100 border-l-4 ${accent}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500 font-medium">{label}</p>
          <p className="text-3xl font-bold text-gray-800 mt-1 tracking-tight">{value}</p>
          {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
        </div>
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
          <Icon size={20} className={iconColor} />
        </div>
      </div>
    </div>
  )
}

function SectionHeader({ title, linkTo }) {
  const navigate = useNavigate()
  return (
    <div className="flex items-center justify-between mb-4">
      <h3 className="font-semibold text-gray-800">{title}</h3>
      {linkTo && (
        <button
          onClick={() => navigate(linkTo)}
          className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors"
        >
          View all <ArrowRight size={13} />
        </button>
      )}
    </div>
  )
}

// Custom tooltip for the area chart
function HeadcountTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-xs">
      <p className="font-semibold text-gray-700 mb-0.5">{label}</p>
      <p className="text-blue-600">{payload[0].value} employees</p>
    </div>
  )
}

// Custom label for pie chart
function PieLabel({ cx, cy, midAngle, outerRadius, percent }) {
  if (percent < 0.06) return null
  const RADIAN = Math.PI / 180
  const radius = outerRadius + 18
  const x = cx + radius * Math.cos(-midAngle * RADIAN)
  const y = cy + radius * Math.sin(-midAngle * RADIAN)
  return (
    <text x={x} y={y} textAnchor="middle" dominantBaseline="central" className="text-[11px]" fill="#6b7280">
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  )
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { displayName } = useAuth()

  const [stats,           setStats]           = useState({ total: 0, departments: 0, presentToday: 0, monthlyPayroll: 0 })
  const [headcountData,   setHeadcountData]   = useState([])
  const [deptDonutData,   setDeptDonutData]   = useState([])
  const [recentEmployees, setRecentEmployees] = useState([])
  const [attendanceSummary, setAttendanceSummary] = useState({ present: 0, total: 0 })
  const [loading,         setLoading]         = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const today      = new Date().toISOString().slice(0, 10)
      const monthStart = `${today.slice(0, 7)}-01`

      const [
        { data: employees },
        { count: deptCount },
        { data: todayAttendance },
        { data: payrollThisMonth },
      ] = await Promise.all([
        supabase
          .from('employees')
          .select('id, first_name, last_name, hire_date, department_id, departments(name), avatar_url, job_title, created_at')
          .eq('status', 'active')
          .order('created_at', { ascending: false }),
        supabase.from('departments').select('*', { count: 'exact', head: true }),
        supabase.from('attendance').select('id, status').eq('date', today),
        supabase.from('payroll').select('net_salary').gte('pay_period_start', monthStart).eq('status', 'paid'),
      ])

      const empList = employees ?? []

      // ── Stat values ──
      const presentCount    = todayAttendance?.filter(a => a.status === 'present').length ?? 0
      const monthlyPayTotal = payrollThisMonth?.reduce((s, r) => s + (Number(r.net_salary) || 0), 0) ?? 0

      setStats({
        total:          empList.length,
        departments:    deptCount ?? 0,
        presentToday:   presentCount,
        monthlyPayroll: monthlyPayTotal,
      })

      // ── Headcount growth (last 12 months) ──
      const months = last12Months()
      setHeadcountData(
        months.map(({ label, endDate }) => ({
          month:     label,
          employees: empList.filter(e => e.hire_date && new Date(e.hire_date) <= endDate).length,
        })),
      )

      // ── Department donut ──
      const deptMap = {}
      empList.forEach(e => {
        const name = e.departments?.name ?? 'Unassigned'
        deptMap[name] = (deptMap[name] ?? 0) + 1
      })
      setDeptDonutData(
        Object.entries(deptMap)
          .map(([name, value]) => ({ name, value }))
          .sort((a, b) => b.value - a.value),
      )

      // ── Recent employees (5 most recently added) ──
      setRecentEmployees(empList.slice(0, 5))

      // ── Today's attendance summary ──
      setAttendanceSummary({
        present: presentCount,
        total:   empList.length,
      })

      setLoading(false)
    }

    load()
  }, [])

  const attendancePct =
    attendanceSummary.total > 0
      ? Math.round((attendanceSummary.present / attendanceSummary.total) * 100)
      : 0

  // ── render ───────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* Welcome */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">
          Good {greeting()}, {displayName.split(' ')[0]} 👋
        </h2>
        <p className="text-sm text-gray-400 mt-0.5">
          Here's what's happening across your workforce today.
        </p>
      </div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Employees"
          value={loading ? '…' : stats.total}
          sub="Active headcount"
          icon={Users}
          iconBg="bg-blue-50"
          iconColor="text-blue-600"
          accent="border-l-blue-500"
        />
        <StatCard
          label="Departments"
          value={loading ? '…' : stats.departments}
          sub="Across the company"
          icon={Building2}
          iconBg="bg-emerald-50"
          iconColor="text-emerald-600"
          accent="border-l-emerald-500"
        />
        <StatCard
          label="Present Today"
          value={loading ? '…' : stats.presentToday}
          sub={`of ${stats.total} employees`}
          icon={Clock}
          iconBg="bg-amber-50"
          iconColor="text-amber-600"
          accent="border-l-amber-500"
        />
        <StatCard
          label="Monthly Payroll"
          value={loading ? '…' : fmtCurrency(stats.monthlyPayroll)}
          sub="Paid this month"
          icon={DollarSign}
          iconBg="bg-purple-50"
          iconColor="text-purple-600"
          accent="border-l-purple-500"
        />
      </div>

      {/* ── Charts row ── */}
      <div className="grid grid-cols-3 gap-4">

        {/* Area chart — Headcount Growth */}
        <div className="col-span-2 bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <SectionHeader title="Headcount Growth" />
          {loading ? (
            <Skeleton h="h-56" />
          ) : (
            <ResponsiveContainer width="100%" height={224}>
              <AreaChart data={headcountData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="blueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#1e3a8a" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#1e3a8a" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<HeadcountTooltip />} />
                <Area
                  type="monotone"
                  dataKey="employees"
                  stroke="#1e3a8a"
                  strokeWidth={2.5}
                  fill="url(#blueGrad)"
                  dot={{ fill: '#1e3a8a', r: 3, strokeWidth: 0 }}
                  activeDot={{ r: 5, strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Pie chart — By Department */}
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <SectionHeader title="By Department" />
          {loading ? (
            <Skeleton h="h-56" />
          ) : deptDonutData.length === 0 ? (
            <EmptyChart message="No employees yet" />
          ) : (
            <ResponsiveContainer width="100%" height={224}>
              <PieChart>
                <Pie
                  data={deptDonutData}
                  cx="50%"
                  cy="44%"
                  innerRadius={52}
                  outerRadius={75}
                  paddingAngle={3}
                  dataKey="value"
                  labelLine={false}
                  label={<PieLabel />}
                >
                  {deptDonutData.map((_, i) => (
                    <Cell key={i} fill={DEPT_COLORS[i % DEPT_COLORS.length]} />
                  ))}
                </Pie>
                <Legend
                  iconType="circle"
                  iconSize={8}
                  formatter={v => <span style={{ fontSize: 11, color: '#64748b' }}>{v}</span>}
                />
                <Tooltip
                  formatter={(v, n) => [v, n]}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── Bottom row ── */}
      <div className="grid grid-cols-3 gap-4">

        {/* Recent Employees */}
        <div className="col-span-2 bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <SectionHeader title="Recent Employees" linkTo="/employees" />
          {loading ? (
            <Skeleton h="h-44" />
          ) : recentEmployees.length === 0 ? (
            <EmptyChart message="No employees added yet" />
          ) : (
            <div className="space-y-3">
              {recentEmployees.map(emp => (
                <div key={emp.id} className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-[#1e3a8a] flex items-center justify-center text-white text-xs font-bold shrink-0">
                    {`${emp.first_name?.[0] ?? ''}${emp.last_name?.[0] ?? ''}`.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">
                      {emp.first_name} {emp.last_name}
                    </p>
                    <p className="text-xs text-gray-400 truncate">
                      {emp.job_title ?? '—'} · {emp.departments?.name ?? 'No dept'}
                    </p>
                  </div>
                  <p className="text-xs text-gray-400 shrink-0">{fmtDate(emp.hire_date)}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Today's Attendance */}
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <SectionHeader title="Today's Attendance" linkTo="/attendance/daily" />
          {loading ? (
            <Skeleton h="h-44" />
          ) : (
            <div className="flex flex-col h-44 justify-between">
              {/* Big number */}
              <div className="text-center pt-2">
                <p className="text-5xl font-bold text-gray-800">{attendancePct}<span className="text-2xl text-gray-400">%</span></p>
                <p className="text-sm text-gray-500 mt-1">
                  {attendanceSummary.present} of {attendanceSummary.total} present
                </p>
              </div>

              {/* Progress bar */}
              <div>
                <div className="flex justify-between text-xs text-gray-400 mb-1.5">
                  <span>Present</span>
                  <span>{attendanceSummary.present}</span>
                </div>
                <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#1e3a8a] rounded-full transition-all duration-700"
                    style={{ width: `${attendancePct}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-gray-400 mt-1.5">
                  <span>Absent</span>
                  <span>{attendanceSummary.total - attendanceSummary.present}</span>
                </div>
              </div>

              {/* Status pills */}
              <div className="flex gap-2 flex-wrap">
                <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-medium">
                  ● Present: {attendanceSummary.present}
                </span>
                <span className="px-2.5 py-1 bg-red-50 text-red-600 rounded-full text-xs font-medium">
                  ● Absent: {attendanceSummary.total - attendanceSummary.present}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── tiny helpers ─────────────────────────────────────────────────────────────

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  return 'evening'
}

function Skeleton({ h = 'h-40' }) {
  return (
    <div className={`${h} bg-gray-100 rounded-lg animate-pulse`} />
  )
}

function EmptyChart({ message }) {
  return (
    <div className="h-44 flex items-center justify-center text-sm text-gray-300 font-medium">
      {message}
    </div>
  )
}
