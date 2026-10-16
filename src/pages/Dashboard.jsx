import { useState, useEffect } from 'react'
import { getEmployees, getDepartments, getAttendanceByDate, getPayrollRecordsByYear } from '../lib/db'
import { useAuth } from '../context/AuthContext'
import { Users, Building2, Clock, DollarSign, ArrowRight, TrendingUp } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts'

const DEPT_COLORS = ['#6366f1', '#3b82f6', '#06b6d4', '#10b981', '#f59e0b', '#f43f5e']

const fmtCurrency = n =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)

const fmtDate = iso =>
  iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'

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

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, icon: Icon, gradient, glowColor }) {
  return (
    <div className="rounded-xl p-4 relative overflow-hidden"
      style={{ background: gradient, boxShadow: `0 4px 20px ${glowColor}` }}>
      <div className="absolute inset-x-0 top-0 h-px opacity-30"
        style={{ background: 'linear-gradient(90deg, transparent, white, transparent)' }} />
      <div className="flex items-center justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-white/70 font-semibold uppercase tracking-wider">{label}</p>
          <p className="text-2xl font-extrabold text-white mt-1 tracking-tight leading-none">{value}</p>
          {sub && <p className="text-[11px] text-white/55 mt-1.5 truncate">{sub}</p>}
        </div>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-white/15 ml-3">
          <Icon size={18} className="text-white" />
        </div>
      </div>
    </div>
  )
}

function SectionHeader({ title, linkTo }) {
  const navigate = useNavigate()
  return (
    <div className="flex items-center justify-between mb-4">
      <h3 className="font-bold text-gray-800 text-base">{title}</h3>
      {linkTo && (
        <button onClick={() => navigate(linkTo)}
          className="flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors">
          View all <ArrowRight size={12} />
        </button>
      )}
    </div>
  )
}

function HeadcountTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-gray-900 rounded-xl shadow-xl px-3 py-2.5 text-xs border border-white/10">
      <p className="font-semibold text-gray-300 mb-0.5">{label}</p>
      <p className="text-indigo-400 font-bold">{payload[0].value} employees</p>
    </div>
  )
}

function PieLabel({ cx, cy, midAngle, outerRadius, percent }) {
  if (percent < 0.06) return null
  const RADIAN = Math.PI / 180
  const radius = outerRadius + 18
  const x = cx + radius * Math.cos(-midAngle * RADIAN)
  const y = cy + radius * Math.sin(-midAngle * RADIAN)
  return (
    <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fontSize={11} fill="#6b7280">
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  )
}

function Skeleton() {
  return <div className="h-full w-full rounded-xl shimmer" />
}

function EmptyChart({ message }) {
  return (
    <div className="h-44 flex items-center justify-center text-sm text-gray-300 font-medium">
      {message}
    </div>
  )
}

// ── Dashboard ──────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { displayName } = useAuth()

  const [stats,             setStats]             = useState({ total: 0, departments: 0, presentToday: 0, monthlyPayroll: 0 })
  const [headcountData,     setHeadcountData]     = useState([])
  const [deptDonutData,     setDeptDonutData]     = useState([])
  const [recentEmployees,   setRecentEmployees]   = useState([])
  const [attendanceSummary, setAttendanceSummary] = useState({ present: 0, total: 0 })
  const [loading,           setLoading]           = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const today     = new Date().toISOString().slice(0, 10)
      const monthStr  = today.slice(0, 7)

      const [allEmps, allDepts, todayAtt, payrollYear] = await Promise.all([
        getEmployees(),
        getDepartments(),
        getAttendanceByDate(today),
        getPayrollRecordsByYear(new Date().getFullYear()),
      ])

      const employees        = allEmps.filter(e => e.status === 'active')
      const presentCount     = todayAtt?.filter(a => a.status === 'present').length ?? 0
      const monthlyPayTotal  = payrollYear
        .filter(r => r.pay_period?.startsWith(monthStr) && r.status === 'Paid')
        .reduce((s, r) => s + (Number(r.net_salary) || 0), 0)

      setStats({
        total:          employees.length,
        departments:    allDepts.length,
        presentToday:   presentCount,
        monthlyPayroll: monthlyPayTotal,
      })

      const months = last12Months()
      setHeadcountData(
        months.map(({ label, endDate }) => ({
          month:     label,
          employees: employees.filter(e => e.hire_date && new Date(e.hire_date) <= endDate).length,
        }))
      )

      const deptMap = {}
      employees.forEach(e => {
        const name = e.departments?.name ?? 'Unassigned'
        deptMap[name] = (deptMap[name] ?? 0) + 1
      })
      setDeptDonutData(
        Object.entries(deptMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
      )

      const recent = [...employees]
        .sort((a, b) => (b.hire_date ?? '').localeCompare(a.hire_date ?? ''))
        .slice(0, 5)
      setRecentEmployees(recent)

      setAttendanceSummary({ present: presentCount, total: employees.length })
      setLoading(false)
    }
    load()
  }, [])

  const attendancePct = attendanceSummary.total > 0
    ? Math.round((attendanceSummary.present / attendanceSummary.total) * 100)
    : 0

  const firstName = displayName.split(' ')[0]

  return (
    <div className="space-y-5 fade-in">

      {/* ── Welcome Banner ── */}
      <div className="relative rounded-2xl overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #1e3a8a 100%)' }}>
        {/* Glow blobs */}
        <div className="absolute top-[-40px] right-[-40px] w-48 h-48 rounded-full opacity-20"
          style={{ background: 'radial-gradient(circle, #6366f1, transparent)' }} />
        <div className="absolute bottom-[-20px] left-[30%] w-32 h-32 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #3b82f6, transparent)' }} />

        <div className="relative z-10 px-5 py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="text-indigo-300 text-xs font-semibold uppercase tracking-wider mb-0.5">{greeting()}</p>
            <h2 className="text-xl font-extrabold text-white tracking-tight">
              {firstName} 👋
            </h2>
            <p className="text-indigo-200/55 text-xs mt-1">
              Here's what's happening across your workforce today.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="px-4 py-2 rounded-xl text-center"
              style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <p className="text-white font-extrabold text-xl">{loading ? '…' : attendancePct}<span className="text-sm text-indigo-300">%</span></p>
              <p className="text-indigo-300 text-xs">Present today</p>
            </div>
            <div className="px-4 py-2 rounded-xl text-center"
              style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <p className="text-white font-extrabold text-xl">{loading ? '…' : stats.total}</p>
              <p className="text-indigo-300 text-xs">Total staff</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Employees"
          value={loading ? '…' : stats.total}
          sub="Active headcount"
          icon={Users}
          gradient="linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)"
          glowColor="rgba(79,70,229,0.25)"
        />
        <StatCard
          label="Departments"
          value={loading ? '…' : stats.departments}
          sub="Across the company"
          icon={Building2}
          gradient="linear-gradient(135deg, #0891b2 0%, #06b6d4 100%)"
          glowColor="rgba(8,145,178,0.25)"
        />
        <StatCard
          label="Present Today"
          value={loading ? '…' : stats.presentToday}
          sub={`of ${stats.total} employees`}
          icon={Clock}
          gradient="linear-gradient(135deg, #d97706 0%, #f59e0b 100%)"
          glowColor="rgba(217,119,6,0.25)"
        />
        <StatCard
          label="Monthly Payroll"
          value={loading ? '…' : fmtCurrency(stats.monthlyPayroll)}
          sub="Paid this month"
          icon={DollarSign}
          gradient="linear-gradient(135deg, #059669 0%, #10b981 100%)"
          glowColor="rgba(5,150,105,0.25)"
        />
      </div>

      {/* ── Charts Row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Area chart */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <SectionHeader title="Headcount Growth" />
          {loading ? (
            <div className="h-56"><Skeleton /></div>
          ) : (
            <ResponsiveContainer width="100%" height={224}>
              <AreaChart data={headcountData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="indigo-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip content={<HeadcountTooltip />} />
                <Area type="monotone" dataKey="employees"
                  stroke="#6366f1" strokeWidth={2.5}
                  fill="url(#indigo-grad)"
                  dot={{ fill: '#6366f1', r: 3, strokeWidth: 0 }}
                  activeDot={{ r: 5, strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Pie chart */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <SectionHeader title="By Department" />
          {loading ? (
            <div className="h-56"><Skeleton /></div>
          ) : deptDonutData.length === 0 ? (
            <EmptyChart message="No employees yet" />
          ) : (
            <ResponsiveContainer width="100%" height={224}>
              <PieChart>
                <Pie data={deptDonutData} cx="50%" cy="44%"
                  innerRadius={52} outerRadius={75} paddingAngle={3}
                  dataKey="value" labelLine={false} label={<PieLabel />}>
                  {deptDonutData.map((_, i) => (
                    <Cell key={i} fill={DEPT_COLORS[i % DEPT_COLORS.length]} />
                  ))}
                </Pie>
                <Legend iconType="circle" iconSize={8}
                  formatter={v => <span style={{ fontSize: 11, color: '#64748b' }}>{v}</span>} />
                <Tooltip formatter={(v, n) => [v, n]}
                  contentStyle={{ fontSize: 12, borderRadius: 12, border: '1px solid #e2e8f0' }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── Bottom Row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Recent Employees */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <SectionHeader title="Recently Hired" linkTo="/employees" />
          {loading ? (
            <div className="h-44"><Skeleton /></div>
          ) : recentEmployees.length === 0 ? (
            <EmptyChart message="No employees added yet" />
          ) : (
            <div className="space-y-3">
              {recentEmployees.map((emp, i) => {
                const ini = `${emp.first_name?.[0] ?? ''}${emp.last_name?.[0] ?? ''}`.toUpperCase()
                const grad = [
                  'linear-gradient(135deg,#6366f1,#8b5cf6)',
                  'linear-gradient(135deg,#3b82f6,#06b6d4)',
                  'linear-gradient(135deg,#10b981,#3b82f6)',
                  'linear-gradient(135deg,#f59e0b,#ef4444)',
                  'linear-gradient(135deg,#f43f5e,#a855f7)',
                ][i % 5]
                return (
                  <div key={emp.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 transition-colors">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-extrabold shrink-0"
                      style={{ background: grad }}>
                      {ini}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">
                        {emp.first_name} {emp.last_name}
                      </p>
                      <p className="text-xs text-gray-400 truncate">
                        {emp.job_title ?? '—'} · {emp.departments?.name ?? 'No dept'}
                      </p>
                    </div>
                    <p className="text-xs text-gray-400 shrink-0 font-medium">{fmtDate(emp.hire_date)}</p>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Today's Attendance */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <SectionHeader title="Today's Attendance" linkTo="/attendance/daily" />
          {loading ? (
            <div className="h-44"><Skeleton /></div>
          ) : (
            <div className="flex flex-col h-44 justify-between">
              {/* Big number */}
              <div className="text-center pt-2">
                <p className="text-5xl font-extrabold text-gray-900 tracking-tight">
                  {attendancePct}<span className="text-2xl text-gray-300">%</span>
                </p>
                <p className="text-sm text-gray-400 mt-1">
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
                  <div className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${attendancePct}%`,
                      background: 'linear-gradient(90deg, #6366f1, #3b82f6)',
                    }} />
                </div>
                <div className="flex justify-between text-xs text-gray-400 mt-1.5">
                  <span>Absent</span>
                  <span>{attendanceSummary.total - attendanceSummary.present}</span>
                </div>
              </div>

              {/* Pills */}
              <div className="flex gap-2 flex-wrap">
                <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs font-semibold">
                  ● Present: {attendanceSummary.present}
                </span>
                <span className="px-2.5 py-1 bg-red-50 text-red-500 rounded-full text-xs font-semibold">
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
