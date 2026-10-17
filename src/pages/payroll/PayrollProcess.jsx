/**
 * PayrollProcess — monthly payroll run.
 * One row per active employee for the chosen period: generate drafts from the
 * salary structure, adjust overtime / bonus / deductions / tax (with an
 * attendance-based deduction hint), then approve → mark paid.
 */
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import * as db from '../../lib/db'
import {
  Play, Pencil, Download, RefreshCw, CircleDashed, Clock, BadgeCheck, FileClock,
  ArrowRight, Undo2, Trash2, Info, AlertTriangle, Plus, TrendingUp, TrendingDown,
  StickyNote, CalendarCheck, Lock, Wallet, Loader2,
} from 'lucide-react'
import SalaryModal from './SalaryModal'
import {
  useToast, useArmed, useSelection, indexById, personOf, recEmpId, fullName,
  num, grossOf, deductOf, netOf, sumBy, computeNet, statusPatch,
  fmt$, fmt$0, fmtK, fmtMonth, fmtDate, periodOf, currentMonth, downloadCSV, PAY_STATUS,
  Toast, HeroCard, RateRing, StatCard, MonthPicker, SearchBox, DeptSelect, FilterPills,
  ToolButton, SkeletonRows, EmptyState, Checkbox, Th, PersonCell, PayBadge, BulkBar, BulkAction,
  ListFooter, Modal, ModalHeader, MoneyInput, ErrorNote, PrimaryButton, INPUT_CLS,
} from './shared'

const DAYS_PER_MONTH = 30
const ATT_KEYS = [
  ['present',  'Present',  'text-emerald-600'],
  ['late',     'Late',     'text-amber-600'],
  ['half_day', 'Half day', 'text-sky-600'],
  ['absent',   'Absent',   'text-rose-600'],
  ['holiday',  'Holiday',  'text-violet-600'],
]

const STATE_META = {
  pending:  { label: 'Not generated', dot: 'bg-gray-300' },
  nosalary: { label: 'No salary',     dot: 'bg-amber-400' },
  Unpaid:     { label: 'Draft',       dot: PAY_STATUS.Unpaid.dot },
  Processing: { label: 'Processing',  dot: PAY_STATUS.Processing.dot },
  Paid:       { label: 'Paid',        dot: PAY_STATUS.Paid.dot },
}

const round2 = n => Math.round(n * 100) / 100

// ── Record modal (create custom draft / edit draft) ───────────────────────────
function RecordModal({ row, monthLabel, att, onClose, onSave, onStatus, onDelete }) {
  const rec    = row.rec
  const locked = rec && rec.status !== 'Unpaid'
  const cfgBase = num(row.cfg?.basic_salary)
  const [form, setForm] = useState({
    basic_salary: rec ? num(rec.basic_salary) : cfgBase,
    overtime:     rec?.overtime   ? String(rec.overtime)   : '',
    bonus:        rec?.bonus      ? String(rec.bonus)      : '',
    deductions:   rec?.deductions ? String(rec.deductions) : '',
    tax:          rec?.tax        ? String(rec.tax)        : '',
    note:         rec?.note ?? '',
  })
  const [busy,    setBusy]    = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [error,   setError]   = useState('')
  const set = patch => { setForm(f => ({ ...f, ...patch })); setError('') }

  const fields = {
    basic_salary: num(form.basic_salary),
    overtime:     num(form.overtime),
    bonus:        num(form.bonus),
    deductions:   num(form.deductions),
    tax:          num(form.tax),
  }
  const net        = computeNet(fields)
  const dailyRate  = fields.basic_salary / DAYS_PER_MONTH
  const missedDays = (att?.absent ?? 0) + (att?.half_day ?? 0) / 2
  const suggested  = round2(missedDays * dailyRate)
  const baseStale  = row.cfg && fields.basic_salary !== cfgBase

  async function submit(e) {
    e.preventDefault()
    if (locked) return
    if (net < 0) { setError('Deductions and tax cannot exceed gross pay.'); return }
    setBusy(true)
    try { await onSave(row, { ...fields, note: form.note.trim() }); onClose() }
    catch (err) { setError(err.message); setBusy(false) }
  }

  async function run(fn, close = true) {
    setBusy(true)
    try { await fn(); close ? onClose() : setBusy(false) }
    catch (err) { setError(err.message); setBusy(false) }
  }

  return (
    <Modal as="form" onSubmit={submit} onClose={onClose} maxWidth="560px">
      <ModalHeader
        person={row.person}
        sub={`${monthLabel} · ${rec ? (rec.status === 'Unpaid' ? 'Draft' : rec.status) : 'New payroll record'}`}
        onClose={onClose}
      />

      <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-5">
        {locked && (
          <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800">
            <span className="flex items-center gap-2"><Lock size={14} /> {rec.status} records are locked.</span>
            <button type="button" onClick={() => run(() => onStatus([row], 'Unpaid'), false)} disabled={busy}
              className="px-2.5 py-1 rounded-lg bg-amber-500 text-white font-semibold hover:bg-amber-600 transition-colors whitespace-nowrap">
              Revert to draft
            </button>
          </div>
        )}

        {/* Base */}
        <div className="flex items-center justify-between gap-3 rounded-xl bg-gray-50 px-4 py-3">
          <div>
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Base salary</p>
            <p className="text-lg font-extrabold text-gray-900 mt-0.5 tabular-nums">{fmt$(fields.basic_salary)}</p>
          </div>
          {baseStale && !locked && (
            <button type="button" onClick={() => set({ basic_salary: cfgBase })}
              className="text-right text-xs font-semibold text-[#1e3a8a] hover:underline">
              Use current salary<br /><span className="text-gray-500 font-medium">{fmt$(cfgBase)}</span>
            </button>
          )}
        </div>

        {/* Amounts */}
        <div className="grid grid-cols-2 gap-3">
          <MoneyInput label="Overtime"   value={form.overtime}   onChange={v => set({ overtime: v })}   tone="text-emerald-600" disabled={locked} />
          <MoneyInput label="Bonus"      value={form.bonus}      onChange={v => set({ bonus: v })}      tone="text-violet-600"  disabled={locked} />
          <MoneyInput label="Deductions" value={form.deductions} onChange={v => set({ deductions: v })} tone="text-rose-600"    disabled={locked} />
          <MoneyInput label="Tax"        value={form.tax}        onChange={v => set({ tax: v })}        tone="text-orange-600"  disabled={locked} />
        </div>

        {/* Attendance */}
        {att && (
          <div className="rounded-xl border border-gray-100 p-4">
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
              <CalendarCheck size={12} /> Attendance · {monthLabel}
            </p>
            <div className="grid grid-cols-5 gap-2 mt-3">
              {ATT_KEYS.map(([k, label, cls]) => (
                <div key={k} className="text-center">
                  <p className={`text-lg font-extrabold leading-none ${cls}`}>{att[k] ?? 0}</p>
                  <p className="text-[10px] text-gray-400 mt-1">{label}</p>
                </div>
              ))}
            </div>
            {suggested > 0 && !locked && (
              <div className="flex items-center justify-between gap-3 mt-3 pt-3 border-t border-gray-100 text-xs">
                <span className="text-gray-500">
                  {missedDays} missed day{missedDays !== 1 ? 's' : ''} × {fmt$(dailyRate)}/day
                </span>
                <button type="button" onClick={() => set({ deductions: String(suggested) })}
                  className="px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 ring-1 ring-rose-200 font-semibold hover:bg-rose-100 transition-colors whitespace-nowrap">
                  Deduct {fmt$(suggested)}
                </button>
              </div>
            )}
          </div>
        )}

        <label className="block">
          <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Note</span>
          <textarea rows={2} maxLength={300} value={form.note} disabled={locked}
            onChange={e => set({ note: e.target.value })}
            placeholder="e.g. Includes Eid bonus · 2 days unpaid leave"
            className={`${INPUT_CLS} mt-2 resize-none disabled:opacity-60`} />
        </label>

        {/* Breakdown */}
        <div className="rounded-2xl px-5 py-4 text-white bg-gradient-to-br from-[#1e3a8a] to-indigo-900 shadow-lg">
          <div className="flex items-center justify-between text-xs text-indigo-200">
            <span>Gross {fmt$(grossOf(fields))}</span>
            <span>Deductions −{fmt$(deductOf(fields))}</span>
          </div>
          <div className="flex items-end justify-between mt-2">
            <span className="text-[11px] font-semibold text-indigo-200 uppercase tracking-widest">Net pay</span>
            <span className={`text-3xl font-extrabold tracking-tight tabular-nums ${net < 0 ? 'text-rose-300' : ''}`}>{fmt$(net)}</span>
          </div>
        </div>

        <ErrorNote>{error}</ErrorNote>
      </div>

      <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-gray-100 shrink-0">
        {rec?.status === 'Unpaid' ? (
          <button type="button" disabled={busy}
            onClick={() => (confirm ? run(() => onDelete([row])) : setConfirm(true))}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors disabled:opacity-50
              ${confirm ? 'bg-red-500 text-white hover:bg-red-600' : 'text-red-500 hover:bg-red-50'}`}>
            <Trash2 size={14} /> {confirm ? 'Confirm delete' : 'Delete draft'}
          </button>
        ) : <span />}
        <div className="flex items-center gap-2">
          <button type="button" onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-100 transition-colors">
            {locked ? 'Close' : 'Cancel'}
          </button>
          {!locked && <PrimaryButton type="submit" disabled={busy} busy={busy}>{rec ? 'Save' : 'Create draft'}</PrimaryButton>}
        </div>
      </div>
    </Modal>
  )
}

// ════════════════════════════════════════════════════════════════════════════════
export default function PayrollProcess() {
  const [month,      setMonth]      = useState(currentMonth())
  const [employees,  setEmployees]  = useState([])
  const [configs,    setConfigs]    = useState([])
  const [records,    setRecords]    = useState([])
  const [attendance, setAttendance] = useState([])
  const [loading,    setLoading]    = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [savingIds,  setSavingIds]  = useState(() => new Set())
  const [bulkBusy,   setBulkBusy]   = useState(false)
  const [search,     setSearch]     = useState('')
  const [dept,       setDept]       = useState('all')
  const [filter,     setFilter]     = useState('all')
  const [editing,    setEditing]    = useState(null)   // row key
  const [salaryFor,  setSalaryFor]  = useState(null)   // row key
  const [toast, showToast, dismissToast] = useToast()
  const [armed, fire] = useArmed()
  const { selected, toggle, toggleAll, clear } = useSelection()
  const reqId = useRef(0)

  const period     = periodOf(month)
  const monthLabel = fmtMonth(month)

  const fetchData = useCallback(async (soft = false) => {
    const id = ++reqId.current
    soft ? setRefreshing(true) : setLoading(true)
    try {
      const [emps, cfgs, recs, att] = await Promise.all([
        db.getEmployees(),
        db.getSalaryConfigs(),
        db.getPayrollRecordsByPeriod(period),
        db.getAttendanceRange(`${month}-01`, `${month}-31`),
      ])
      if (id !== reqId.current) return
      setEmployees(emps); setConfigs(cfgs); setRecords(recs); setAttendance(att)
    } catch (err) {
      if (id === reqId.current) showToast('error', err.message)
    }
    if (id === reqId.current) { setLoading(false); setRefreshing(false) }
  }, [month, period, showToast])

  useEffect(() => { fetchData(); clear() }, [fetchData]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived ──
  const empMap = useMemo(() => indexById(employees), [employees])

  const cfgByEmp = useMemo(() => {
    const m = {}
    configs.forEach(c => { if (c.employee_id && !m[c.employee_id]) m[c.employee_id] = c })
    return m
  }, [configs])

  const attByEmp = useMemo(() => {
    const m = {}
    attendance.forEach(a => {
      const c = (m[a.employee_id] ??= {})
      c[a.status] = (c[a.status] ?? 0) + 1
    })
    return m
  }, [attendance])

  const rows = useMemo(() => {
    const active = employees.filter(e => e.status === 'active')
    const activeIds = new Set(active.map(e => e.id))
    const recByEmp = {}
    const extra = []
    records.forEach(r => {
      const id = recEmpId(r)
      if (id && activeIds.has(id) && !recByEmp[id]) recByEmp[id] = r
      else extra.push(r)
    })
    const list = active.map(e => ({
      key: e.id, empId: e.id, person: personOf({ employee_id: e.id }, empMap),
      cfg: cfgByEmp[e.id] ?? null, rec: recByEmp[e.id] ?? null,
    }))
    extra.forEach(r => {
      const id = recEmpId(r)
      list.push({ key: `rec-${r.id}`, empId: id, person: personOf(r, empMap), cfg: cfgByEmp[id] ?? null, rec: r, extra: true })
    })
    return list.map(r => ({ ...r, state: r.rec?.status ?? (r.cfg ? 'pending' : 'nosalary') }))
  }, [employees, records, empMap, cfgByEmp])

  const departments = useMemo(
    () => [...new Set(rows.map(r => r.person.dept).filter(Boolean))].sort(),
    [rows],
  )

  const scoped = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter(r =>
      (dept === 'all' || r.person.dept === dept) &&
      (!q || r.person.name.toLowerCase().includes(q) || r.person.job.toLowerCase().includes(q)),
    )
  }, [rows, search, dept])

  const visible = useMemo(
    () => (filter === 'all' ? scoped : scoped.filter(r => r.state === filter)),
    [scoped, filter],
  )

  const countIn = (list, s) => list.filter(r => r.state === s).length

  const stats = useMemo(() => {
    const gen      = rows.filter(r => r.rec)
    const net      = sumBy(gen, r => netOf(r.rec))
    const paidNet  = sumBy(gen.filter(r => r.state === 'Paid'), r => netOf(r.rec))
    const amt      = s => sumBy(rows.filter(r => r.state === s), r => netOf(r.rec))
    const pending  = rows.filter(r => r.state === 'pending')
    return {
      total:     rows.length,
      generated: gen.length,
      net, paidNet,
      gross:     sumBy(gen, r => grossOf(r.rec)),
      deduct:    sumBy(gen, r => deductOf(r.rec)),
      paidPct:   net > 0 ? Math.round((paidNet / net) * 100) : 0,
      pending:   pending.length,
      projected: sumBy(pending, r => num(r.cfg.basic_salary)),
      nosalary:  countIn(rows, 'nosalary'),
      Unpaid:     { n: countIn(rows, 'Unpaid'),     amt: amt('Unpaid') },
      Processing: { n: countIn(rows, 'Processing'), amt: amt('Processing') },
      Paid:       { n: countIn(rows, 'Paid'),       amt: paidNet },
    }
  }, [rows])

  const staleDrafts = rows.filter(r => r.state === 'Unpaid' && r.cfg && num(r.rec.basic_salary) !== num(r.cfg.basic_salary))
  const pendingScoped = scoped.filter(r => r.state === 'pending')
  const selectedRows  = rows.filter(r => selected.has(r.key))
  const allVisibleSel = visible.length > 0 && visible.every(r => selected.has(r.key))
  const pick = s => selectedRows.filter(r => r.state === s)

  // ── Mutations ──
  const markBusy = (keys, on) => setSavingIds(s => {
    const n = new Set(s); keys.forEach(k => (on ? n.add(k) : n.delete(k))); return n
  })

  const mergeRecords = patches => setRecords(list => list.map(r => (patches[r.id] ? { ...r, ...patches[r.id] } : r)))

  async function withRows(targets, fn) {
    const keys = targets.map(r => r.key)
    const bulk = targets.length > 1
    bulk ? setBulkBusy(true) : markBusy(keys, true)
    try { await fn() }
    catch (err) { showToast('error', err.message) }
    bulk ? setBulkBusy(false) : markBusy(keys, false)
  }

  async function generate(targets) {
    const list = targets.filter(r => r.state === 'pending')
    if (!list.length) return
    await withRows(list, async () => {
      const configsMap = Object.fromEntries(list.map(r => [r.cfg.id, r.cfg]))
      const { newRows } = await db.batchUpsertPayrollRecords(list.map(r => ({
        salary_config_id: r.cfg.id,
        employee_id:      r.empId,
        pay_period:       period,
        basic_salary:     num(r.cfg.basic_salary),
        overtime: 0, bonus: 0, deductions: 0, tax: 0,
      })), period, configsMap)
      setRecords(await db.getPayrollRecordsByPeriod(period))
      clear()
      showToast('success', `${newRows.length} draft${newRows.length !== 1 ? 's' : ''} generated for ${monthLabel}`)
    })
  }

  function handleGenerateAll() {
    if (fire('generate')) generate(pendingScoped)
  }

  async function setStatus(targets, status) {
    const list = targets.filter(r => r.rec && r.rec.status !== status)
    if (!list.length) return
    const run = async () => {
      const patches = Object.fromEntries(list.map(r => [r.rec.id, statusPatch(r.rec, status)]))
      await db.batchUpdatePayrollRecords(Object.entries(patches).map(([id, p]) => ({ id, ...p })))
      mergeRecords(patches)
      clear()
      showToast('success', list.length === 1
        ? `${list[0].person.name.split(' ')[0]} → ${STATE_META[status].label}`
        : `${list.length} records → ${STATE_META[status].label}`)
    }
    // Called from the modal: let errors surface there
    if (editing) return run()
    await withRows(list, run)
  }

  async function deleteRows(targets) {
    const list = targets.filter(r => r.rec?.status === 'Unpaid')
    if (!list.length) return
    const run = async () => {
      const ids = new Set(list.map(r => r.rec.id))
      await db.batchDeletePayrollRecords([...ids])
      setRecords(rs => rs.filter(r => !ids.has(r.id)))
      clear()
      showToast('success', `${list.length} draft${list.length !== 1 ? 's' : ''} deleted`)
    }
    if (editing) return run()
    await withRows(list, run)
  }

  async function saveRecord(row, fields) {
    if (row.rec) {
      await db.updatePayrollRecord(row.rec.id, fields)
      mergeRecords({ [row.rec.id]: { ...fields, net_salary: computeNet(fields) } })
    } else {
      const rec = await db.addPayrollRecord({
        salary_config_id: row.cfg.id, employee_id: row.empId, pay_period: period, ...fields,
      })
      setRecords(rs => [...rs, rec])
    }
    showToast('success', `Payroll ${row.rec ? 'updated' : 'created'} for ${row.person.name.split(' ')[0]}`)
  }

  async function syncBase() {
    if (!fire('sync')) return
    setBulkBusy(true)
    try {
      const items = staleDrafts.map(r => ({
        id: r.rec.id,
        basic_salary: num(r.cfg.basic_salary),
        overtime: num(r.rec.overtime), bonus: num(r.rec.bonus),
        deductions: num(r.rec.deductions), tax: num(r.rec.tax),
      }))
      await db.batchUpdatePayrollRecords(items)
      mergeRecords(Object.fromEntries(items.map(({ id, ...f }) => [id, { ...f, net_salary: computeNet(f) }])))
      showToast('success', `${items.length} draft${items.length !== 1 ? 's' : ''} updated to current salary`)
    } catch (err) {
      showToast('error', err.message)
    }
    setBulkBusy(false)
  }

  async function saveSalary(row, amount) {
    const emp = empMap[row.empId]
    const saved = await db.batchSaveSalaryConfigs([{
      ...(row.cfg ? { id: row.cfg.id } : {}),
      employee_id:   row.empId,
      employee_name: emp ? fullName(emp) : row.person.name,
      department:    emp?.departments?.name ?? row.person.dept ?? '',
      basic_salary:  amount,
    }])
    setConfigs(list => [...list.filter(c => c.id !== saved[0].id), { ...(row.cfg ?? {}), ...saved[0] }])
    showToast('success', `Salary set for ${row.person.name.split(' ')[0]} — ${fmt$(amount)}`)
  }

  function exportCSV() {
    downloadCSV(visible.map(r => {
      const src = r.rec ?? { basic_salary: r.cfg?.basic_salary }
      return {
        Employee:   r.person.name,
        Department: r.person.dept,
        Period:     monthLabel,
        Basic:      num(src.basic_salary),
        Overtime:   num(src.overtime),
        Bonus:      num(src.bonus),
        Gross:      grossOf(src),
        Deductions: num(src.deductions),
        Tax:        num(src.tax),
        'Net Pay':  r.rec ? netOf(r.rec) : '',
        Status:     STATE_META[r.state].label,
        Note:       r.rec?.note ?? '',
      }
    }), `payroll-${month}.csv`)
  }

  const FILTERS = ['all', 'pending', 'Unpaid', 'Processing', 'Paid', 'nosalary']
    .map(k => k === 'all'
      ? { key: k, label: 'All', dot: 'bg-gray-400', count: scoped.length }
      : { key: k, label: STATE_META[k].label, dot: STATE_META[k].dot, count: countIn(scoped, k) })
    .filter(f => f.key !== 'nosalary' || f.count > 0)

  const toggleFilter = f => setFilter(cur => (cur === f ? 'all' : f))
  const pctOf = n => (stats.total ? Math.round((n / stats.total) * 100) : 0)

  // ── Row bits ──
  function actionFor(r, stretch) {
    const busy = savingIds.has(r.key) || bulkBusy
    const base = `flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors disabled:opacity-40 ${stretch ? 'flex-1 py-2.5' : ''}`
    switch (r.state) {
      case 'pending':
        return <button disabled={busy} onClick={() => generate([r])} className={`${base} bg-indigo-50 text-[#1e3a8a] ring-1 ring-indigo-200 hover:bg-indigo-100`}><Play size={12} /> Generate</button>
      case 'nosalary':
        return <button disabled={busy} onClick={() => setSalaryFor(r.key)} className={`${base} bg-amber-50 text-amber-700 ring-1 ring-amber-200 hover:bg-amber-100`}><Plus size={12} /> Set salary</button>
      case 'Unpaid':
        return <button disabled={busy} onClick={() => setStatus([r], 'Processing')} className={`${base} bg-amber-50 text-amber-700 ring-1 ring-amber-200 hover:bg-amber-100`}><ArrowRight size={12} /> Approve</button>
      case 'Processing':
        return <button disabled={busy} onClick={() => setStatus([r], 'Paid')} className={`${base} bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-100`}><BadgeCheck size={12} /> Mark paid</button>
      default:
        return <span className={`${stretch ? 'flex-1 justify-center' : ''} inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 whitespace-nowrap`}><BadgeCheck size={13} /> {fmtDate(r.rec.paid_at ?? r.rec.processed_at)}</span>
    }
  }

  const statusCell = r => savingIds.has(r.key)
    ? <Loader2 size={15} className="animate-spin text-[#1e3a8a]" />
    : r.state === 'nosalary'
      ? <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold bg-amber-50 text-amber-700 ring-1 ring-amber-200 whitespace-nowrap">No salary</span>
      : <PayBadge status={r.rec?.status} />

  const addCell = src => {
    const v = num(src.overtime) + num(src.bonus)
    return v ? <span className="text-emerald-600 font-semibold" title={`Overtime ${fmt$(src.overtime)} · Bonus ${fmt$(src.bonus)}`}>+{fmt$(v)}</span> : <span className="text-gray-300">—</span>
  }
  const dedCell = src => {
    const v = deductOf(src)
    return v ? <span className="text-rose-600 font-semibold" title={`Deductions ${fmt$(src.deductions)} · Tax ${fmt$(src.tax)}`}>−{fmt$(v)}</span> : <span className="text-gray-300">—</span>
  }
  const netCell = r => r.rec
    ? <span className="font-extrabold text-gray-900">{fmt$(netOf(r.rec))}</span>
    : r.cfg ? <span className="text-gray-400 italic" title="Projected from base salary">≈ {fmt$(r.cfg.basic_salary)}</span> : <span className="text-gray-300">—</span>

  const noteIcon = r => r.rec?.note
    ? <span title={r.rec.note} className="text-gray-300 hover:text-gray-500 cursor-help"><StickyNote size={13} /></span>
    : null

  const openEdit = r => (r.state === 'nosalary' ? setSalaryFor(r.key) : setEditing(r.key))

  const editingRow = editing ? rows.find(r => r.key === editing) : null
  const salaryRow  = salaryFor ? rows.find(r => r.key === salaryFor) : null

  // ── Render ──
  return (
    <div className="space-y-5 pb-24">

      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight">{monthLabel} payroll</h2>
            {month === currentMonth() && (
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200">Current</span>
            )}
            {month > currentMonth() && (
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-600 ring-1 ring-amber-200">Upcoming</span>
            )}
          </div>
          <p className="text-sm text-gray-400 mt-1">
            {stats.generated} of {stats.total} employees generated · Generate → Approve → Mark paid
          </p>
        </div>
        <MonthPicker value={month} onChange={setMonth} />
      </div>

      {/* Banners */}
      {!loading && stats.nosalary > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-800">
          <span className="flex items-center gap-2.5"><Info size={16} className="shrink-0" />
            {stats.nosalary} active employee{stats.nosalary !== 1 ? 's have' : ' has'} no base salary and can't be included yet.
          </span>
          <button onClick={() => setFilter('nosalary')} className="text-xs font-bold hover:underline whitespace-nowrap">Show them</button>
        </div>
      )}
      {!loading && staleDrafts.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-3 rounded-xl bg-sky-50 border border-sky-200 text-sm text-sky-800">
          <span className="flex items-center gap-2.5"><AlertTriangle size={16} className="shrink-0" />
            {staleDrafts.length} draft{staleDrafts.length !== 1 ? 's use' : ' uses'} an outdated base salary.
          </span>
          <button onClick={syncBase} disabled={bulkBusy}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors disabled:opacity-50
              ${armed === 'sync' ? 'bg-sky-600 text-white' : 'bg-white ring-1 ring-sky-200 hover:bg-sky-100'}`}>
            {armed === 'sync' ? 'Confirm update' : 'Update to current salary'}
          </button>
        </div>
      )}

      {/* Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        <HeroCard
          ring={<RateRing pct={stats.paidPct} label="paid" />}
          eyebrow="Net payroll"
          headline={fmt$(stats.net)}
          sub={stats.pending ? `+ ${fmt$0(stats.projected)} not yet generated` : `${fmt$(stats.paidNet)} paid out`}
          stats={[
            { label: 'Gross',      value: fmtK(stats.gross),  Icon: TrendingUp },
            { label: 'Deductions', value: fmtK(stats.deduct), Icon: TrendingDown },
          ]}
        />
        <StatCard label="Not generated" value={stats.pending} sub={stats.pending ? `≈ ${fmt$0(stats.projected)}` : 'All set'}
          pct={pctOf(stats.pending)} Icon={FileClock} iconCls="bg-gray-100 text-gray-500" barCls="bg-gray-400"
          active={filter === 'pending'} onClick={() => toggleFilter('pending')} />
        <StatCard label="Drafts" value={stats.Unpaid.n} sub={fmt$0(stats.Unpaid.amt)}
          pct={pctOf(stats.Unpaid.n)} Icon={CircleDashed} iconCls={PAY_STATUS.Unpaid.icon} barCls={PAY_STATUS.Unpaid.bar}
          active={filter === 'Unpaid'} onClick={() => toggleFilter('Unpaid')} />
        <StatCard label="Processing" value={stats.Processing.n} sub={fmt$0(stats.Processing.amt)}
          pct={pctOf(stats.Processing.n)} Icon={Clock} iconCls={PAY_STATUS.Processing.icon} barCls={PAY_STATUS.Processing.bar}
          active={filter === 'Processing'} onClick={() => toggleFilter('Processing')} />
        <StatCard label="Paid" value={stats.Paid.n} sub={fmt$0(stats.Paid.amt)}
          pct={pctOf(stats.Paid.n)} Icon={BadgeCheck} iconCls={PAY_STATUS.Paid.icon} barCls={PAY_STATUS.Paid.bar}
          active={filter === 'Paid'} onClick={() => toggleFilter('Paid')} />
      </div>

      {/* List */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 space-y-3">
          <div className="flex flex-col md:flex-row md:items-center gap-2.5">
            <SearchBox value={search} onChange={setSearch} placeholder="Search employee or job title…" />
            <DeptSelect value={dept} onChange={setDept} options={departments} />
            <div className="flex items-center gap-2">
              {pendingScoped.length > 0 && (
                <ToolButton onClick={handleGenerateAll} disabled={bulkBusy} tone={armed === 'generate' ? 'armed' : 'success'} className="flex-1 md:flex-none">
                  {bulkBusy ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />}
                  {armed === 'generate' ? `Confirm · ${pendingScoped.length}` : `Generate ${pendingScoped.length}`}
                </ToolButton>
              )}
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
            title={rows.length === 0 ? 'No active employees found' : 'Nothing matches these filters'}
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
                    <Th>Employee</Th><Th right>Base</Th><Th right>Additions</Th><Th right>Deductions</Th>
                    <Th right>Net pay</Th><Th>Status</Th><Th>Next step</Th><Th />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {visible.map(r => {
                    const isSel = selected.has(r.key)
                    const src   = r.rec ?? {}
                    return (
                      <tr key={r.key} className={`transition-colors ${isSel ? 'bg-indigo-50/50' : 'hover:bg-gray-50/60'}`}>
                        <td className="pl-5 pr-2 py-3"><Checkbox checked={isSel} onChange={() => toggle(r.key)} /></td>
                        <td className="px-4 py-3"><PersonCell person={r.person} extra={noteIcon(r)} /></td>
                        <td className="px-4 py-3 text-right whitespace-nowrap tabular-nums text-gray-700">
                          {r.rec ? fmt$(r.rec.basic_salary) : r.cfg ? <span className="text-gray-400">{fmt$(r.cfg.basic_salary)}</span> : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap tabular-nums">{addCell(src)}</td>
                        <td className="px-4 py-3 text-right whitespace-nowrap tabular-nums">{dedCell(src)}</td>
                        <td className="px-4 py-3 text-right whitespace-nowrap tabular-nums">{netCell(r)}</td>
                        <td className="px-4 py-3">{statusCell(r)}</td>
                        <td className="px-4 py-3">{actionFor(r)}</td>
                        <td className="pr-5 pl-2 py-3 text-right">
                          <button onClick={() => openEdit(r)} title={r.state === 'nosalary' ? 'Set salary' : 'Edit amounts'}
                            className="w-8 h-8 rounded-lg inline-flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-[#1e3a8a] transition-colors">
                            <Pencil size={15} />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-100 bg-gray-50/60 text-sm">
                    <td colSpan={2} className="px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Visible total</td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-700 tabular-nums">{fmt$(sumBy(visible, r => num(r.rec?.basic_salary)))}</td>
                    <td className="px-4 py-3 text-right font-semibold text-emerald-600 tabular-nums">+{fmt$(sumBy(visible, r => num(r.rec?.overtime) + num(r.rec?.bonus)))}</td>
                    <td className="px-4 py-3 text-right font-semibold text-rose-600 tabular-nums">−{fmt$(sumBy(visible, r => (r.rec ? deductOf(r.rec) : 0)))}</td>
                    <td className="px-4 py-3 text-right font-extrabold text-gray-900 tabular-nums">{fmt$(sumBy(visible, r => (r.rec ? netOf(r.rec) : 0)))}</td>
                    <td colSpan={3} />
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Mobile */}
            <div className="md:hidden divide-y divide-gray-100">
              {visible.map(r => {
                const isSel = selected.has(r.key)
                const src   = r.rec ?? {}
                return (
                  <div key={r.key} className={`p-4 space-y-3 ${isSel ? 'bg-indigo-50/50' : ''}`}>
                    <div className="flex items-center gap-3">
                      <Checkbox checked={isSel} onChange={() => toggle(r.key)} />
                      <div className="flex-1 min-w-0"><PersonCell person={r.person} extra={noteIcon(r)} /></div>
                      {statusCell(r)}
                    </div>
                    <div className="grid grid-cols-4 gap-2 pl-7 text-xs tabular-nums">
                      <div><p className="text-[10px] text-gray-400 uppercase">Base</p><p className="font-semibold text-gray-700 mt-0.5">{fmt$0(r.rec?.basic_salary ?? r.cfg?.basic_salary)}</p></div>
                      <div><p className="text-[10px] text-gray-400 uppercase">Add</p><p className="mt-0.5">{addCell(src)}</p></div>
                      <div><p className="text-[10px] text-gray-400 uppercase">Deduct</p><p className="mt-0.5">{dedCell(src)}</p></div>
                      <div className="text-right"><p className="text-[10px] text-gray-400 uppercase">Net</p><p className="mt-0.5">{netCell(r)}</p></div>
                    </div>
                    <div className="flex items-center gap-2 pl-7">
                      {actionFor(r, true)}
                      <button onClick={() => openEdit(r)}
                        className="w-10 h-10 rounded-xl border border-gray-100 bg-gray-50 flex items-center justify-center text-gray-500 shrink-0">
                        <Pencil size={15} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

            <ListFooter shown={visible.length} total={rows.length} noun="employees" />
          </>
        )}
      </div>

      <BulkBar count={selectedRows.length} busy={bulkBusy} onClear={clear}>
        <BulkAction Icon={Play} onClick={() => generate(selectedRows)} disabled={bulkBusy || !pick('pending').length}>
          Generate {pick('pending').length || ''}
        </BulkAction>
        <BulkAction dot={PAY_STATUS.Processing.dot} onClick={() => setStatus(pick('Unpaid'), 'Processing')} disabled={bulkBusy || !pick('Unpaid').length}>
          Approve {pick('Unpaid').length || ''}
        </BulkAction>
        <BulkAction dot={PAY_STATUS.Paid.dot} onClick={() => setStatus(pick('Processing'), 'Paid')} disabled={bulkBusy || !pick('Processing').length}>
          Mark paid {pick('Processing').length || ''}
        </BulkAction>
        <BulkAction Icon={Undo2} onClick={() => setStatus([...pick('Processing'), ...pick('Paid')], 'Unpaid')}
          disabled={bulkBusy || !(pick('Processing').length + pick('Paid').length)}>
          To draft
        </BulkAction>
        <BulkAction Icon={Trash2} danger disabled={bulkBusy || !pick('Unpaid').length}
          onClick={() => fire('delete') && deleteRows(pick('Unpaid'))}>
          {armed === 'delete' ? `Confirm · ${pick('Unpaid').length}` : 'Delete drafts'}
        </BulkAction>
      </BulkBar>

      {editingRow && (
        <RecordModal
          row={editingRow}
          monthLabel={monthLabel}
          att={attByEmp[editingRow.empId] ?? {}}
          onClose={() => setEditing(null)}
          onSave={saveRecord}
          onStatus={setStatus}
          onDelete={deleteRows}
        />
      )}

      {salaryRow && (
        <SalaryModal
          person={salaryRow.person}
          config={salaryRow.cfg}
          onClose={() => setSalaryFor(null)}
          onSave={amount => saveSalary(salaryRow, amount)}
        />
      )}

      <Toast toast={toast} onDismiss={dismissToast} />
    </div>
  )
}
