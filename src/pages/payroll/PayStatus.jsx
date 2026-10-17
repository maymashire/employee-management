/**
 * PayStatus — payment tracker across periods.
 * Quick-set Unpaid / Processing / Paid per row or in bulk, spot overdue pay.
 */
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import * as db from '../../lib/db'
import {
  CircleDashed, Clock, BadgeCheck, AlarmClock, Download, RefreshCw, Wallet, Loader2,
  Hourglass, CalendarClock,
} from 'lucide-react'
import {
  useToast, useSelection, indexById, personOf, netOf, sumBy, statusPatch,
  fmt$, fmt$0, fmtK, fmtMonth, fmtPeriod, fmtDate, fmtDateTime, periodOf, currentMonth, downloadCSV,
  PAY_STATUS, PAY_KEYS,
  Toast, HeroCard, RateRing, StatCard, MonthPicker, SearchBox, DeptSelect, FilterPills, ToolButton,
  SkeletonRows, EmptyState, Checkbox, Th, PersonCell, PayBadge, StatusSwitch, BulkBar, BulkAction, ListFooter,
} from './shared'

const THIS_PERIOD = periodOf(currentMonth())

const monthsBehind = period => {
  const [y1, m1] = period.split('-').map(Number)
  const [y2, m2] = THIS_PERIOD.split('-').map(Number)
  return (y2 - y1) * 12 + (m2 - m1)
}
const isOverdue = r => r.status !== 'Paid' && (r.pay_period ?? '') < THIS_PERIOD

function Timeline({ rec }) {
  const steps = [
    { key: 'Unpaid',     at: rec.created_at,   label: 'Created' },
    { key: 'Processing', at: rec.processed_at, label: 'Processing' },
    { key: 'Paid',       at: rec.paid_at ?? (rec.status === 'Paid' ? rec.processed_at : null), label: 'Paid' },
  ]
  const reached = PAY_KEYS.indexOf(rec.status)
  const last    = steps[Math.max(0, reached)]
  return (
    <div className="min-w-[150px]">
      <div className="flex items-center gap-1">
        {steps.map((s, i) => (
          <div key={s.key} className="flex items-center gap-1 flex-1 last:flex-none" title={`${s.label}${s.at ? ` · ${fmtDateTime(s.at)}` : ''}`}>
            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${i <= reached ? PAY_STATUS[s.key].dot : 'bg-gray-200'}`} />
            {i < steps.length - 1 && <span className={`h-0.5 flex-1 rounded-full ${i < reached ? 'bg-gray-300' : 'bg-gray-100'}`} />}
          </div>
        ))}
      </div>
      <p className="text-[11px] text-gray-400 mt-1.5 whitespace-nowrap">
        {last.label} {last.at ? fmtDate(last.at) : ''}
      </p>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════════
export default function PayStatus() {
  const [month,      setMonth]      = useState('all')
  const [records,    setRecords]    = useState([])
  const [employees,  setEmployees]  = useState([])
  const [loading,    setLoading]    = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [savingIds,  setSavingIds]  = useState(() => new Set())
  const [bulkBusy,   setBulkBusy]   = useState(false)
  const [search,     setSearch]     = useState('')
  const [dept,       setDept]       = useState('all')
  const [filter,     setFilter]     = useState('all')
  const [toast, showToast, dismissToast] = useToast()
  const { selected, toggle, toggleAll, clear } = useSelection()
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
  useEffect(() => { clear() }, [month]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived ──
  const empMap = useMemo(() => indexById(employees), [employees])

  const rows = useMemo(() => records
    .filter(r => month === 'all' || r.pay_period === periodOf(month))
    .map(r => ({ key: r.id, rec: r, person: personOf(r, empMap), overdue: isOverdue(r) })),
  [records, month, empMap])

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

  const matches = (r, f) => f === 'all' ? true : f === 'overdue' ? r.overdue : r.rec.status === f
  const visible = useMemo(() => scoped.filter(r => matches(r, filter)), [scoped, filter])

  const stats = useMemo(() => {
    const by = f => rows.filter(r => matches(r, f))
    const total = sumBy(rows, r => netOf(r.rec))
    const paid  = sumBy(by('Paid'), r => netOf(r.rec))
    const card  = f => { const l = by(f); return { n: l.length, amt: sumBy(l, r => netOf(r.rec)) } }
    return {
      total, paid,
      outstanding: total - paid,
      pct: total > 0 ? Math.round((paid / total) * 100) : 0,
      Unpaid: card('Unpaid'), Processing: card('Processing'), Paid: card('Paid'), overdue: card('overdue'),
    }
  }, [rows])

  const selectedRows  = rows.filter(r => selected.has(r.key))
  const allVisibleSel = visible.length > 0 && visible.every(r => selected.has(r.key))

  // ── Mutations ──
  async function setStatus(targets, status, bulk = false) {
    const list = targets.filter(r => r.rec.status !== status)
    if (!list.length) return
    const keys = list.map(r => r.key)
    bulk ? setBulkBusy(true) : setSavingIds(s => new Set([...s, ...keys]))
    try {
      const patches = Object.fromEntries(list.map(r => [r.rec.id, statusPatch(r.rec, status)]))
      await db.batchUpdatePayrollRecords(Object.entries(patches).map(([id, p]) => ({ id, ...p })))
      setRecords(rs => rs.map(r => (patches[r.id] ? { ...r, ...patches[r.id] } : r)))
      if (bulk) clear()
      showToast('success', list.length === 1
        ? `${list[0].person.name.split(' ')[0]} · ${fmtPeriod(list[0].rec.pay_period)} → ${PAY_STATUS[status].label}`
        : `${list.length} records → ${PAY_STATUS[status].label}`)
    } catch (err) {
      showToast('error', err.message)
    }
    bulk ? setBulkBusy(false) : setSavingIds(s => { const n = new Set(s); keys.forEach(k => n.delete(k)); return n })
  }

  function exportCSV() {
    downloadCSV(visible.map(r => ({
      Employee:    r.person.name,
      Department:  r.person.dept,
      Period:      fmtMonth(r.rec.pay_period),
      'Net Pay':   netOf(r.rec),
      Status:      r.rec.status,
      Overdue:     r.overdue ? 'Yes' : '',
      Created:     r.rec.created_at ? fmtDate(r.rec.created_at) : '',
      Processed:   r.rec.processed_at ? fmtDate(r.rec.processed_at) : '',
      'Paid On':   r.rec.paid_at ? fmtDate(r.rec.paid_at) : '',
    })), `pay-status-${month}.csv`)
  }

  const FILTERS = [
    { key: 'all',     label: 'All',     dot: 'bg-gray-400', count: scoped.length },
    ...PAY_KEYS.map(k => ({ key: k, label: PAY_STATUS[k].label, dot: PAY_STATUS[k].dot, count: scoped.filter(r => matches(r, k)).length })),
    { key: 'overdue', label: 'Overdue', dot: 'bg-rose-500', count: scoped.filter(r => r.overdue).length },
  ]
  const toggleFilter = f => setFilter(cur => (cur === f ? 'all' : f))
  const pctOf = n => (rows.length ? Math.round((n / rows.length) * 100) : 0)

  const overdueTag = r => r.overdue ? (
    <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 text-rose-600 ring-1 ring-rose-200 whitespace-nowrap">
      Overdue · {monthsBehind(r.rec.pay_period)} mo
    </span>
  ) : null

  const scopeLabel = month === 'all' ? 'All periods' : fmtMonth(month)

  // ── Render ──
  return (
    <div className="space-y-5 pb-24">

      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight">Payment status</h2>
          <p className="text-sm text-gray-400 mt-1">
            {scopeLabel} · {rows.length} payroll record{rows.length !== 1 ? 's' : ''}
          </p>
        </div>
        <MonthPicker value={month} onChange={setMonth} allowAll />
      </div>

      {/* Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        <HeroCard
          ring={<RateRing pct={stats.pct} label="paid" />}
          eyebrow="Paid out"
          headline={fmt$(stats.paid)}
          sub={`of ${fmt$(stats.total)} · ${scopeLabel}`}
          stats={[
            { label: 'Outstanding', value: fmtK(stats.outstanding), Icon: Hourglass },
            { label: 'Overdue',     value: stats.overdue.n,          Icon: CalendarClock },
          ]}
        />
        <StatCard label="Unpaid" value={stats.Unpaid.n} sub={fmt$0(stats.Unpaid.amt)} pct={pctOf(stats.Unpaid.n)}
          Icon={CircleDashed} iconCls={PAY_STATUS.Unpaid.icon} barCls={PAY_STATUS.Unpaid.bar}
          active={filter === 'Unpaid'} onClick={() => toggleFilter('Unpaid')} />
        <StatCard label="Processing" value={stats.Processing.n} sub={fmt$0(stats.Processing.amt)} pct={pctOf(stats.Processing.n)}
          Icon={Clock} iconCls={PAY_STATUS.Processing.icon} barCls={PAY_STATUS.Processing.bar}
          active={filter === 'Processing'} onClick={() => toggleFilter('Processing')} />
        <StatCard label="Paid" value={stats.Paid.n} sub={fmt$0(stats.Paid.amt)} pct={pctOf(stats.Paid.n)}
          Icon={BadgeCheck} iconCls={PAY_STATUS.Paid.icon} barCls={PAY_STATUS.Paid.bar}
          active={filter === 'Paid'} onClick={() => toggleFilter('Paid')} />
        <StatCard label="Overdue" value={stats.overdue.n} sub={stats.overdue.n ? fmt$0(stats.overdue.amt) : 'Nothing late'} pct={pctOf(stats.overdue.n)}
          Icon={AlarmClock} iconCls="bg-rose-50 text-rose-500" barCls="bg-rose-500"
          active={filter === 'overdue'} onClick={() => toggleFilter('overdue')} />
      </div>

      {/* List */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 space-y-3">
          <div className="flex flex-col md:flex-row md:items-center gap-2.5">
            <SearchBox value={search} onChange={setSearch} placeholder="Search employee or department…" />
            <DeptSelect value={dept} onChange={setDept} options={departments} />
            <div className="flex items-center gap-2">
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

        {loading ? <SkeletonRows /> : visible.length === 0 ? (
          <EmptyState
            Icon={Wallet}
            title={rows.length === 0 ? `No payroll records for ${scopeLabel}` : 'Nothing matches these filters'}
            sub={rows.length === 0 ? 'Generate payroll from the Payroll Process tab first.' : null}
            action={rows.length > 0 && (
              <button onClick={() => { setSearch(''); setDept('all'); setFilter('all') }}
                className="text-xs font-semibold text-[#1e3a8a] hover:underline">Clear filters</button>
            )}
          />
        ) : (
          <>
            {/* Desktop */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/60">
                    <th className="pl-5 pr-2 py-3 w-10">
                      <Checkbox checked={allVisibleSel} onChange={() => toggleAll(visible.map(r => r.key), allVisibleSel)} />
                    </th>
                    <Th>Employee</Th><Th>Period</Th><Th right>Net pay</Th><Th>Progress</Th><Th>Set status</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {visible.map(r => {
                    const isSel = selected.has(r.key)
                    const busy  = savingIds.has(r.key) || bulkBusy
                    return (
                      <tr key={r.key} className={`transition-colors ${isSel ? 'bg-indigo-50/50' : 'hover:bg-gray-50/60'}`}>
                        <td className="pl-5 pr-2 py-3"><Checkbox checked={isSel} onChange={() => toggle(r.key)} /></td>
                        <td className="px-4 py-3"><PersonCell person={r.person} /></td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <p className="text-sm font-medium text-gray-700">{fmtPeriod(r.rec.pay_period)}</p>
                          <div className="mt-0.5">{overdueTag(r)}</div>
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap font-extrabold text-gray-900 tabular-nums">{fmt$(netOf(r.rec))}</td>
                        <td className="px-4 py-3"><Timeline rec={r.rec} /></td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <StatusSwitch status={r.rec.status} busy={busy} onSet={s => setStatus([r], s)} />
                            {savingIds.has(r.key) && <Loader2 size={15} className="animate-spin text-[#1e3a8a]" />}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-100 bg-gray-50/60">
                    <td colSpan={3} className="px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Visible total</td>
                    <td className="px-4 py-3 text-right font-extrabold text-gray-900 tabular-nums">{fmt$(sumBy(visible, r => netOf(r.rec)))}</td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Mobile */}
            <div className="md:hidden divide-y divide-gray-100">
              {visible.map(r => {
                const isSel = selected.has(r.key)
                const busy  = savingIds.has(r.key) || bulkBusy
                return (
                  <div key={r.key} className={`p-4 space-y-3 ${isSel ? 'bg-indigo-50/50' : ''}`}>
                    <div className="flex items-center gap-3">
                      <Checkbox checked={isSel} onChange={() => toggle(r.key)} />
                      <div className="flex-1 min-w-0"><PersonCell person={r.person} sub={fmtPeriod(r.rec.pay_period)} /></div>
                      <div className="text-right">
                        <p className="font-extrabold text-gray-900 tabular-nums">{fmt$(netOf(r.rec))}</p>
                        <div className="mt-1">{r.overdue ? overdueTag(r) : <PayBadge status={r.rec.status} />}</div>
                      </div>
                    </div>
                    <div className="pl-7"><StatusSwitch status={r.rec.status} busy={busy} onSet={s => setStatus([r], s)} stretch /></div>
                  </div>
                )
              })}
            </div>

            <ListFooter shown={visible.length} total={rows.length} />
          </>
        )}
      </div>

      <BulkBar count={selectedRows.length} busy={bulkBusy} onClear={clear}>
        {PAY_KEYS.map(k => (
          <BulkAction key={k} dot={PAY_STATUS[k].dot} title={`Mark as ${PAY_STATUS[k].label}`}
            onClick={() => setStatus(selectedRows, k, true)} disabled={bulkBusy || selectedRows.every(r => r.rec.status === k)}>
            {PAY_STATUS[k].label}
          </BulkAction>
        ))}
      </BulkBar>

      <Toast toast={toast} onDismiss={dismissToast} />
    </div>
  )
}
