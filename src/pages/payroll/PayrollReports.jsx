/**
 * PayrollReports — aggregate analytics from payroll_records.
 * JOINs employee_salary_config via salary_config_id for department grouping.
 * net_salary is a GENERATED column in payroll_records.
 */
import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { Loader2, DollarSign, Users, TrendingUp, Award } from 'lucide-react'
import {
  BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, PieChart, Pie, Legend,
} from 'recharts'

const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const DEPT_COLORS = ['#6366f1','#f59e0b','#10b981','#ef4444','#8b5cf6','#06b6d4','#f97316','#ec4899']

const fmt$ = n =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n ?? 0)

function KpiCard({ label, value, sub, Icon, iconBg, iconColor }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm text-gray-500 font-medium">{label}</p>
        <p className="text-2xl font-extrabold text-gray-900 mt-0.5 tracking-tight truncate">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${iconBg}`}>
        <Icon size={22} className={iconColor} />
      </div>
    </div>
  )
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-lg px-3.5 py-2.5 text-xs">
      <p className="font-semibold text-gray-700 mb-1.5">{label}</p>
      {payload.map(p => (
        <p key={p.name} className="text-gray-600">
          {p.name}: <span className="font-bold text-gray-900">{fmt$(p.value)}</span>
        </p>
      ))}
    </div>
  )
}

export default function PayrollReports() {
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const yr = new Date().getFullYear()

  useEffect(() => {
    // Simple select — department is in employee_salary_config, no employees join needed
    supabase
      .from('payroll_records')
      .select(`
        net_salary, basic_salary, overtime, bonus, deductions, tax,
        pay_period, status,
        employee_salary_config!salary_config_id(department)
      `)
      .gte('pay_period', `${yr}-01-01`)
      .lte('pay_period', `${yr}-12-31`)
      .then(({ data, error }) => {
        if (!error) setRecords(data ?? [])
        setLoading(false)
      })
  }, [yr])

  // ── KPIs: use records with status 'Paid' ──────────────────────────────────
  const kpis = useMemo(() => {
    const paid  = records.filter(r => r.status === 'Paid')
    const total = paid.reduce((s, r) => s + Number(r.net_salary ?? 0), 0)
    const avg   = paid.length > 0 ? total / paid.length : 0

    // Find month with highest total net
    const byMonth = MONTH_ABBR.map((m, i) => ({
      label: m,
      total: paid
        .filter(r => new Date(`${r.pay_period}T00:00:00`).getMonth() === i)
        .reduce((s, r) => s + Number(r.net_salary ?? 0), 0),
    }))
    const peak = byMonth.reduce((best, m) => m.total > best.total ? m : best, { label: '—', total: 0 })

    return { total, avg, paidCount: paid.length, totalCount: records.length, peak }
  }, [records])

  // ── Monthly bar chart data ─────────────────────────────────────────────────
  const monthlyData = useMemo(() =>
    MONTH_ABBR.map((name, i) => ({
      month: name,
      total: records
        .filter(r => new Date(`${r.pay_period}T00:00:00`).getMonth() === i)
        .reduce((s, r) => s + Number(r.net_salary ?? 0), 0),
    })),
  [records])

  // ── Department pie data ────────────────────────────────────────────────────
  const deptData = useMemo(() => {
    const map = {}
    records.forEach(r => {
      // Department comes from employee_salary_config, not from employees table
      const dept = r.employee_salary_config?.department ?? 'Unassigned'
      map[dept] = (map[dept] ?? 0) + Number(r.net_salary ?? 0)
    })
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
  }, [records])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32 gap-3 text-gray-400">
        <Loader2 size={22} className="animate-spin text-blue-500" />
        <span className="text-sm">Loading payroll analytics…</span>
      </div>
    )
  }

  return (
    <div className="space-y-5">

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Total Paid Out"        value={fmt$(kpis.total)}   sub={`${kpis.paidCount} paid records`}   Icon={DollarSign} iconBg="bg-emerald-50" iconColor="text-emerald-600" />
        <KpiCard label="Avg Net Salary"         value={fmt$(kpis.avg)}    sub="per payroll record"                 Icon={TrendingUp}  iconBg="bg-blue-50"   iconColor="text-blue-600" />
        <KpiCard label="Records This Year"      value={kpis.totalCount}   sub={`${yr} payroll year`}               Icon={Users}       iconBg="bg-indigo-50" iconColor="text-indigo-600" />
        <KpiCard label="Peak Month"             value={kpis.peak.label}   sub={fmt$(kpis.peak.total)}              Icon={Award}       iconBg="bg-amber-50"  iconColor="text-amber-600" />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

        {/* Monthly bar chart */}
        <div className="lg:col-span-3 bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="mb-5">
            <h3 className="text-base font-bold text-gray-900">Monthly Payroll Cost</h3>
            <p className="text-xs text-gray-400 mt-0.5">{yr} — total net salary from payroll_records</p>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={monthlyData} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false}
                tickFormatter={v => v === 0 ? '0' : `$${(v/1000).toFixed(0)}k`} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: '#f8fafc', radius: 6 }} />
              <Bar dataKey="total" name="Net Salary" fill="#6366f1" radius={[4,4,0,0]} maxBarSize={36} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Department pie */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="mb-5">
            <h3 className="text-base font-bold text-gray-900">By Department</h3>
            <p className="text-xs text-gray-400 mt-0.5">Payroll distribution by team</p>
          </div>
          {deptData.length === 0 ? (
            <div className="flex items-center justify-center h-52 text-gray-300 text-sm">No data</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={deptData} cx="50%" cy="45%" innerRadius={55} outerRadius={90} paddingAngle={3} dataKey="value">
                  {deptData.map((_, i) => <Cell key={i} fill={DEPT_COLORS[i % DEPT_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={v => [fmt$(v), 'Payroll']}
                  contentStyle={{ borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: 12 }} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 10 }}
                  formatter={v => <span style={{ color: '#64748b' }}>{v}</span>} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Department breakdown table */}
      {deptData.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="text-sm font-bold text-gray-800">Department Breakdown</h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-50 bg-gray-50/50">
                {['Department','Total Payroll','Share'].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {deptData.map((d, i) => {
                const share = kpis.total > 0 ? ((d.value / kpis.total) * 100).toFixed(1) : '0.0'
                return (
                  <tr key={d.name} className="hover:bg-gray-50/40 transition-colors">
                    <td className="px-5 py-3">
                      <span className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: DEPT_COLORS[i % DEPT_COLORS.length] }} />
                        <span className="font-medium text-gray-800">{d.name}</span>
                      </span>
                    </td>
                    <td className="px-5 py-3 font-semibold text-gray-900">{fmt$(d.value)}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-100 rounded-full h-1.5 max-w-[80px]">
                          <div className="h-1.5 rounded-full" style={{ width: `${share}%`, background: DEPT_COLORS[i % DEPT_COLORS.length] }} />
                        </div>
                        <span className="text-xs text-gray-500">{share}%</span>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
