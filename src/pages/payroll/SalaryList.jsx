/**
 * SalaryList — shows payroll_records joined with employee_salary_config.
 * All financial columns (overtime, bonus, deductions, tax, net_salary) live in
 * payroll_records.  Static info (employee_name, department, basic_salary) lives
 * in employee_salary_config and is fetched via the salary_config_id FK.
 */
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabaseClient'
import {
  Search, RefreshCw, Plus, Pencil, Trash2, Settings2,
  X, Loader2, CheckCircle2, AlertCircle,
} from 'lucide-react'

// ── helpers ────────────────────────────────────────────────────────────────────
const fmt$ = n => `$${Number(n ?? 0).toFixed(2)}`

/** net_salary is GENERATED in DB; calculate client-side only for modal preview */
function previewNet(f) {
  return (
    (Number(f.basic_salary) || 0) +
    (Number(f.overtime)     || 0) +
    (Number(f.bonus)        || 0) -
    (Number(f.deductions)   || 0) -
    (Number(f.tax)          || 0)
  )
}

function initials(name = '') {
  return name.trim().split(/\s+/).map(w => w[0] ?? '').join('').slice(0, 2).toUpperCase()
}

function shortId(id = '') {
  return id.replace(/-/g, '').slice(0, 5)
}

/** Convert 'YYYY-MM' (month input value) → 'YYYY-MM-01' (DATE for payroll_records) */
function monthToDate(ym) { return ym ? `${ym}-01` : '' }

/** Format a pay_period date as 'Jun 2026' */
const fmtPeriod = iso =>
  iso ? new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '—'

const STATUS_CLS = {
  Unpaid:     'bg-gray-100   text-gray-600',
  Processing: 'bg-amber-100  text-amber-700',
  Paid:       'bg-emerald-100 text-emerald-700',
}

const FIELD_CLS =
  'w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm ' +
  'focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/25 focus:border-[#1e3a8a] transition-colors'

const EMPTY_RECORD_FORM = {
  employee_id: '',        // selected from master employees table
  pay_period_month: '',
  basic_salary: '',       // editable only when no salary config exists yet
  overtime: '', bonus: '', deductions: '', tax: '',
}

const EMPTY_CONFIG_FORM = {
  employee_id: '', employee_name: '', department: '', basic_salary: '',
}

// ── Toast ──────────────────────────────────────────────────────────────────────
function Toast({ toast, onDismiss }) {
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(onDismiss, 4000)
    return () => clearTimeout(t)
  }, [toast, onDismiss])
  if (!toast) return null
  const ok = toast.type === 'success'
  return (
    <div className={`fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:bottom-6 sm:max-w-sm z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl border text-sm font-medium
      ${ok ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
      {ok ? <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
           : <AlertCircle  size={16} className="text-red-500 shrink-0" />}
      <span className="flex-1">{toast.message}</span>
      <button onClick={onDismiss} className="ml-1 opacity-50 hover:opacity-100"><X size={14} /></button>
    </div>
  )
}

// ── Delete confirm ─────────────────────────────────────────────────────────────
function DeleteModal({ target, onConfirm, onCancel, loading }) {
  if (!target) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
        <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Trash2 size={22} className="text-red-600" />
        </div>
        <h3 className="text-lg font-bold text-gray-800">Delete Record?</h3>
        <p className="text-sm text-gray-500 mt-2">This action cannot be undone.</p>
        <div className="flex gap-3 mt-6">
          <button onClick={onCancel}
            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold disabled:opacity-60">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Payroll Record modal (Add / Edit) ─────────────────────────────────────────
// Dropdown is sourced from the master `employees` table (active employees only).
// On submit, the handler auto-creates an employee_salary_config if one doesn't
// exist yet, then inserts the payroll_records row.
function RecordModal({ mode, form, employees, configs, onChange, onSubmit, onClose, loading }) {
  const isEdit = mode === 'edit'

  // Real employee record from master table
  const employee = employees.find(e => e.id === form.employee_id)

  // Check if a salary config already exists for the chosen employee
  const existingConfig = configs.find(c => c.employee_id === form.employee_id)
  const configExists   = !!existingConfig

  // basic_salary for the net preview:
  // • if config exists  → use its stored value (read-only)
  // • if config missing → use the user's input field
  const basicForPreview = configExists
    ? Number(existingConfig.basic_salary ?? 0)
    : Number(form.basic_salary)       || 0

  const net = previewNet({ ...form, basic_salary: basicForPreview })

  const NUM_FIELDS = [
    { key: 'overtime',   label: 'Overtime',   cls: 'text-green-600'  },
    { key: 'bonus',      label: 'Bonus',      cls: 'text-purple-600' },
    { key: 'deductions', label: 'Deductions', cls: 'text-red-600'    },
    { key: 'tax',        label: 'Tax',        cls: 'text-orange-500' },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-start justify-between px-6 py-5 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{isEdit ? 'Edit' : 'Add'} Salary Record</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {isEdit ? 'Update financial fields in payroll_records.' : 'Select a real employee from the master directory.'}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100"><X size={17} /></button>
        </div>

        <form onSubmit={onSubmit}>
          <div className="px-6 py-5 space-y-4">

            {/* ── Employee — from master employees table ── */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                Employee <span className="text-red-400 normal-case">*</span>
              </label>
              <select
                required
                disabled={isEdit}
                value={form.employee_id}
                onChange={e => onChange({ ...form, employee_id: e.target.value, basic_salary: '' })}
                className={`${FIELD_CLS} disabled:bg-gray-50 disabled:text-gray-400 cursor-pointer`}
              >
                <option value="">Select employee…</option>
                {employees.map(emp => {
                  const dept = emp.departments?.name ?? ''
                  return (
                    <option key={emp.id} value={emp.id}>
                      {emp.first_name} {emp.last_name}{dept ? ` — ${dept}` : ''}
                    </option>
                  )
                })}
              </select>

              {/* Show salary config status after employee is selected */}
              {form.employee_id && (
                configExists ? (
                  <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
                    <CheckCircle2 size={11} />
                    Salary config found — Basic: <span className="font-semibold">{fmt$(existingConfig.basic_salary)}</span>
                  </p>
                ) : (
                  <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                    <AlertCircle size={11} />
                    No salary config yet — enter a basic salary below and one will be created automatically.
                  </p>
                )
              )}
            </div>

            {/* ── Basic Salary — only editable when no config exists yet ── */}
            {form.employee_id && !configExists && (
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                  Basic Salary <span className="text-red-400 normal-case">*</span>
                  <span className="ml-1 normal-case font-normal text-gray-400">(saved to salary config)</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-600">$</span>
                  <input
                    required
                    type="number" min={0} step="0.01"
                    value={form.basic_salary}
                    onChange={e => onChange({ ...form, basic_salary: e.target.value })}
                    placeholder="0.00"
                    className={`${FIELD_CLS} pl-7 text-gray-800 font-medium`}
                  />
                </div>
              </div>
            )}

            {/* ── Pay period — month picker (add mode only) ── */}
            {!isEdit && (
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                  Pay Period <span className="text-red-400 normal-case">*</span>
                </label>
                <input
                  required
                  type="month"
                  value={form.pay_period_month}
                  onChange={e => onChange({ ...form, pay_period_month: e.target.value })}
                  className={FIELD_CLS}
                />
              </div>
            )}

            {/* ── Overtime / Bonus / Deductions / Tax ── */}
            <div className="grid grid-cols-2 gap-3">
              {NUM_FIELDS.map(({ key, label, cls }) => (
                <div key={key}>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">{label}</label>
                  <div className="relative">
                    <span className={`absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold ${cls}`}>$</span>
                    <input
                      type="number" min={0} step="0.01"
                      value={form[key]}
                      onChange={e => onChange({ ...form, [key]: e.target.value })}
                      placeholder="0.00"
                      className={`${FIELD_CLS} pl-7 ${cls} font-medium`}
                    />
                  </div>
                </div>
              ))}

              {/* Net salary preview */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                  Net Salary (preview)
                </label>
                <div className="w-full rounded-lg border border-gray-100 bg-gray-50 px-3.5 py-2.5 text-sm font-bold text-gray-900">
                  ${net.toFixed(2)}
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/50 rounded-b-2xl">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit" disabled={loading || !form.employee_id}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#1e3a8a] hover:bg-[#162d6e] text-white text-sm font-semibold disabled:opacity-60">
              {loading && <Loader2 size={14} className="animate-spin" />}
              {isEdit ? 'Save Changes' : 'Add Record'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Salary Config modal (Add / Edit base salary configs) ──────────────────────
function ConfigModal({ mode, form, employees, onChange, onSubmit, onClose, loading }) {
  const isEdit = mode === 'edit'

  function handleEmpChange(empId) {
    const emp = employees.find(e => e.id === empId)
    onChange({
      ...form,
      employee_id:   empId,
      employee_name: emp ? `${emp.first_name} ${emp.last_name}` : '',
      department:    emp?.departments?.name ?? '',
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-start justify-between px-6 py-5 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{isEdit ? 'Edit' : 'Add'} Salary Config</h2>
            <p className="text-xs text-gray-400 mt-0.5">Sets the employee's base salary structure.</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100"><X size={17} /></button>
        </div>

        <form onSubmit={onSubmit}>
          <div className="px-6 py-5 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                Employee <span className="text-red-400 normal-case">*</span>
              </label>
              <select
                required
                disabled={isEdit}
                value={form.employee_id}
                onChange={e => handleEmpChange(e.target.value)}
                className={`${FIELD_CLS} disabled:bg-gray-50 cursor-pointer`}
              >
                <option value="">Select employee…</option>
                {employees.map(e => (
                  <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>
                ))}
              </select>
            </div>

            {form.department && (
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Department</label>
                <input readOnly value={form.department} className={`${FIELD_CLS} bg-gray-50 text-gray-500`} />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                Basic Salary <span className="text-red-400 normal-case">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-600">$</span>
                <input
                  required type="number" min={0} step="0.01"
                  value={form.basic_salary}
                  onChange={e => onChange({ ...form, basic_salary: e.target.value })}
                  placeholder="0.00"
                  className={`${FIELD_CLS} pl-7 font-medium text-gray-800`}
                />
              </div>
            </div>
          </div>

          <div className="flex gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/50 rounded-b-2xl">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#1e3a8a] hover:bg-[#162d6e] text-white text-sm font-semibold disabled:opacity-60">
              {loading && <Loader2 size={14} className="animate-spin" />}
              {isEdit ? 'Save Changes' : 'Add Config'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function SalaryList() {
  /* ── view toggle ── */
  const [view, setView] = useState('records') // 'records' | 'configs'

  /* ── payroll_records state ── */
  const [records,   setRecords]   = useState([])
  const [configs,   setConfigs]   = useState([])   // employee_salary_config
  const [employees, setEmployees] = useState([])   // for config modal dropdown
  const [loading,   setLoading]   = useState(true)
  const [saving,    setSaving]    = useState(false)
  const [deleting,  setDeleting]  = useState(false)
  const [toast,     setToast]     = useState(null)
  const [search,    setSearch]    = useState('')

  /* ── modal state ── */
  const [recModal,   setRecModal]   = useState({ open: false })
  const [recForm,    setRecForm]    = useState(EMPTY_RECORD_FORM)
  const [cfgModal,   setCfgModal]   = useState({ open: false })
  const [cfgForm,    setCfgForm]    = useState(EMPTY_CONFIG_FORM)
  const [delTarget,  setDelTarget]  = useState(null)
  const [delContext, setDelContext] = useState('record') // 'record' | 'config'

  const showToast    = useCallback((type, msg) => setToast({ type, message: msg }), [])
  const dismissToast = useCallback(() => setToast(null), [])

  // ── fetch payroll_records ─────────────────────────────────────────────────
  // Tries the 3-layer join (payroll_records → salary_config → employees).
  // Falls back to 2-layer if the FK constraint hasn't been created yet,
  // so records always display even before the SQL migration is run.
  const fetchRecords = useCallback(async () => {
    const WITH_EMP = `
      id, pay_period, basic_salary, overtime, bonus,
      deductions, tax, net_salary, status, created_at,
      employee_salary_config!salary_config_id(
        id, employee_id, employee_name, department, basic_salary,
        employees!employee_salary_config_employee_id_fkey(id, first_name, last_name, email)
      )`

    const WITHOUT_EMP = `
      id, pay_period, basic_salary, overtime, bonus,
      deductions, tax, net_salary, status, created_at,
      employee_salary_config!salary_config_id(
        id, employee_id, employee_name, department, basic_salary
      )`

    let { data, error } = await supabase
      .from('payroll_records')
      .select(WITH_EMP)
      .order('created_at', { ascending: false })

    if (error?.message?.toLowerCase().includes('relationship')) {
      // FK not yet in schema cache — retry without the employees sub-join
      ;({ data, error } = await supabase
        .from('payroll_records')
        .select(WITHOUT_EMP)
        .order('created_at', { ascending: false }))
    }

    if (error) showToast('error', error.message)
    setRecords(data ?? [])
  }, [showToast])

  // ── fetch employee_salary_config (for RecordModal dropdown) ───────────────
  // Simple query — no employees FK join so it works before the migration.
  // Payload: id (= salary_config_id), employee_id, employee_name, department, basic_salary
  const fetchConfigs = useCallback(async () => {
    const [{ data: cfgs, error }, { data: emps }] = await Promise.all([
      supabase
        .from('employee_salary_config')
        .select('id, employee_id, employee_name, department, basic_salary')
        .order('employee_name'),
      supabase
        .from('employees')
        .select('id, first_name, last_name, email, departments(name)')
        .eq('status', 'active')
        .order('first_name'),
    ])
    if (error) showToast('error', error.message)
    setConfigs(cfgs  ?? [])
    setEmployees(emps ?? [])
  }, [showToast])

  useEffect(() => {
    setLoading(true)
    Promise.all([fetchRecords(), fetchConfigs()]).finally(() => setLoading(false))
  }, [fetchRecords, fetchConfigs])

  function refresh() {
    setLoading(true)
    Promise.all([fetchRecords(), fetchConfigs()]).finally(() => setLoading(false))
  }

  // ── Add / Edit payroll_record ──────────────────────────────────────────────
  function openAddRecord() {
    setRecForm(EMPTY_RECORD_FORM)
    setRecModal({ open: true, mode: 'add' })
  }

  function openEditRecord(row) {
    // employee_id is the master FK; we use it as the edit form key
    const empId = row.employee_salary_config?.employee_id ?? ''
    setRecForm({
      employee_id:      empId,
      pay_period_month: row.pay_period?.slice(0, 7) ?? '',
      basic_salary:     '',        // read from existing config in modal
      overtime:         row.overtime   ?? '',
      bonus:            row.bonus      ?? '',
      deductions:       row.deductions ?? '',
      tax:              row.tax        ?? '',
    })
    setRecModal({ open: true, mode: 'edit', id: row.id })
  }

  async function handleSaveRecord(e) {
    e.preventDefault()
    if (!recForm.employee_id) { showToast('error', 'Select an employee.'); return }

    const employee = employees.find(emp => emp.id === recForm.employee_id)
    setSaving(true)

    // ── Step 1: find or auto-create employee_salary_config ────────────────────
    let cfg = configs.find(c => c.employee_id === recForm.employee_id)

    if (!cfg) {
      // No salary config for this employee yet — create a default one
      const { data: newCfg, error: cfgErr } = await supabase
        .from('employee_salary_config')
        .insert({
          employee_id:   recForm.employee_id,
          employee_name: employee
            ? `${employee.first_name} ${employee.last_name}`
            : '',
          department:    employee?.departments?.name ?? '',
          basic_salary:  Number(recForm.basic_salary) || 0,
        })
        .select('id, employee_id, employee_name, department, basic_salary')
        .single()

      if (cfgErr) {
        showToast('error', `Could not create salary config: ${cfgErr.message}`)
        setSaving(false)
        return
      }
      cfg = newCfg
      // Refresh config list so the modal reflects the new config next time
      fetchConfigs()
    }

    // ── Step 2: insert / update payroll_records ────────────────────────────────
    const payload = {
      salary_config_id: cfg.id,
      employee_id:      recForm.employee_id,
      basic_salary:     Number(cfg.basic_salary ?? 0),
      overtime:         Number(recForm.overtime)   || 0,
      bonus:            Number(recForm.bonus)      || 0,
      deductions:       Number(recForm.deductions) || 0,
      tax:              Number(recForm.tax)        || 0,
    }

    let error
    if (recModal.mode === 'add') {
      payload.pay_period = monthToDate(recForm.pay_period_month)
      ;({ error } = await supabase.from('payroll_records').insert([payload]))
    } else {
      ;({ error } = await supabase.from('payroll_records').update(payload).eq('id', recModal.id))
    }

    setSaving(false)
    if (error) { showToast('error', error.message); return }
    showToast('success', recModal.mode === 'add' ? 'Record added.' : 'Record updated.')
    setRecModal({ open: false })
    fetchRecords()
  }

  // ── Add / Edit employee_salary_config ──────────────────────────────────────
  function openAddConfig() {
    setCfgForm(EMPTY_CONFIG_FORM)
    setCfgModal({ open: true, mode: 'add' })
  }

  function openEditConfig(cfg) {
    setCfgForm({
      employee_id:   cfg.employee_id,
      employee_name: cfg.employee_name,
      department:    cfg.department,
      basic_salary:  cfg.basic_salary,
    })
    setCfgModal({ open: true, mode: 'edit', id: cfg.id })
  }

  async function handleSaveConfig(e) {
    e.preventDefault()
    setSaving(true)

    const payload = {
      employee_id:   cfgForm.employee_id   || null,
      employee_name: cfgForm.employee_name.trim(),
      department:    cfgForm.department.trim(),
      basic_salary:  Number(cfgForm.basic_salary) || 0,
    }

    const { error } = cfgModal.mode === 'add'
      ? await supabase.from('employee_salary_config').insert([payload])
      : await supabase.from('employee_salary_config').update(payload).eq('id', cfgModal.id)

    setSaving(false)
    if (error) { showToast('error', error.message); return }
    showToast('success', cfgModal.mode === 'add' ? 'Config added.' : 'Config updated.')
    setCfgModal({ open: false })
    fetchConfigs()
  }

  // ── Delete ─────────────────────────────────────────────────────────────────
  async function handleDelete() {
    if (!delTarget) return
    setDeleting(true)
    const table = delContext === 'record' ? 'payroll_records' : 'employee_salary_config'
    const { error } = await supabase.from(table).delete().eq('id', delTarget.id)
    setDeleting(false)
    if (error) { showToast('error', error.message); return }
    showToast('success', 'Deleted successfully.')
    setDelTarget(null)
    if (delContext === 'record') fetchRecords()
    else fetchConfigs()
  }

  // ── filtered data ──────────────────────────────────────────────────────────
  const filteredRecords = records.filter(r => {
    const q = search.toLowerCase()
    if (!q) return true
    const cfg   = r.employee_salary_config
    const name  = (cfg?.employee_name     ?? '').toLowerCase()
    const dept  = (cfg?.department        ?? '').toLowerCase()
    const email = (cfg?.employees?.email  ?? '').toLowerCase()
    return name.includes(q) || dept.includes(q) || email.includes(q)
  })

  const filteredConfigs = configs.filter(c => {
    const q = search.toLowerCase()
    if (!q) return true
    const email = (c.employees?.email ?? '').toLowerCase()
    return (c.employee_name ?? '').toLowerCase().includes(q) ||
           (c.department    ?? '').toLowerCase().includes(q) ||
           email.includes(q)
  })

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">

      {/* ── Top bar ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">

          {/* Search */}
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name or department..."
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50/60 text-sm
                focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/20 focus:border-[#1e3a8a] transition-colors"
            />
          </div>

          {/* View toggle */}
          <div className="flex items-center rounded-xl border border-gray-200 p-0.5 shrink-0 bg-gray-50">
            <button
              onClick={() => setView('records')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all
                ${view === 'records' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Records
            </button>
            <button
              onClick={() => setView('configs')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all
                ${view === 'configs' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Salary Configs
            </button>
          </div>

          {/* Count + refresh + primary action */}
          <div className="flex items-center gap-2.5 shrink-0">
            <span className="text-sm text-gray-400 whitespace-nowrap">
              {view === 'records' ? filteredRecords.length : filteredConfigs.length} record{(view === 'records' ? filteredRecords.length : filteredConfigs.length) !== 1 ? 's' : ''}
            </span>
            <button onClick={refresh}
              className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-500 transition-colors">
              <RefreshCw size={14} />
            </button>
            {view === 'records' ? (
              <button onClick={openAddRecord}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-[#1e3a8a] hover:bg-[#162d6e] text-white text-sm font-semibold rounded-xl shadow-sm transition-colors whitespace-nowrap">
                <Plus size={15} /> Add Salary Record
              </button>
            ) : (
              <button onClick={openAddConfig}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-[#1e3a8a] hover:bg-[#162d6e] text-white text-sm font-semibold rounded-xl shadow-sm transition-colors whitespace-nowrap">
                <Settings2 size={15} /> Add Config
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── payroll_records table ── */}
      {view === 'records' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center gap-3 py-24 text-gray-400">
              <Loader2 size={22} className="animate-spin text-blue-600" />
              <span className="text-sm">Loading…</span>
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3 text-gray-400">
              <Plus size={36} className="text-gray-200" />
              <p className="text-sm font-medium text-center">
                {search ? 'No records match your search.' : 'No payroll records yet. Click "+ Add Salary Record".'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[1040px]">
                <thead>
                  <tr className="border-b border-gray-100">
                    {['EMPLOYEE','DEPARTMENT','PAY PERIOD','BASIC SALARY','OVERTIME','BONUS','DEDUCTIONS','TAX','NET SALARY','STATUS',''].map(h => (
                      <th key={h} className="px-5 py-4 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider last:w-16">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredRecords.map(row => {
                    const cfg   = row.employee_salary_config
                    const name  = cfg?.employee_name ?? '—'
                    const ini   = initials(name)
                    const email = cfg?.employees?.email ?? null
                    return (
                      <tr key={row.id} className="hover:bg-gray-50/40 transition-colors group">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                              <span className="text-[13px] font-bold text-indigo-600">{ini}</span>
                            </div>
                            <div>
                              <p className="font-semibold text-gray-800">{name}</p>
                              <p className="text-xs text-gray-400">{email ?? cfg?.department ?? '—'}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-gray-500">{cfg?.department ?? '—'}</td>
                        <td className="px-5 py-4 text-gray-500 text-xs whitespace-nowrap">{fmtPeriod(row.pay_period)}</td>
                        {/* basic_salary is in payroll_records (copied from config at insert time) */}
                        <td className="px-5 py-4 text-gray-800 font-medium">{fmt$(row.basic_salary)}</td>
                        {/* These columns are in payroll_records */}
                        <td className="px-5 py-4 text-green-600  font-medium">{fmt$(row.overtime)}</td>
                        <td className="px-5 py-4 text-purple-600 font-medium">{fmt$(row.bonus)}</td>
                        <td className="px-5 py-4 text-red-600    font-medium">-{fmt$(row.deductions)}</td>
                        <td className="px-5 py-4 text-orange-500 font-medium">-{fmt$(row.tax)}</td>
                        {/* net_salary is GENERATED by DB */}
                        <td className="px-5 py-4 font-bold text-gray-900">{fmt$(row.net_salary)}</td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold
                            ${STATUS_CLS[row.status] ?? 'bg-gray-100 text-gray-600'}`}>
                            {row.status ?? '—'}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => openEditRecord(row)}
                              className="p-1.5 rounded-lg text-gray-400 hover:bg-blue-50 hover:text-blue-600 transition-colors">
                              <Pencil size={14} />
                            </button>
                            <button onClick={() => { setDelTarget(row); setDelContext('record') }}
                              className="p-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-100 bg-gray-50/60">
                    <td colSpan={8} className="px-5 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      Total Net Salary
                    </td>
                    <td className="px-5 py-3 font-extrabold text-gray-900">
                      {fmt$(filteredRecords.reduce((s, r) => s + Number(r.net_salary ?? 0), 0))}
                    </td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── employee_salary_config table ── */}
      {view === 'configs' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center gap-3 py-24 text-gray-400">
              <Loader2 size={22} className="animate-spin text-blue-600" />
              <span className="text-sm">Loading…</span>
            </div>
          ) : filteredConfigs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3 text-gray-400">
              <Settings2 size={36} className="text-gray-200" />
              <p className="text-sm font-medium">No salary configs yet. Add one to start processing payroll.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[580px]">
                <thead>
                  <tr className="border-b border-gray-100">
                    {['EMPLOYEE','DEPARTMENT','BASIC SALARY','CREATED',''].map(h => (
                      <th key={h} className="px-5 py-4 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider last:w-16">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredConfigs.map(cfg => {
                    const ini   = initials(cfg.employee_name)
                    const email = cfg.employees?.email ?? null
                    return (
                      <tr key={cfg.id} className="hover:bg-gray-50/40 transition-colors group">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                              <span className="text-xs font-bold text-indigo-600">{ini}</span>
                            </div>
                            <div>
                              <p className="font-semibold text-gray-800">{cfg.employee_name}</p>
                              <p className="text-xs text-gray-400">{email ?? cfg.department ?? '—'}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-gray-500">{cfg.department}</td>
                        <td className="px-5 py-4 font-bold text-gray-900">{fmt$(cfg.basic_salary)}</td>
                        <td className="px-5 py-4 text-gray-400 text-xs">
                          {cfg.created_at ? new Date(cfg.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => openEditConfig(cfg)}
                              className="p-1.5 rounded-lg text-gray-400 hover:bg-blue-50 hover:text-blue-600 transition-colors">
                              <Pencil size={14} />
                            </button>
                            <button onClick={() => { setDelTarget(cfg); setDelContext('config') }}
                              className="p-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors">
                              <Trash2 size={14} />
                            </button>
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
      )}

      {/* ── modals ── */}
      {recModal.open && (
        <RecordModal
          mode={recModal.mode}
          form={recForm}
          employees={employees}
          configs={configs}
          onChange={setRecForm}
          onSubmit={handleSaveRecord}
          onClose={() => setRecModal({ open: false })}
          loading={saving}
        />
      )}

      {cfgModal.open && (
        <ConfigModal
          mode={cfgModal.mode}
          form={cfgForm}
          employees={employees}
          onChange={setCfgForm}
          onSubmit={handleSaveConfig}
          onClose={() => setCfgModal({ open: false })}
          loading={saving}
        />
      )}

      <DeleteModal
        target={delTarget}
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDelTarget(null)}
      />

      <Toast toast={toast} onDismiss={dismissToast} />
    </div>
  )
}
