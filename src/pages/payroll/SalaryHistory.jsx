/**
 * SalaryHistory — every payroll run, grouped by month, with period-over-period
 * change, full earnings / deductions breakdown and payslip view.
 */
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import * as db from '../../lib/db'
import {
  History, ChevronDown, Eye, Download, RefreshCw, TrendingUp, TrendingDown, Timer, Gift,
  Landmark, CalendarRange, ChevronsUpDown, Minus,
} from 'lucide-react'
import { PayslipModal } from './payslip'
import {
  useToast, indexById, personOf, num, netOf, grossOf, deductOf, sumBy, recEmpId,
  fmt$, fmt$0, fmtK, fmtMonth, downloadCSV, PAY_STATUS, PAY_KEYS,
  Toast, HeroCard, RateRing, StatCard, SearchBox, DeptSelect, FilterPills, ToolButton,
  SkeletonRows, EmptyState, Th, PersonCell, PayBadge,
} from './shared'

const THIS_YEAR = String(new Date().getFullYear())

function Change({ cur, prev }) {
  if (!prev) return <span className="text-[11px] text-gray-300">first run</span>
  const pct = ((cur - prev) / prev) * 100
  if (Math.abs(pct) < 0.05) {
    return <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-gray-400"><Minus size={12} /> 0%</span>
  }
  const up = pct > 0
  return (
    <span className={`inline-flex items-center gap-0.5 text-[11px] font-semibold ${up ? 'text-rose-600' : 'text-emerald-600'}`}
      title="Change in net payroll vs previous period">
      {up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
      {up ? '+' : ''}{pct.toFixed(1)}%
    </span>
  )
}

function StatusBar({ rows }) {
  const total = rows.length || 1
  return (
    <div className="flex h-1.5 w-24 rounded-full overflow-hidden bg-gray-100">
      {PAY_KEYS.map(k => {
        const n = rows.filter(r => r.rec.status === k).length
        return n ? <div key={k} className={PAY_STATUS[k].bar} style={{ width: `${(n / total) * 100}%` }} title={`${n} ${PAY_STATUS[k].label}`} /> : null
      })}
    </div>
  )
}

function Money({ v, tone = 'text-gray-700', neg }) {
  const n = num(v)
  if (!n) return <span className="text-gray-300">—</span>
  return <span className={`${tone} tabular-nums`}>{neg ? '−' : ''}{fmt$(n)}</span>
}

// ════════════════════════════════════════════════════════════════════════════════
export default function SalaryHistory() {
  const [records,    setRecords]    = useState([])
  const [employees,  setEmployees]  = useState([])
  const [loading,    setLoading]    = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [year,       setYear]       = useState(THIS_YEAR)
  const [search,     setSearch]     = useState('')
  const [dept,       setDept]       = useState('all')
  const [filter,     setFilter]     = useState('all')
  const [open,       setOpen]       = useState(() => new Set())
  const [viewing,    setViewing]    = useState(null)
  const [toast, showToast, dismissToast] = useToast()
  const reqId  = useRef(0)
  const seeded = useRef(false)

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

  // ── Derived ──
  const empMap = useMemo(() => indexById(employees), [employees])

  const years = useMemo(() => {
    const ys = new Set(records.map(r => r.pay_period?.slice(0, 4)).filter(Boolean))
    ys.add(THIS_YEAR)
    return [...ys].sort().reverse()
  }, [records])

  const rows = useMemo(() => records
    .filter(r => year === 'all' || r.pay_period?.startsWith(year))
    .map(r => ({ key: r.id, rec: r, person: personOf(r, empMap) })),
  [records, year, empMap])

  const departments = useMemo(
    () => [...new Set(rows.map(r => r.person.dept).filter(Boolean))].sort(),
    [rows],
  )

  const scoped = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter(r =>
      (dept === 'all' || r.person.dept === dept) &&
      (!q || r.person.name.toLowerCase().includes(q) || r.person.dept.toLowerCase().includes(q)),
    )
  }, [rows, search, dept])

  const visible = useMemo(
    () => (filter === 'all' ? scoped : scoped.filter(r => r.rec.status === filter)),
    [scoped, filter],
  )

  // Month groups (desc). Change % compares against the next-older group in the same view.
  const groups = useMemo(() => {
    const m = {}
    visible.forEach(r => { (m[r.rec.pay_period ?? '—'] ??= []).push(r) })
    const list = Object.entries(m)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([period, items]) => ({
        period,
        items: items.sort((a, b) => a.person.name.localeCompare(b.person.name)),
        net:   sumBy(items, r => netOf(r.rec)),
        gross: sumBy(items, r => grossOf(r.rec)),
        ded:   sumBy(items, r => deductOf(r.rec)),
      }))
    return list.map((g, i) => ({ ...g, prev: list[i + 1]?.net ?? null }))
  }, [visible])

  // Open the latest group on first load
  useEffect(() => {
    if (seeded.current || !groups.length) return
    seeded.current = true
    setOpen(new Set([groups[0].period]))
  }, [groups])

  const stats = useMemo(() => {
    const net    = sumBy(rows, r => netOf(r.rec))
    const paid   = sumBy(rows.filter(r => r.rec.status === 'Paid'), r => netOf(r.rec))
    const months = new Set(rows.map(r => r.rec.pay_period)).size
    return {
      net, paid,
      pct:      net > 0 ? Math.round((paid / net) * 100) : 0,
      gross:    sumBy(rows, r => grossOf(r.rec)),
      ded:      sumBy(rows, r => deductOf(r.rec)),
      overtime: sumBy(rows, r => num(r.rec.overtime)),
      bonus:    sumBy(rows, r => num(r.rec.bonus)),
      tax:      sumBy(rows, r => num(r.rec.tax)),
      months,
      perMonth: months ? net / months : 0,
      people:   new Set(rows.map(r => recEmpId(r.rec) ?? r.person.name)).size,
    }
  }, [rows])

  const allOpen = groups.length > 0 && groups.every(g => open.has(g.period))
  const toggleGroup = p => setOpen(s => { const n = new Set(s); n.has(p) ? n.delete(p) : n.add(p); return n })
  const toggleAllGroups = () => setOpen(allOpen ? new Set() : new Set(groups.map(g => g.period)))

  function exportCSV() {
    downloadCSV(visible.map(r => ({
      Period:     fmtMonth(r.rec.pay_period),
      Employee:   r.person.name,
      Department: r.person.dept,
      Basic:      num(r.rec.basic_salary),
      Overtime:   num(r.rec.overtime),
      Bonus:      num(r.rec.bonus),
      Gross:      grossOf(r.rec),
      Deductions: num(r.rec.deductions),
      Tax:        num(r.rec.tax),
      'Net Pay':  netOf(r.rec),
      Status:     r.rec.status,
    })), `salary-history-${year}.csv`)
  }

  const FILTERS = [
    { key: 'all', label: 'All', dot: 'bg-gray-400', count: scoped.length },
    ...PAY_KEYS.map(k => ({ key: k, label: PAY_STATUS[k].label, dot: PAY_STATUS[k].dot, count: scoped.filter(r => r.rec.status === k).length })),
  ]
  const scopeLabel = year === 'all' ? 'All time' : year

  // ── Render ──
  return (
    <div className="space-y-5 pb-10">

      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight">Salary history</h2>
          <p className="text-sm text-gray-400 mt-1">
            {scopeLabel} · {stats.months} pay period{stats.months !== 1 ? 's' : ''} · {stats.people} employee{stats.people !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-1 p-1 bg-white border border-gray-200 rounded-xl shadow-sm overflow-x-auto">
          {[...years, 'all'].map(y => (
            <button key={y} onClick={() => setYear(y)}
              className={`px-3.5 py-1.5 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors
                ${year === y ? 'bg-[#1e3a8a] text-white shadow-sm' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'}`}>
              {y === 'all' ? 'All' : y}
            </button>
          ))}
        </div>
      </div>

      {/* Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        <HeroCard
          ring={<RateRing pct={stats.pct} label="paid" />}
          eyebrow={`Net payroll · ${scopeLabel}`}
          headline={fmt$(stats.net)}
          sub={`${rows.length} records · avg ${fmt$0(stats.perMonth)} / month`}
          stats={[
            { label: 'Gross',      value: fmtK(stats.gross), Icon: TrendingUp },
            { label: 'Deductions', value: fmtK(stats.ded),   Icon: TrendingDown },
          ]}
        />
        <StatCard label="Overtime paid" value={fmtK(stats.overtime)} sub={stats.gross ? `${((stats.overtime / stats.gross) * 100).toFixed(1)}% of gross` : '—'}
          Icon={Timer} iconCls="bg-emerald-50 text-emerald-500" />
        <StatCard label="Bonuses" value={fmtK(stats.bonus)} sub={stats.gross ? `${((stats.bonus / stats.gross) * 100).toFixed(1)}% of gross` : '—'}
          Icon={Gift} iconCls="bg-violet-50 text-violet-500" />
        <StatCard label="Tax withheld" value={fmtK(stats.tax)} sub={stats.gross ? `${((stats.tax / stats.gross) * 100).toFixed(1)}% of gross` : '—'}
          Icon={Landmark} iconCls="bg-orange-50 text-orange-500" />
        <StatCard label="Pay periods" value={stats.months} sub={`${stats.people} employees paid`}
          Icon={CalendarRange} iconCls="bg-indigo-50 text-indigo-500" />
      </div>

      {/* Toolbar */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center gap-2.5">
          <SearchBox value={search} onChange={setSearch} placeholder="Search employee or department…" />
          <DeptSelect value={dept} onChange={setDept} options={departments} />
          <div className="flex items-center gap-2">
            <ToolButton onClick={toggleAllGroups} disabled={!groups.length} className="flex-1 md:flex-none">
              <ChevronsUpDown size={15} /> {allOpen ? 'Collapse' : 'Expand'} all
            </ToolButton>
            <ToolButton onClick={exportCSV} disabled={!visible.length} title="Export CSV">
              <Download size={15} /> <span className="hidden sm:inline">Export</span>
            </ToolButton>
            <ToolButton onClick={() => fetchData(true)} title="Refresh" className="!px-2.5">
              <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
            </ToolButton>
          </div>
        </div>
        <FilterPills items={FILTERS} value={filter} onChange={setFilter} />
      </div>

      {/* Groups */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"><SkeletonRows /></div>
      ) : groups.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
          <EmptyState
            Icon={History}
            title={rows.length === 0 ? `No payroll history for ${scopeLabel}` : 'No records match these filters'}
            sub={rows.length === 0 ? 'Records appear here once payroll is generated.' : null}
            action={rows.length > 0 && (
              <button onClick={() => { setSearch(''); setDept('all'); setFilter('all') }}
                className="text-xs font-semibold text-[#1e3a8a] hover:underline">Clear filters</button>
            )}
          />
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map(g => {
            const isOpen = open.has(g.period)
            const paid   = g.items.filter(r => r.rec.status === 'Paid').length
            return (
              <div key={g.period} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <button onClick={() => toggleGroup(g.period)}
                  className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-gray-50/60 transition-colors">
                  <div className="w-11 h-11 rounded-xl bg-indigo-50 text-[#1e3a8a] flex flex-col items-center justify-center shrink-0 leading-none">
                    <span className="text-[10px] font-bold uppercase">{fmtMonth(g.period, 'short').split(' ')[0]}</span>
                    <span className="text-[10px] font-semibold text-indigo-400 mt-0.5">{g.period.slice(0, 4)}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-gray-900">{fmtMonth(g.period)}</p>
                    <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                      <span>{g.items.length} employee{g.items.length !== 1 ? 's' : ''}</span>
                      <span className="hidden sm:inline">·</span>
                      <span className="hidden sm:flex items-center gap-2"><StatusBar rows={g.items} /> {paid}/{g.items.length} paid</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-extrabold text-gray-900 tabular-nums">{fmt$(g.net)}</p>
                    <Change cur={g.net} prev={g.prev} />
                  </div>
                  <ChevronDown size={18} className={`text-gray-400 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                </button>

                {isOpen && (
                  <div className="border-t border-gray-100">
                    {/* Desktop */}
                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-100 bg-gray-50/60">
                            <Th className="pl-5">Employee</Th><Th right>Basic</Th><Th right>Overtime</Th><Th right>Bonus</Th>
                            <Th right>Deductions</Th><Th right>Tax</Th><Th right>Net pay</Th><Th>Status</Th><Th />
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {g.items.map(r => (
                            <tr key={r.key} className="hover:bg-gray-50/60 transition-colors">
                              <td className="pl-5 pr-4 py-3"><PersonCell person={r.person} /></td>
                              <td className="px-4 py-3 text-right whitespace-nowrap"><Money v={r.rec.basic_salary} /></td>
                              <td className="px-4 py-3 text-right whitespace-nowrap"><Money v={r.rec.overtime} tone="text-emerald-600" /></td>
                              <td className="px-4 py-3 text-right whitespace-nowrap"><Money v={r.rec.bonus} tone="text-violet-600" /></td>
                              <td className="px-4 py-3 text-right whitespace-nowrap"><Money v={r.rec.deductions} tone="text-rose-600" neg /></td>
                              <td className="px-4 py-3 text-right whitespace-nowrap"><Money v={r.rec.tax} tone="text-orange-600" neg /></td>
                              <td className="px-4 py-3 text-right whitespace-nowrap font-extrabold text-gray-900 tabular-nums">{fmt$(netOf(r.rec))}</td>
                              <td className="px-4 py-3"><PayBadge status={r.rec.status} /></td>
                              <td className="pr-5 pl-2 py-3 text-right">
                                <button onClick={() => setViewing(r)} title="View payslip"
                                  className="w-8 h-8 rounded-lg inline-flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-[#1e3a8a] transition-colors">
                                  <Eye size={15} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t-2 border-gray-100 bg-gray-50/60 text-sm">
                            <td className="pl-5 pr-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Period total</td>
                            <td className="px-4 py-3 text-right font-semibold text-gray-700 tabular-nums">{fmt$(sumBy(g.items, r => num(r.rec.basic_salary)))}</td>
                            <td className="px-4 py-3 text-right font-semibold text-emerald-600 tabular-nums">{fmt$(sumBy(g.items, r => num(r.rec.overtime)))}</td>
                            <td className="px-4 py-3 text-right font-semibold text-violet-600 tabular-nums">{fmt$(sumBy(g.items, r => num(r.rec.bonus)))}</td>
                            <td className="px-4 py-3 text-right font-semibold text-rose-600 tabular-nums">−{fmt$(sumBy(g.items, r => num(r.rec.deductions)))}</td>
                            <td className="px-4 py-3 text-right font-semibold text-orange-600 tabular-nums">−{fmt$(sumBy(g.items, r => num(r.rec.tax)))}</td>
                            <td className="px-4 py-3 text-right font-extrabold text-gray-900 tabular-nums">{fmt$(g.net)}</td>
                            <td colSpan={2} />
                          </tr>
                        </tfoot>
                      </table>
                    </div>

                    {/* Mobile */}
                    <div className="md:hidden divide-y divide-gray-100">
                      {g.items.map(r => (
                        <button key={r.key} onClick={() => setViewing(r)} className="w-full text-left p-4 flex items-center gap-3">
                          <div className="flex-1 min-w-0"><PersonCell person={r.person} /></div>
                          <div className="text-right shrink-0">
                            <p className="font-extrabold text-gray-900 tabular-nums">{fmt$(netOf(r.rec))}</p>
                            <div className="mt-1"><PayBadge status={r.rec.status} /></div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
          <p className="text-xs text-gray-400 px-1">
            Showing {visible.length} of {rows.length} records · {fmt$(sumBy(visible, r => netOf(r.rec)))} net
          </p>
        </div>
      )}

      {viewing && <PayslipModal record={viewing.rec} person={viewing.person} onClose={() => setViewing(null)} />}

      <Toast toast={toast} onDismiss={dismissToast} />
    </div>
  )
}
