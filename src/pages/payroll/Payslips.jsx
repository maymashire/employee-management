/**
 * Payslips — issued pay statements (records in Processing or Paid).
 * Browse by period, view, print one or many, export.
 */
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import * as db from '../../lib/db'
import {
  FileText, BadgeCheck, Clock, Users, Eye, Printer, Download, RefreshCw, Receipt, Wallet, StickyNote,
} from 'lucide-react'
import { PayslipModal, printPayslips, payslipCSVRow } from './payslip'
import {
  useToast, useSelection, indexById, personOf, netOf, grossOf, deductOf, sumBy, recEmpId,
  fmt$, fmt$0, fmtK, fmtMonth, fmtDate, periodOf, downloadCSV, PAY_STATUS,
  Toast, HeroCard, RateRing, StatCard, MonthPicker, SearchBox, DeptSelect, FilterPills, ToolButton,
  EmptyState, Checkbox, PayBadge, Avatar, BulkBar, BulkAction,
} from './shared'

const ISSUED = ['Processing', 'Paid']

function SlipCard({ row, selected, onToggle, onView }) {
  const r     = row.rec
  const gross = grossOf(r)
  const ded   = deductOf(r)
  const keep  = gross > 0 ? Math.max(0, Math.min(100, ((gross - ded) / gross) * 100)) : 0
  return (
    <div className={`group bg-white rounded-2xl border p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md
      ${selected ? 'border-[#1e3a8a] ring-2 ring-[#1e3a8a]/15' : 'border-gray-100'}`}>
      <div className="flex items-start gap-3">
        <Checkbox checked={selected} onChange={onToggle} />
        <Avatar id={row.person.id} name={row.person.name} />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-gray-800 truncate flex items-center gap-1.5">
            {row.person.name}
            {row.person.former && <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-gray-100 text-gray-500">Former</span>}
          </p>
          <p className="text-xs text-gray-400 truncate">{row.person.dept || '—'}</p>
        </div>
        <PayBadge status={r.status} />
      </div>

      <div className="flex items-end justify-between mt-4">
        <div>
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{fmtMonth(r.pay_period)}</p>
          <p className="text-2xl font-extrabold text-gray-900 tracking-tight tabular-nums mt-0.5">{fmt$(netOf(r))}</p>
        </div>
        {r.note && <span title={r.note} className="text-gray-300 hover:text-gray-500 cursor-help mb-1"><StickyNote size={14} /></span>}
      </div>

      <div className="mt-3">
        <div className="h-1.5 rounded-full bg-rose-100 overflow-hidden" title={`Gross ${fmt$(gross)} · Deductions ${fmt$(ded)}`}>
          <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${keep}%` }} />
        </div>
        <div className="flex justify-between text-[11px] mt-1.5 tabular-nums">
          <span className="text-gray-500">Gross <b className="text-gray-700">{fmt$0(gross)}</b></span>
          <span className="text-gray-500">Deducted <b className="text-rose-600">{fmt$0(ded)}</b></span>
        </div>
      </div>

      <div className="flex items-center gap-2 mt-4 pt-3 border-t border-gray-50">
        <button onClick={onView}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold text-[#1e3a8a] bg-indigo-50 hover:bg-indigo-100 transition-colors">
          <Eye size={14} /> View
        </button>
        <button onClick={() => printPayslips([{ record: r, person: row.person }])} title="Print"
          className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-500 border border-gray-200 hover:bg-gray-50 transition-colors">
          <Printer size={14} />
        </button>
        <span className="text-[10px] text-gray-400 ml-auto whitespace-nowrap">
          {r.paid_at ? `Paid ${fmtDate(r.paid_at)}` : r.processed_at ? `Since ${fmtDate(r.processed_at)}` : ''}
        </span>
      </div>
    </div>
  )
}

function SkeletonGrid() {
  return (
    <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 animate-pulse space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gray-100" />
            <div className="flex-1 space-y-2"><div className="h-3 w-32 bg-gray-100 rounded" /><div className="h-2.5 w-20 bg-gray-100 rounded" /></div>
          </div>
          <div className="h-7 w-28 bg-gray-100 rounded" />
          <div className="h-1.5 bg-gray-100 rounded" />
          <div className="h-9 bg-gray-100 rounded-xl" />
        </div>
      ))}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════════
export default function Payslips() {
  const [month,      setMonth]      = useState(null)    // null until data decides the default
  const [records,    setRecords]    = useState([])
  const [employees,  setEmployees]  = useState([])
  const [loading,    setLoading]    = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search,     setSearch]     = useState('')
  const [dept,       setDept]       = useState('all')
  const [filter,     setFilter]     = useState('all')
  const [viewing,    setViewing]    = useState(null)
  const [toast, showToast, dismissToast] = useToast()
  const { selected, toggle, toggleAll, clear } = useSelection()
  const reqId = useRef(0)

  const fetchData = useCallback(async (soft = false) => {
    const id = ++reqId.current
    soft ? setRefreshing(true) : setLoading(true)
    try {
      const [recs, emps] = await Promise.all([db.getPayrollRecords(), db.getEmployees()])
      if (id !== reqId.current) return
      const issued = recs.filter(r => ISSUED.includes(r.status))
      setRecords(issued); setEmployees(emps)
      // Open on the most recent period that has payslips
      setMonth(m => m ?? (issued[0]?.pay_period?.slice(0, 7) ?? 'all'))
    } catch (err) {
      if (id === reqId.current) { showToast('error', err.message); setMonth(m => m ?? 'all') }
    }
    if (id === reqId.current) { setLoading(false); setRefreshing(false) }
  }, [showToast])

  useEffect(() => { fetchData() }, [fetchData])
  useEffect(() => { clear() }, [month]) // eslint-disable-line react-hooks/exhaustive-deps

  const scope = month ?? 'all'

  // ── Derived ──
  const empMap = useMemo(() => indexById(employees), [employees])

  const rows = useMemo(() => records
    .filter(r => scope === 'all' || r.pay_period === periodOf(scope))
    .map(r => ({ key: r.id, rec: r, person: personOf(r, empMap) }))
    .sort((a, b) => (b.rec.pay_period ?? '').localeCompare(a.rec.pay_period ?? '') || a.person.name.localeCompare(b.person.name)),
  [records, scope, empMap])

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

  const stats = useMemo(() => {
    const total = sumBy(rows, r => netOf(r.rec))
    const paid  = rows.filter(r => r.rec.status === 'Paid')
    return {
      n: rows.length,
      total,
      paid: paid.length,
      processing: rows.length - paid.length,
      pct: rows.length ? Math.round((paid.length / rows.length) * 100) : 0,
      people: new Set(rows.map(r => recEmpId(r.rec) ?? r.person.name)).size,
      avg: rows.length ? total / rows.length : 0,
      gross: sumBy(rows, r => grossOf(r.rec)),
    }
  }, [rows])

  const selectedRows  = rows.filter(r => selected.has(r.key))
  const allVisibleSel = visible.length > 0 && visible.every(r => selected.has(r.key))
  const scopeLabel    = scope === 'all' ? 'All periods' : fmtMonth(scope)

  const toItems = list => list.map(r => ({ record: r.rec, person: r.person }))
  const exportCSV = list => downloadCSV(
    list.map(r => payslipCSVRow(r.rec, r.person)),
    `payslips-${scope}.csv`,
  )

  const FILTERS = [
    { key: 'all', label: 'All', dot: 'bg-gray-400', count: scoped.length },
    ...ISSUED.slice().reverse().map(k => ({ key: k, label: PAY_STATUS[k].label, dot: PAY_STATUS[k].dot, count: scoped.filter(r => r.rec.status === k).length })),
  ]
  const toggleFilter = f => setFilter(cur => (cur === f ? 'all' : f))

  // ── Render ──
  return (
    <div className="space-y-5 pb-24">

      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight">Payslips</h2>
          <p className="text-sm text-gray-400 mt-1">
            {scopeLabel} · issued once payroll is approved (Processing or Paid)
          </p>
        </div>
        {month && <MonthPicker value={month} onChange={setMonth} allowAll />}
      </div>

      {/* Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        <HeroCard
          ring={<RateRing pct={stats.pct} label="paid" />}
          eyebrow="Total net pay"
          headline={fmt$(stats.total)}
          sub={`${stats.n} payslip${stats.n !== 1 ? 's' : ''} · ${scopeLabel}`}
          stats={[
            { label: 'Gross',   value: fmtK(stats.gross), Icon: Wallet },
            { label: 'Average', value: fmt$0(stats.avg),  Icon: Receipt },
          ]}
        />
        <StatCard label="Paid" value={stats.paid} pct={stats.pct}
          Icon={BadgeCheck} iconCls={PAY_STATUS.Paid.icon} barCls={PAY_STATUS.Paid.bar}
          active={filter === 'Paid'} onClick={() => toggleFilter('Paid')} />
        <StatCard label="Processing" value={stats.processing} pct={stats.n ? 100 - stats.pct : 0}
          Icon={Clock} iconCls={PAY_STATUS.Processing.icon} barCls={PAY_STATUS.Processing.bar}
          active={filter === 'Processing'} onClick={() => toggleFilter('Processing')} />
        <StatCard label="Employees" value={stats.people} sub="received a payslip"
          Icon={Users} iconCls="bg-indigo-50 text-indigo-500" />
        <StatCard label="Average net" value={fmtK(stats.avg)} sub="per payslip"
          Icon={FileText} iconCls="bg-sky-50 text-sky-500" />
      </div>

      {/* Toolbar */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center gap-2.5">
          <SearchBox value={search} onChange={setSearch} placeholder="Search employee or department…" />
          <DeptSelect value={dept} onChange={setDept} options={departments} />
          <div className="flex items-center gap-2">
            <ToolButton onClick={() => printPayslips(toItems(visible))} disabled={!visible.length} tone="primary" className="flex-1 md:flex-none">
              <Printer size={15} /> Print {visible.length || ''}
            </ToolButton>
            <ToolButton onClick={() => exportCSV(visible)} disabled={!visible.length} title="Export CSV">
              <Download size={15} /> <span className="hidden sm:inline">Export</span>
            </ToolButton>
            <ToolButton onClick={() => fetchData(true)} title="Refresh" className="!px-2.5">
              <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
            </ToolButton>
          </div>
        </div>
        <div className="flex items-center justify-between gap-3">
          <FilterPills items={FILTERS} value={filter} onChange={setFilter} />
          {visible.length > 0 && (
            <button onClick={() => toggleAll(visible.map(r => r.key), allVisibleSel)}
              className="text-xs font-semibold text-[#1e3a8a] hover:underline whitespace-nowrap">
              {allVisibleSel ? 'Deselect all' : 'Select all'}
            </button>
          )}
        </div>
      </div>

      {/* Grid */}
      {loading ? <SkeletonGrid /> : visible.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
          <EmptyState
            Icon={FileText}
            title={rows.length === 0 ? `No payslips for ${scopeLabel}` : 'No payslips match these filters'}
            sub={rows.length === 0 ? 'Payslips appear here once payroll is approved in the Payroll Process tab.' : null}
            action={
              rows.length > 0 ? (
                <button onClick={() => { setSearch(''); setDept('all'); setFilter('all') }}
                  className="text-xs font-semibold text-[#1e3a8a] hover:underline">Clear filters</button>
              ) : scope !== 'all' && records.length > 0 ? (
                <button onClick={() => setMonth('all')} className="text-xs font-semibold text-[#1e3a8a] hover:underline">
                  Show all periods
                </button>
              ) : null
            }
          />
        </div>
      ) : (
        <>
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {visible.map(r => (
              <SlipCard key={r.key} row={r} selected={selected.has(r.key)}
                onToggle={() => toggle(r.key)} onView={() => setViewing(r)} />
            ))}
          </div>
          <p className="text-xs text-gray-400 px-1">
            Showing {visible.length} of {rows.length} payslips · {fmt$(sumBy(visible, r => netOf(r.rec)))} net
          </p>
        </>
      )}

      <BulkBar count={selectedRows.length} onClear={clear}>
        <BulkAction Icon={Printer} onClick={() => printPayslips(toItems(selectedRows))}>Print</BulkAction>
        <BulkAction Icon={Download} onClick={() => exportCSV(selectedRows)}>Export CSV</BulkAction>
      </BulkBar>

      {viewing && <PayslipModal record={viewing.rec} person={viewing.person} onClose={() => setViewing(null)} />}

      <Toast toast={toast} onDismiss={dismissToast} />
    </div>
  )
}
