/**
 * PayrollReports — yearly payroll analytics: cost composition per month,
 * department split, top earners and a month-by-month table.
 */
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import * as db from '../../lib/db'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList,
} from 'recharts'
import {
  Download, RefreshCw, Users, Award, Sparkles, Receipt, TrendingUp, TrendingDown, BarChart3,
} from 'lucide-react'
import {
  useToast, indexById, personOf, num, netOf, grossOf, deductOf, sumBy, recEmpId,
  fmt$, fmt$0, fmtK, downloadCSV, PAY_STATUS, PAY_KEYS,
  Toast, HeroCard, RateRing, StatCard, ToolButton, EmptyState, Th, Avatar,
} from './shared'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const THIS_YEAR = String(new Date().getFullYear())

// Categorical slots 1–3 of the validated reference palette (fixed order, never cycled).
const SERIES = [
  { key: 'basic',    label: 'Basic',    color: '#2a78d6' },
  { key: 'overtime', label: 'Overtime', color: '#eb6834' },
  { key: 'bonus',    label: 'Bonus',    color: '#1baf7a' },
]
const DEPT_COLOR = '#2a78d6'
const AXIS = { fontSize: 11, fill: '#94a3b8' }

function Card({ title, sub, right, children, className = '' }) {
  return (
    <div className={`bg-white rounded-2xl border border-gray-100 shadow-sm p-5 ${className}`}>
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="text-base font-bold text-gray-900">{title}</h3>
          {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
        </div>
        {right}
      </div>
      {children}
    </div>
  )
}

function Legend() {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      {SERIES.map(s => (
        <span key={s.key} className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ background: s.color }} /> {s.label}
        </span>
      ))}
    </div>
  )
}

function MonthTip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-lg px-3.5 py-3 text-xs min-w-[180px]">
      <p className="font-bold text-gray-800 mb-2">{label} · {d.count} employee{d.count !== 1 ? 's' : ''}</p>
      {SERIES.map(s => (
        <p key={s.key} className="flex items-center justify-between gap-4 text-gray-500 py-0.5">
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm" style={{ background: s.color }} />{s.label}</span>
          <span className="font-semibold text-gray-800 tabular-nums">{fmt$(d[s.key])}</span>
        </p>
      ))}
      <div className="border-t border-gray-100 mt-1.5 pt-1.5 space-y-0.5">
        <p className="flex justify-between text-gray-500"><span>Deductions</span><span className="font-semibold text-gray-800 tabular-nums">−{fmt$(d.deduct)}</span></p>
        <p className="flex justify-between text-gray-800 font-bold"><span>Net</span><span className="tabular-nums">{fmt$(d.net)}</span></p>
      </div>
    </div>
  )
}

function DeptTip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-lg px-3.5 py-2.5 text-xs">
      <p className="font-bold text-gray-800">{d.name}</p>
      <p className="text-gray-500 mt-1">Net <b className="text-gray-800 tabular-nums">{fmt$(d.net)}</b> · {d.share.toFixed(1)}%</p>
      <p className="text-gray-500">{d.people} employee{d.people !== 1 ? 's' : ''} · avg {fmt$0(d.avg)} / payslip</p>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════════
export default function PayrollReports() {
  const [records,    setRecords]    = useState([])
  const [employees,  setEmployees]  = useState([])
  const [loading,    setLoading]    = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [year,       setYear]       = useState(THIS_YEAR)
  const [toast, showToast, dismissToast] = useToast()
  const reqId = useRef(0)

  const fetchData = useCallback(async (soft = false) => {
    const id = ++reqId.current
    soft ? setRefreshing(true) : setLoading(true)
    try {
      const [recs, emps] = await Promise.all([db.getPayrollRecords(), db.getEmployees()])
      if (id !== reqId.current) return
      setRecords(recs); setEmployees(emps)
    } catch (err) {
      if (id === reqId.current) showToast('error', err.message)
    }
    if (id === reqId.current) { setLoading(false); setRefreshing(false) }
  }, [showToast])

  useEffect(() => { fetchData() }, [fetchData])

  const empMap = useMemo(() => indexById(employees), [employees])

  const years = useMemo(() => {
    const ys = new Set(records.map(r => r.pay_period?.slice(0, 4)).filter(Boolean))
    ys.add(THIS_YEAR)
    return [...ys].sort().reverse()
  }, [records])

  const rows = useMemo(
    () => records.filter(r => r.pay_period?.startsWith(year)).map(r => ({ rec: r, person: personOf(r, empMap) })),
    [records, year, empMap],
  )
  const prevRows = useMemo(
    () => records.filter(r => r.pay_period?.startsWith(String(Number(year) - 1))),
    [records, year],
  )

  const monthly = useMemo(() => MONTHS.map((label, i) => {
    const list = rows.filter(r => Number(r.rec.pay_period.slice(5, 7)) === i + 1)
    return {
      label,
      count:    list.length,
      basic:    sumBy(list, r => num(r.rec.basic_salary)),
      overtime: sumBy(list, r => num(r.rec.overtime)),
      bonus:    sumBy(list, r => num(r.rec.bonus)),
      gross:    sumBy(list, r => grossOf(r.rec)),
      deduct:   sumBy(list, r => deductOf(r.rec)),
      net:      sumBy(list, r => netOf(r.rec)),
      paid:     sumBy(list.filter(r => r.rec.status === 'Paid'), r => netOf(r.rec)),
    }
  }), [rows])

  const kpi = useMemo(() => {
    const net    = sumBy(rows, r => netOf(r.rec))
    const gross  = sumBy(rows, r => grossOf(r.rec))
    const paid   = sumBy(rows.filter(r => r.rec.status === 'Paid'), r => netOf(r.rec))
    const extras = sumBy(rows, r => num(r.rec.overtime) + num(r.rec.bonus))
    const active = monthly.filter(m => m.count)
    const peak   = active.reduce((b, m) => (!b || m.net > b.net ? m : b), null)
    const prevNet = sumBy(prevRows, netOf)
    return {
      net, gross, paid, extras,
      deduct:   sumBy(rows, r => deductOf(r.rec)),
      pct:      net > 0 ? Math.round((paid / net) * 100) : 0,
      people:   new Set(rows.map(r => recEmpId(r.rec) ?? r.person.name)).size,
      avg:      rows.length ? net / rows.length : 0,
      months:   active.length,
      peak,
      prevNet,
      yoy:      prevNet > 0 ? ((net - prevNet) / prevNet) * 100 : null,
      byStatus: Object.fromEntries(PAY_KEYS.map(k => [k, sumBy(rows.filter(r => r.rec.status === k), r => netOf(r.rec))])),
    }
  }, [rows, monthly, prevRows])

  const depts = useMemo(() => {
    const m = {}
    rows.forEach(r => {
      const name = r.person.dept || 'Unassigned'
      const d = (m[name] ??= { name, net: 0, n: 0, ids: new Set() })
      d.net += netOf(r.rec); d.n++; d.ids.add(recEmpId(r.rec) ?? r.person.name)
    })
    return Object.values(m)
      .map(d => ({ name: d.name, net: d.net, people: d.ids.size, avg: d.n ? d.net / d.n : 0, share: kpi.net > 0 ? (d.net / kpi.net) * 100 : 0 }))
      .sort((a, b) => b.net - a.net)
  }, [rows, kpi.net])

  const earners = useMemo(() => {
    const m = {}
    rows.forEach(r => {
      const id = recEmpId(r.rec) ?? r.person.name
      const e = (m[id] ??= { id, person: r.person, net: 0, bonus: 0, n: 0 })
      e.net += netOf(r.rec); e.bonus += num(r.rec.bonus); e.n++
    })
    return Object.values(m).sort((a, b) => b.net - a.net).slice(0, 5)
  }, [rows])

  function exportCSV() {
    downloadCSV(monthly.filter(m => m.count).map(m => ({
      Month: `${m.label} ${year}`, Employees: m.count,
      Basic: m.basic, Overtime: m.overtime, Bonus: m.bonus, Gross: m.gross,
      Deductions: m.deduct, Net: m.net, Paid: m.paid,
    })), `payroll-report-${year}.csv`)
  }

  const hasData = rows.length > 0
  const topNet  = earners[0]?.net || 1

  // ── Render ──
  return (
    <div className="space-y-5 pb-10">

      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight">Payroll report · {year}</h2>
          <p className="text-sm text-gray-400 mt-1">
            {kpi.months} pay period{kpi.months !== 1 ? 's' : ''} · {rows.length} payroll records
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 p-1 bg-white border border-gray-200 rounded-xl shadow-sm overflow-x-auto">
            {years.map(y => (
              <button key={y} onClick={() => setYear(y)}
                className={`px-3.5 py-1.5 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors
                  ${year === y ? 'bg-[#1e3a8a] text-white shadow-sm' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'}`}>
                {y}
              </button>
            ))}
          </div>
          <ToolButton onClick={exportCSV} disabled={!hasData} title="Export CSV" className="bg-white">
            <Download size={15} /> <span className="hidden sm:inline">Export</span>
          </ToolButton>
          <ToolButton onClick={() => fetchData(true)} title="Refresh" className="!px-2.5 bg-white">
            <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
          </ToolButton>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        <HeroCard
          ring={<RateRing pct={kpi.pct} label="paid" />}
          eyebrow="Total payroll cost"
          headline={loading ? '—' : fmt$(kpi.net)}
          sub={kpi.yoy == null ? `${fmt$(kpi.paid)} paid out` : `${kpi.yoy >= 0 ? '+' : ''}${kpi.yoy.toFixed(1)}% vs ${Number(year) - 1}`}
          stats={[
            { label: 'Gross',      value: fmtK(kpi.gross),  Icon: TrendingUp },
            { label: 'Deductions', value: fmtK(kpi.deduct), Icon: TrendingDown },
          ]}
        />
        <StatCard label="Employees paid" value={kpi.people} sub={`${rows.length} payslips`}
          Icon={Users} iconCls="bg-indigo-50 text-indigo-500" />
        <StatCard label="Avg net / payslip" value={fmtK(kpi.avg)} sub="per employee per month"
          Icon={Receipt} iconCls="bg-sky-50 text-sky-500" />
        <StatCard label="Overtime + bonus" value={fmtK(kpi.extras)} sub={kpi.gross ? `${((kpi.extras / kpi.gross) * 100).toFixed(1)}% of gross` : '—'}
          Icon={Sparkles} iconCls="bg-amber-50 text-amber-500" />
        <StatCard label="Peak month" value={kpi.peak?.label ?? '—'} sub={kpi.peak ? fmt$0(kpi.peak.net) : 'No data'}
          Icon={Award} iconCls="bg-emerald-50 text-emerald-500" />
      </div>

      {loading ? (
        <div className="grid lg:grid-cols-5 gap-5">
          <div className="lg:col-span-3 h-80 bg-white rounded-2xl border border-gray-100 animate-pulse" />
          <div className="lg:col-span-2 h-80 bg-white rounded-2xl border border-gray-100 animate-pulse" />
        </div>
      ) : !hasData ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
          <EmptyState Icon={BarChart3} title={`No payroll data for ${year}`}
            sub="Generate payroll in the Payroll Process tab and reports will appear here." />
        </div>
      ) : (
        <>
          {/* Charts */}
          <div className="grid lg:grid-cols-5 gap-5">
            <Card className="lg:col-span-3" title="Monthly payroll cost" sub={`Gross pay by component · ${year}`} right={<Legend />}>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={monthly} margin={{ top: 4, right: 4, left: -6, bottom: 0 }} barCategoryGap="28%">
                  <CartesianGrid stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="label" tick={AXIS} axisLine={false} tickLine={false} />
                  <YAxis tick={AXIS} axisLine={false} tickLine={false} width={48}
                    tickFormatter={v => (v === 0 ? '0' : fmtK(v))} />
                  <Tooltip content={<MonthTip />} cursor={{ fill: '#f8fafc', radius: 6 }} />
                  {SERIES.map((s, i) => (
                    <Bar key={s.key} dataKey={s.key} name={s.label} stackId="gross" fill={s.color}
                      stroke="#fff" strokeWidth={2} maxBarSize={34}
                      radius={i === SERIES.length - 1 ? [4, 4, 0, 0] : 0} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <Card className="lg:col-span-2" title="Cost by department" sub="Share of net payroll">
              <ResponsiveContainer width="100%" height={Math.max(200, depts.length * 44)}>
                <BarChart data={depts} layout="vertical" margin={{ top: 0, right: 56, left: 0, bottom: 0 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 12, fill: '#475569', fontWeight: 600 }}
                    axisLine={false} tickLine={false} tickFormatter={v => (v.length > 14 ? `${v.slice(0, 13)}…` : v)} />
                  <Tooltip content={<DeptTip />} cursor={{ fill: '#f8fafc', radius: 6 }} />
                  <Bar dataKey="net" fill={DEPT_COLOR} radius={[0, 4, 4, 0]} maxBarSize={22}>
                    <LabelList dataKey="share" position="right" formatter={v => `${v.toFixed(1)}%`}
                      style={{ fontSize: 11, fill: '#475569', fontWeight: 600 }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>

          {/* Status + top earners */}
          <div className="grid lg:grid-cols-5 gap-5">
            <Card className="lg:col-span-2" title="Payment status" sub="Net amount by status">
              <div className="flex h-3 rounded-full overflow-hidden bg-gray-100 gap-0.5">
                {PAY_KEYS.map(k => kpi.byStatus[k] > 0 && (
                  <div key={k} className={PAY_STATUS[k].bar} style={{ width: `${(kpi.byStatus[k] / kpi.net) * 100}%` }} />
                ))}
              </div>
              <div className="mt-4 space-y-3">
                {PAY_KEYS.slice().reverse().map(k => {
                  const m = PAY_STATUS[k]
                  return (
                    <div key={k} className="flex items-center gap-3">
                      <span className={`w-8 h-8 rounded-lg flex items-center justify-center ${m.icon}`}><m.Icon size={15} /></span>
                      <span className="text-sm font-medium text-gray-600 flex-1">{m.label}</span>
                      <span className="text-sm font-bold text-gray-900 tabular-nums">{fmt$(kpi.byStatus[k])}</span>
                      <span className="text-xs text-gray-400 w-12 text-right tabular-nums">
                        {kpi.net ? `${((kpi.byStatus[k] / kpi.net) * 100).toFixed(0)}%` : '0%'}
                      </span>
                    </div>
                  )
                })}
              </div>
            </Card>

            <Card className="lg:col-span-3" title="Top earners" sub={`Highest total net pay in ${year}`}>
              <div className="space-y-3">
                {earners.map((e, i) => (
                  <div key={e.id} className="flex items-center gap-3">
                    <span className="w-5 text-xs font-bold text-gray-300 text-right">{i + 1}</span>
                    <Avatar id={e.person.id} name={e.person.name} size="w-9 h-9 text-[11px]" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-gray-800 truncate">{e.person.name}</p>
                        <p className="text-sm font-bold text-gray-900 tabular-nums">{fmt$(e.net)}</p>
                      </div>
                      <div className="flex items-center gap-2 mt-1.5">
                        <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${(e.net / topNet) * 100}%`, background: DEPT_COLOR }} />
                        </div>
                        <span className="text-[11px] text-gray-400 whitespace-nowrap">
                          {e.n} mo{e.bonus ? ` · ${fmt$0(e.bonus)} bonus` : ''}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Monthly table (table view of the chart) */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="text-base font-bold text-gray-900">Month by month</h3>
              <p className="text-xs text-gray-400 mt-0.5">All figures for {year}</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[760px]">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/60">
                    <Th className="pl-5">Month</Th><Th right>Employees</Th>
                    {SERIES.map(s => <Th key={s.key} right>{s.label}</Th>)}
                    <Th right>Deductions</Th><Th right>Net</Th><Th>Paid</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {monthly.filter(m => m.count).map(m => {
                    const pct = m.net > 0 ? Math.round((m.paid / m.net) * 100) : 0
                    return (
                      <tr key={m.label} className="hover:bg-gray-50/60 transition-colors">
                        <td className="pl-5 pr-4 py-3 font-semibold text-gray-800">{m.label}</td>
                        <td className="px-4 py-3 text-right text-gray-500 tabular-nums">{m.count}</td>
                        {SERIES.map(s => (
                          <td key={s.key} className="px-4 py-3 text-right text-gray-700 tabular-nums">{m[s.key] ? fmt$(m[s.key]) : '—'}</td>
                        ))}
                        <td className="px-4 py-3 text-right text-gray-700 tabular-nums">{m.deduct ? `−${fmt$(m.deduct)}` : '—'}</td>
                        <td className="px-4 py-3 text-right font-extrabold text-gray-900 tabular-nums">{fmt$(m.net)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                              <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-xs text-gray-500 tabular-nums">{pct}%</span>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-100 bg-gray-50/60 font-semibold">
                    <td className="pl-5 pr-4 py-3 text-xs text-gray-400 uppercase tracking-wider">Total</td>
                    <td className="px-4 py-3 text-right text-gray-500 tabular-nums">{rows.length}</td>
                    {SERIES.map(s => (
                      <td key={s.key} className="px-4 py-3 text-right text-gray-700 tabular-nums">{fmt$(sumBy(monthly, m => m[s.key]))}</td>
                    ))}
                    <td className="px-4 py-3 text-right text-gray-700 tabular-nums">−{fmt$(kpi.deduct)}</td>
                    <td className="px-4 py-3 text-right font-extrabold text-gray-900 tabular-nums">{fmt$(kpi.net)}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{kpi.pct}%</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      )}

      <Toast toast={toast} onDismiss={dismissToast} />
    </div>
  )
}
