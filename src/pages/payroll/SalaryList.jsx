/**
 * SalaryList — base-salary structure for every employee (employee_salary_config),
 * joined live with the employees directory and their payroll history.
 */
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import * as db from '../../lib/db'
import {
  Wallet, UserCheck, UserX, UserMinus, Banknote, Pencil, Plus, Download, RefreshCw,
  Percent, Trash2, CalendarRange, ArrowUpDown,
} from 'lucide-react'
import SalaryModal from './SalaryModal'
import {
  useToast, useArmed, useSelection, indexById, personOf, fullName, num, netOf, sumBy,
  fmt$, fmt$0, fmtK, fmtPeriod, fmtDate, downloadCSV, PAY_STATUS,
  Toast, HeroCard, RateRing, StatCard, SearchBox, DeptSelect, FilterPills, ToolButton,
  SkeletonRows, EmptyState, Checkbox, Th, PersonCell, BulkBar, BulkAction, ListFooter,
  Modal, ModalHeader, MoneyInput, ErrorNote, PrimaryButton,
} from './shared'

const YEAR = String(new Date().getFullYear())

const baseOr = (r, missing) => (r.cfg ? num(r.cfg.basic_salary) : missing)
const cmp    = (x, y) => (x === y ? 0 : x < y ? -1 : 1)

const SORTS = {
  name: { label: 'Name A–Z',           fn: (a, b) => a.person.name.localeCompare(b.person.name) },
  high: { label: 'Salary: high → low', fn: (a, b) => cmp(baseOr(b, -1), baseOr(a, -1)) },
  low:  { label: 'Salary: low → high', fn: (a, b) => cmp(baseOr(a, Infinity), baseOr(b, Infinity)) },
  ytd:  { label: 'Paid this year',     fn: (a, b) => b.ytd - a.ytd },
}

// ── Bulk adjust modal ──────────────────────────────────────────────────────────
const MODES = [
  { key: 'pct',   label: 'Raise by %'  },
  { key: 'add',   label: 'Raise by $'  },
  { key: 'set',   label: 'Set amount'  },
]

function BulkSalaryModal({ rows, onClose, onApply }) {
  const [mode,  setMode]  = useState('pct')
  const [value, setValue] = useState('')
  const [busy,  setBusy]  = useState(false)
  const [error, setError] = useState('')

  const v = num(value)
  const preview = rows.map(r => {
    const cur = r.cfg ? num(r.cfg.basic_salary) : null
    let next = null
    if (mode === 'set')           next = v
    else if (cur != null && mode === 'pct') next = cur * (1 + v / 100)
    else if (cur != null && mode === 'add') next = cur + v
    return { ...r, cur, next: next == null ? null : Math.round(next * 100) / 100 }
  })
  const affected = preview.filter(p => p.next != null && p.next !== p.cur)
  const skipped  = preview.filter(p => p.next == null).length
  const delta    = sumBy(affected, p => p.next - (p.cur ?? 0))
  const invalid  = affected.some(p => p.next <= 0)

  async function submit(e) {
    e.preventDefault()
    if (!value || !affected.length) { setError('Enter a value that changes at least one salary.'); return }
    if (invalid) { setError('Resulting salaries must be greater than zero.'); return }
    setBusy(true)
    try { await onApply(affected.map(p => ({ row: p, amount: p.next }))); onClose() }
    catch (err) { setError(err.message); setBusy(false) }
  }

  return (
    <Modal as="form" onSubmit={submit} onClose={onClose} maxWidth="540px">
      <ModalHeader title="Adjust salaries" sub={`${rows.length} employee${rows.length !== 1 ? 's' : ''} selected`} onClose={onClose} />
      <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-5">
        <div className="grid grid-cols-3 gap-1 p-1 bg-gray-50 rounded-xl border border-gray-100">
          {MODES.map(m => (
            <button key={m.key} type="button" onClick={() => { setMode(m.key); setError('') }}
              className={`py-2 rounded-lg text-xs font-semibold transition-all
                ${mode === m.key ? 'bg-white text-[#1e3a8a] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              {m.label}
            </button>
          ))}
        </div>

        {mode === 'pct' ? (
          <label className="block">
            <span className="text-xs font-medium text-gray-500">Percentage change</span>
            <div className="relative mt-1">
              <input type="number" step="0.1" value={value} onChange={e => { setValue(e.target.value); setError('') }}
                placeholder="e.g. 10  (use −5 for a cut)"
                className="w-full px-3 py-2.5 pr-8 text-sm rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/20 focus:border-[#1e3a8a] font-semibold" />
              <Percent size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
            </div>
          </label>
        ) : (
          <MoneyInput
            label={mode === 'add' ? 'Amount to add per month' : 'New monthly base salary'}
            value={value} onChange={v2 => { setValue(v2); setError('') }}
          />
        )}

        <div className="rounded-xl border border-gray-100 overflow-hidden">
          <div className="max-h-56 overflow-y-auto divide-y divide-gray-50">
            {preview.map(p => (
              <div key={p.key} className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-sm">
                <span className="font-medium text-gray-700 truncate">{p.person.name}</span>
                <span className="text-xs tabular-nums whitespace-nowrap">
                  <span className="text-gray-400">{p.cur != null ? fmt$(p.cur) : 'Not set'}</span>
                  {p.next != null ? (
                    <> <span className="text-gray-300 mx-1">→</span>
                      <b className={p.next > (p.cur ?? 0) ? 'text-emerald-600' : p.next < (p.cur ?? 0) ? 'text-rose-600' : 'text-gray-700'}>{fmt$(p.next)}</b></>
                  ) : <span className="text-gray-300 ml-2">skipped</span>}
                </span>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between px-3.5 py-2.5 bg-gray-50 text-xs">
            <span className="text-gray-500">{affected.length} will change{skipped ? ` · ${skipped} without salary skipped` : ''}</span>
            <span className={`font-bold ${delta >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {delta >= 0 ? '+' : '−'}{fmt$(Math.abs(delta))} / month
            </span>
          </div>
        </div>
        <ErrorNote>{error}</ErrorNote>
      </div>
      <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-100 shrink-0">
        <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-100 transition-colors">Cancel</button>
        <PrimaryButton type="submit" disabled={busy || !affected.length} busy={busy}>Apply to {affected.length}</PrimaryButton>
      </div>
    </Modal>
  )
}

// ════════════════════════════════════════════════════════════════════════════════
export default function SalaryList() {
  const [employees, setEmployees] = useState([])
  const [configs,   setConfigs]   = useState([])
  const [records,   setRecords]   = useState([])
  const [loading,   setLoading]   = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search,    setSearch]    = useState('')
  const [dept,      setDept]      = useState('all')
  const [filter,    setFilter]    = useState('all')
  const [sort,      setSort]      = useState('name')
  const [editing,   setEditing]   = useState(null)   // row key
  const [bulkOpen,  setBulkOpen]  = useState(false)
  const [bulkBusy,  setBulkBusy]  = useState(false)
  const [toast, showToast, dismissToast] = useToast()
  const [armed, fire] = useArmed()
  const { selected, toggle, toggleAll, clear } = useSelection()
  const reqId = useRef(0)

  const fetchData = useCallback(async (soft = false) => {
    const id = ++reqId.current
    soft ? setRefreshing(true) : setLoading(true)
    try {
      const [emps, cfgs, recs] = await Promise.all([db.getEmployees(), db.getSalaryConfigs(), db.getPayrollRecords()])
      if (id !== reqId.current) return
      setEmployees(emps); setConfigs(cfgs); setRecords(recs)
    } catch (err) {
      if (id === reqId.current) showToast('error', err.message)
    }
    if (id === reqId.current) { setLoading(false); setRefreshing(false) }
  }, [showToast])

  useEffect(() => { fetchData() }, [fetchData])

  // ── Derived ──
  const empMap = useMemo(() => indexById(employees), [employees])

  const recsByEmp = useMemo(() => {
    const m = {}
    records.forEach(r => {
      const id = r.employee_id ?? r.employee_salary_config?.employee_id
      if (id) (m[id] ??= []).push(r)
    })
    Object.values(m).forEach(list => list.sort((a, b) => (b.pay_period ?? '').localeCompare(a.pay_period ?? '')))
    return m
  }, [records])

  const rows = useMemo(() => {
    const cfgByEmp = {}
    configs.forEach(c => { if (c.employee_id && !cfgByEmp[c.employee_id]) cfgByEmp[c.employee_id] = c })
    const build = (key, empId, cfg, src) => {
      const person = personOf(src, empMap)
      const recs   = recsByEmp[empId] ?? []
      const emp    = empMap[empId]
      return {
        key, empId, cfg, recs, person,
        inactive: !emp || emp.status !== 'active',
        ytd:  sumBy(recs.filter(r => r.status === 'Paid' && r.pay_period?.startsWith(YEAR)), netOf),
        last: recs[0] ?? null,
      }
    }
    const list = employees
      .filter(e => e.status === 'active')
      .map(e => build(e.id, e.id, cfgByEmp[e.id] ?? null, { employee_id: e.id }))
    configs
      .filter(c => !c.employee_id || empMap[c.employee_id]?.status !== 'active')
      .forEach(c => list.push(build(`cfg-${c.id}`, c.employee_id, c, c)))
    return list
  }, [employees, configs, empMap, recsByEmp])

  const departments = useMemo(
    () => [...new Set(rows.map(r => r.person.dept).filter(Boolean))].sort(),
    [rows],
  )

  const scoped = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter(r =>
      (dept === 'all' || r.person.dept === dept) &&
      (!q || r.person.name.toLowerCase().includes(q) || r.person.job.toLowerCase().includes(q) || r.person.dept.toLowerCase().includes(q)),
    )
  }, [rows, search, dept])

  const matches = (r, f) =>
    f === 'all' ? true : f === 'set' ? !!r.cfg && !r.inactive : f === 'notset' ? !r.cfg : r.inactive

  const visible = useMemo(
    () => scoped.filter(r => matches(r, filter)).sort(SORTS[sort].fn),
    [scoped, filter, sort],
  )

  const count = (list, f) => list.filter(r => matches(r, f)).length

  const stats = useMemo(() => {
    const active     = rows.filter(r => !r.inactive)
    const configured = active.filter(r => r.cfg)
    const total      = sumBy(configured, r => num(r.cfg.basic_salary))
    return {
      active: active.length,
      configured: configured.length,
      notSet: active.length - configured.length,
      inactive: rows.length - active.length,
      total,
      avg: configured.length ? total / configured.length : 0,
      coverage: active.length ? Math.round((configured.length / active.length) * 100) : 0,
      ytd: sumBy(rows, r => r.ytd),
      ytdCount: records.filter(r => r.status === 'Paid' && r.pay_period?.startsWith(YEAR)).length,
    }
  }, [rows, records])

  const selectedRows  = rows.filter(r => selected.has(r.key))
  const allVisibleSel = visible.length > 0 && visible.every(r => selected.has(r.key))
  const editingRow    = editing ? rows.find(r => r.key === editing) : null

  // ── Mutations ──
  function configPayload(row, amount) {
    const emp = empMap[row.empId]
    return {
      ...(row.cfg ? { id: row.cfg.id } : {}),
      employee_id:   row.empId ?? row.cfg?.employee_id ?? null,
      employee_name: emp ? fullName(emp) : row.person.name,
      department:    emp?.departments?.name ?? row.person.dept ?? '',
      basic_salary:  amount,
    }
  }

  function mergeConfigs(saved) {
    setConfigs(list => {
      const byId = indexById(list)
      saved.forEach(s => { byId[s.id] = { ...(byId[s.id] ?? {}), ...s } })
      return Object.values(byId)
    })
  }

  async function saveOne(row, amount) {
    const saved = await db.batchSaveSalaryConfigs([configPayload(row, amount)])
    mergeConfigs(saved)
    showToast('success', `Salary ${row.cfg ? 'updated' : 'set'} for ${row.person.name.split(' ')[0]} — ${fmt$(amount)}`)
  }

  async function removeConfigs(targets) {
    await Promise.all(targets.map(r => db.deleteSalaryConfig(r.cfg.id)))
    const ids = new Set(targets.map(r => r.cfg.id))
    setConfigs(list => list.filter(c => !ids.has(c.id)))
  }

  async function applyBulk(items) {
    setBulkBusy(true)
    try {
      const saved = await db.batchSaveSalaryConfigs(items.map(({ row, amount }) => configPayload(row, amount)))
      mergeConfigs(saved)
      clear()
      showToast('success', `Updated ${items.length} salar${items.length !== 1 ? 'ies' : 'y'}`)
    } finally {
      setBulkBusy(false)
    }
  }

  async function bulkRemove() {
    const targets = selectedRows.filter(r => r.cfg)
    if (!targets.length || !fire('remove')) return
    setBulkBusy(true)
    try {
      await removeConfigs(targets)
      clear()
      showToast('success', `Removed ${targets.length} salary record${targets.length !== 1 ? 's' : ''}`)
    } catch (err) {
      showToast('error', err.message)
    }
    setBulkBusy(false)
  }

  function exportCSV() {
    downloadCSV(visible.map(r => ({
      Employee:     r.person.name,
      Department:   r.person.dept,
      'Job Title':  r.person.job,
      'Base Salary': r.cfg ? num(r.cfg.basic_salary) : '',
      Annual:       r.cfg ? num(r.cfg.basic_salary) * 12 : '',
      'Last Period': r.last ? fmtPeriod(r.last.pay_period) : '',
      'Last Net':   r.last ? netOf(r.last) : '',
      [`Paid ${YEAR}`]: r.ytd,
      Status:       r.inactive ? 'Inactive' : r.cfg ? 'Salary set' : 'Not set',
    })), `salary-list-${new Date().toISOString().slice(0, 10)}.csv`)
  }

  const FILTERS = [
    { key: 'all',    label: 'All',               dot: 'bg-gray-400',    count: scoped.length },
    { key: 'set',    label: 'Salary set',        dot: 'bg-emerald-500', count: count(scoped, 'set') },
    { key: 'notset', label: 'Not set',           dot: 'bg-amber-500',   count: count(scoped, 'notset') },
    { key: 'former', label: 'Inactive / former', dot: 'bg-gray-300',    count: count(scoped, 'former') },
  ]

  const toggleFilter = f => setFilter(cur => (cur === f ? 'all' : f))

  // ── Row bits ──
  const baseCell = r => r.cfg ? (
    <span className="font-bold text-gray-900 tabular-nums">{fmt$(r.cfg.basic_salary)}</span>
  ) : (
    <button onClick={() => setEditing(r.key)}
      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-50 text-amber-700 ring-1 ring-amber-200 hover:bg-amber-100 transition-colors">
      <Plus size={12} /> Set salary
    </button>
  )

  const lastCell = r => r.last ? (
    <div className="leading-tight">
      <p className="text-sm font-semibold text-gray-800 tabular-nums">{fmt$(netOf(r.last))}</p>
      <p className="text-[11px] text-gray-400 flex items-center gap-1">
        <span className={`w-1.5 h-1.5 rounded-full ${PAY_STATUS[r.last.status]?.dot ?? 'bg-gray-300'}`} />
        {fmtPeriod(r.last.pay_period)}
      </p>
    </div>
  ) : <span className="text-xs text-gray-300">No payroll yet</span>

  const inactiveTag = r => r.inactive && !r.person.former ? (
    <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-gray-100 text-gray-500 capitalize">
      {empMap[r.empId]?.status ?? 'inactive'}
    </span>
  ) : null

  // ── Render ──
  return (
    <div className="space-y-5 pb-24">

      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight">Salary structure</h2>
          <p className="text-sm text-gray-400 mt-1">
            Base monthly salary for each employee · used when generating payroll
          </p>
        </div>
      </div>

      {/* Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        <HeroCard
          ring={<RateRing pct={stats.coverage} label="set" />}
          eyebrow="Monthly base payroll"
          headline={fmt$(stats.total)}
          sub={`${stats.configured} of ${stats.active} active employees have a salary`}
          stats={[
            { label: 'Annual',  value: fmtK(stats.total * 12), Icon: CalendarRange },
            { label: 'Average', value: fmt$0(stats.avg),        Icon: Wallet },
          ]}
        />
        <StatCard label="Salary set" value={stats.configured} pct={stats.coverage}
          Icon={UserCheck} iconCls="bg-emerald-50 text-emerald-500" barCls="bg-emerald-500"
          active={filter === 'set'} onClick={() => toggleFilter('set')} />
        <StatCard label="Not set" value={stats.notSet} pct={stats.active ? Math.round((stats.notSet / stats.active) * 100) : 0}
          Icon={UserX} iconCls="bg-amber-50 text-amber-500" barCls="bg-amber-500"
          active={filter === 'notset'} onClick={() => toggleFilter('notset')} />
        <StatCard label="Inactive / former" value={stats.inactive} sub="with a salary record"
          Icon={UserMinus} iconCls="bg-gray-100 text-gray-500"
          active={filter === 'former'} onClick={() => toggleFilter('former')} />
        <StatCard label={`Paid in ${YEAR}`} value={fmtK(stats.ytd)}
          sub={`${stats.ytdCount} payslip${stats.ytdCount !== 1 ? 's' : ''} paid`}
          Icon={Banknote} iconCls="bg-indigo-50 text-indigo-500" />
      </div>

      {/* List */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 space-y-3">
          <div className="flex flex-col md:flex-row md:items-center gap-2.5">
            <SearchBox value={search} onChange={setSearch} placeholder="Search employee, job or department…" />
            <DeptSelect value={dept} onChange={setDept} options={departments} />
            <div className="relative md:w-48">
              <ArrowUpDown size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <select value={sort} onChange={e => setSort(e.target.value)}
                className="w-full pl-8 pr-3 py-2.5 text-sm rounded-xl border border-gray-200 bg-gray-50 text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/20 focus:border-[#1e3a8a]">
                {Object.entries(SORTS).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}
              </select>
            </div>
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
            title={rows.length === 0 ? 'No active employees yet' : 'No employees match these filters'}
            sub={rows.length === 0 ? 'Add employees first, then set their base salary here.' : null}
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
                    <Th>Employee</Th><Th right>Base salary</Th><Th right>Annual</Th>
                    <Th>Last payroll</Th><Th right>Paid {YEAR}</Th><Th>Updated</Th><Th />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {visible.map(r => {
                    const isSel = selected.has(r.key)
                    return (
                      <tr key={r.key} className={`transition-colors ${isSel ? 'bg-indigo-50/50' : 'hover:bg-gray-50/60'} ${r.inactive ? 'opacity-70' : ''}`}>
                        <td className="pl-5 pr-2 py-3"><Checkbox checked={isSel} onChange={() => toggle(r.key)} /></td>
                        <td className="px-4 py-3"><PersonCell person={r.person} extra={inactiveTag(r)} /></td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">{baseCell(r)}</td>
                        <td className="px-4 py-3 text-right whitespace-nowrap text-gray-500 tabular-nums">
                          {r.cfg ? fmt$0(num(r.cfg.basic_salary) * 12) : '—'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">{lastCell(r)}</td>
                        <td className="px-4 py-3 text-right whitespace-nowrap font-medium text-gray-700 tabular-nums">
                          {r.ytd ? fmt$(r.ytd) : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-400">
                          {r.cfg ? fmtDate(r.cfg.updated_at ?? r.cfg.created_at) : '—'}
                        </td>
                        <td className="pr-5 pl-2 py-3 text-right">
                          <button onClick={() => setEditing(r.key)} title="Edit salary"
                            className="w-8 h-8 rounded-lg inline-flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-[#1e3a8a] transition-colors">
                            <Pencil size={15} />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile */}
            <div className="md:hidden divide-y divide-gray-100">
              {visible.map(r => {
                const isSel = selected.has(r.key)
                return (
                  <div key={r.key} className={`p-4 space-y-3 ${isSel ? 'bg-indigo-50/50' : ''}`}>
                    <div className="flex items-center gap-3">
                      <Checkbox checked={isSel} onChange={() => toggle(r.key)} />
                      <div className="flex-1 min-w-0"><PersonCell person={r.person} extra={inactiveTag(r)} /></div>
                      <button onClick={() => setEditing(r.key)}
                        className="w-9 h-9 rounded-xl border border-gray-100 bg-gray-50 flex items-center justify-center text-gray-500 shrink-0">
                        <Pencil size={14} />
                      </button>
                    </div>
                    <div className="flex items-center justify-between gap-3 pl-7">
                      <div>
                        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Base</p>
                        <div className="mt-0.5">{baseCell(r)}</div>
                      </div>
                      <div className="text-right">{lastCell(r)}</div>
                    </div>
                  </div>
                )
              })}
            </div>

            <ListFooter shown={visible.length} total={rows.length} noun="employees"
              right={<span>Visible base total <b className="text-gray-700">{fmt$(sumBy(visible, r => num(r.cfg?.basic_salary)))}</b></span>} />
          </>
        )}
      </div>

      <BulkBar count={selectedRows.length} busy={bulkBusy} onClear={clear}>
        <BulkAction Icon={Percent} onClick={() => setBulkOpen(true)} disabled={bulkBusy}>Adjust salary</BulkAction>
        <BulkAction Icon={Trash2} danger onClick={bulkRemove} disabled={bulkBusy || !selectedRows.some(r => r.cfg)}>
          {armed === 'remove' ? `Confirm · ${selectedRows.filter(r => r.cfg).length}` : 'Remove salary'}
        </BulkAction>
      </BulkBar>

      {editingRow && (
        <SalaryModal
          person={editingRow.person}
          config={editingRow.cfg}
          history={editingRow.recs}
          onClose={() => setEditing(null)}
          onSave={amount => saveOne(editingRow, amount)}
          onDelete={async () => {
            await removeConfigs([editingRow])
            showToast('success', `Salary removed for ${editingRow.person.name.split(' ')[0]}`)
          }}
        />
      )}

      {bulkOpen && (
        <BulkSalaryModal rows={selectedRows} onClose={() => setBulkOpen(false)} onApply={applyBulk} />
      )}

      <Toast toast={toast} onDismiss={dismissToast} />
    </div>
  )
}
