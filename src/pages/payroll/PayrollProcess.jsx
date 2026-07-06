/**
 * PayrollProcess — two-panel workflow:
 *   TOP: configure & generate payroll_records for a pay period
 *   BOTTOM: live status of all records for that period with action buttons
 */
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabaseClient'
import {
  Calculator, Loader2, CheckCircle2, AlertCircle, X,
  Play, ArrowRight, ChevronsRight, RefreshCw,
} from 'lucide-react'

const fmt$ = n =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n ?? 0)

function initials(name = '') {
  return name.trim().split(/\s+/).map(w => w[0] ?? '').join('').slice(0, 2).toUpperCase()
}

const STATUS_CLS = {
  Unpaid:     'bg-gray-100   text-gray-600',
  Processing: 'bg-amber-100  text-amber-700',
  Paid:       'bg-emerald-100 text-emerald-700',
}

// ── Toast ──────────────────────────────────────────────────────────────────────
function Toast({ toast, onDismiss }) {
  useEffect(() => {
    if (!toast) return
    const id = setTimeout(onDismiss, 5000)
    return () => clearTimeout(id)
  }, [toast, onDismiss])
  if (!toast) return null
  const ok = toast.type === 'success'
  return (
    <div className={`fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:bottom-6 sm:max-w-sm z-50 flex items-start gap-3 px-4 py-3 rounded-xl shadow-xl border text-sm font-medium
      ${ok ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
      {ok ? <CheckCircle2 size={17} className="text-emerald-500 shrink-0 mt-0.5" />
           : <AlertCircle  size={17} className="text-red-500 shrink-0 mt-0.5" />}
      <span className="flex-1">{toast.message}</span>
      <button onClick={onDismiss} className="opacity-50 hover:opacity-100 shrink-0"><X size={14} /></button>
    </div>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────────
export default function PayrollProcess() {
  const now          = new Date()
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  /* ── generation state ── */
  const [configs,    setConfigs]    = useState([])
  const [loading,    setLoading]    = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [toast,      setToast]      = useState(null)
  const [month,      setMonth]      = useState(defaultMonth)
  const [overrides,  setOverrides]  = useState({})
  const [selected,   setSelected]   = useState(new Set())

  /* ── period status state ── */
  const [periodRecords,   setPeriodRecords]   = useState([])
  const [loadingPeriod,   setLoadingPeriod]   = useState(false)
  const [advancing,       setAdvancing]       = useState(null)   // record id being advanced
  const [bulkAdvancing,   setBulkAdvancing]   = useState(false)

  const showToast    = useCallback((type, msg) => setToast({ type, message: msg }), [])
  const dismissToast = useCallback(() => setToast(null), [])

  /* ── load salary configs ── */
  const fetchConfigs = useCallback(async () => {
    const { data, error } = await supabase
      .from('employee_salary_config')
      .select('id, employee_id, employee_name, department, basic_salary')
      .order('employee_name')
    if (error) showToast('error', error.message)
    const list = data ?? []
    setConfigs(list)
    setSelected(new Set(list.map(c => c.id)))
  }, [showToast])

  /* ── load existing payroll_records for the current period ── */
  const fetchPeriodRecords = useCallback(async (targetMonth) => {
    if (!targetMonth) return
    setLoadingPeriod(true)
    const { data, error } = await supabase
      .from('payroll_records')
      .select(`
        id, employee_id, pay_period,
        basic_salary, overtime, bonus, deductions, tax, net_salary, status,
        employee_salary_config!salary_config_id(employee_name, department)
      `)
      .eq('pay_period', `${targetMonth}-01`)
      .order('created_at', { ascending: true })
    setLoadingPeriod(false)
    if (!error) setPeriodRecords(data ?? [])
  }, [])

  useEffect(() => {
    setLoading(true)
    fetchConfigs().finally(() => setLoading(false))
  }, [fetchConfigs])

  // Reload period records whenever the selected month changes
  useEffect(() => { fetchPeriodRecords(month) }, [month, fetchPeriodRecords])

  /* ── helpers ── */
  function toggleConfig(id) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleAll() {
    setSelected(prev =>
      prev.size === configs.length ? new Set() : new Set(configs.map(c => c.id))
    )
  }

  function setOv(id, field, value) {
    setOverrides(prev => ({
      ...prev,
      [id]: { overtime: 0, bonus: 0, deduction: 0, tax: 0, ...(prev[id] ?? {}), [field]: Number(value) || 0 },
    }))
  }

  function netFor(cfg) {
    const ov = overrides[cfg.id] ?? { overtime: 0, bonus: 0, deduction: 0, tax: 0 }
    return (Number(cfg.basic_salary) || 0) + ov.overtime + ov.bonus - ov.deduction - ov.tax
  }

  /* ── generate payroll_records ── */
  async function handleGenerate() {
    if (selected.size === 0) { showToast('error', 'Select at least one employee.'); return }
    if (!month)              { showToast('error', 'Choose a pay period month.');     return }

    const payPeriod   = `${month}-01`
    const selectedIds = [...selected]
    setSubmitting(true)

    // Phase 1 — build rows
    const allRows = selectedIds.map(cfgId => {
      const cfg = configs.find(c => c.id === cfgId)
      const ov  = overrides[cfgId] ?? { overtime: 0, bonus: 0, deduction: 0, tax: 0 }
      return {
        salary_config_id: cfgId,
        employee_id:      cfg?.employee_id ?? null,
        pay_period:       payPeriod,
        basic_salary:     Number(cfg?.basic_salary ?? 0),
        overtime:         ov.overtime,
        bonus:            ov.bonus,
        deductions:       ov.deduction,
        tax:              ov.tax,
      }
    })

    const employeeIds = allRows.map(r => r.employee_id).filter(Boolean)

    // Phase 2 — pre-check status of existing records
    const { data: existing, error: fetchErr } = await supabase
      .from('payroll_records')
      .select('employee_id, status')
      .in('employee_id', employeeIds)
      .eq('pay_period', payPeriod)

    if (fetchErr) {
      showToast('error', `Pre-check failed: ${fetchErr.message}`)
      setSubmitting(false)
      return
    }

    const statusMap = {}
    ;(existing ?? []).forEach(r => { statusMap[r.employee_id] = r.status })

    const newRows    = allRows.filter(r => !statusMap[r.employee_id])
    const unpaidRows = allRows.filter(r => statusMap[r.employee_id] === 'Unpaid')
    const lockedRows = allRows.filter(r =>
      statusMap[r.employee_id] === 'Processing' || statusMap[r.employee_id] === 'Paid'
    )

    const rowsToUpsert = [...newRows, ...unpaidRows]

    if (rowsToUpsert.length === 0) {
      setSubmitting(false)
      showToast('error',
        `All ${lockedRows.length} record${lockedRows.length !== 1 ? 's' : ''} ` +
        `are already Processing or Paid and cannot be re-generated.`
      )
      fetchPeriodRecords(month)
      return
    }

    // Phase 3 — upsert (status NOT in payload → stays unchanged on conflict)
    const { error } = await supabase
      .from('payroll_records')
      .upsert(rowsToUpsert, { onConflict: 'employee_id,pay_period' })
      .select()

    setSubmitting(false)

    if (error) { showToast('error', error.message); return }

    const parts = []
    if (newRows.length)    parts.push(`${newRows.length} new`)
    if (unpaidRows.length) parts.push(`${unpaidRows.length} refreshed`)
    if (lockedRows.length) parts.push(`${lockedRows.length} skipped (locked)`)
    showToast('success', `Payroll generated: ${parts.join(', ')}.`)

    // Refresh the period status panel so action buttons appear immediately
    fetchPeriodRecords(month)
  }

  /* ── advance single record: Unpaid → Processing ──────────────────────────── */
  async function advanceToProcessing(record) {
    setAdvancing(record.id)
    const { error } = await supabase
      .from('payroll_records')
      .update({
        status:       'Processing',
        processed_at: new Date().toISOString(),
      })
      .eq('id', record.id)
    setAdvancing(null)
    if (error) showToast('error', error.message)
    else {
      showToast('success', `${record.employee_salary_config?.employee_name ?? 'Record'} → Processing`)
      fetchPeriodRecords(month)
    }
  }

  /* ── bulk advance all Unpaid → Processing ──────────────────────────────────── */
  async function bulkAdvanceAllUnpaid() {
    const unpaidIds = periodRecords
      .filter(r => r.status === 'Unpaid')
      .map(r => r.id)

    if (unpaidIds.length === 0) {
      showToast('error', 'No Unpaid records to advance.')
      return
    }

    setBulkAdvancing(true)
    const { error } = await supabase
      .from('payroll_records')
      .update({
        status:       'Processing',
        processed_at: new Date().toISOString(),
      })
      .in('id', unpaidIds)
    setBulkAdvancing(false)

    if (error) showToast('error', error.message)
    else {
      showToast('success', `${unpaidIds.length} record${unpaidIds.length !== 1 ? 's' : ''} advanced → Processing`)
      fetchPeriodRecords(month)
    }
  }

  const totalSelected = [...selected].reduce((s, id) => {
    const cfg = configs.find(c => c.id === id)
    return s + (cfg ? netFor(cfg) : 0)
  }, 0)

  const unpaidCount = periodRecords.filter(r => r.status === 'Unpaid').length

  const INPUT_CLS =
    'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm ' +
    'focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/25 focus:border-[#1e3a8a] transition-colors'

  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div>
        <h2 className="text-xl font-bold text-gray-900">Payroll Process</h2>
        <p className="text-sm text-gray-400 mt-0.5">
          Generate records for a period, then advance them through the workflow.
        </p>
      </div>

      {/* ── Pay period selector ── */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Pay Period</h3>
        <div className="max-w-xs">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Month</label>
          <input
            type="month"
            value={month}
            onChange={e => setMonth(e.target.value)}
            className={INPUT_CLS}
          />
          <p className="text-xs text-gray-400 mt-1.5">
            Stored as <code className="bg-gray-100 px-1 rounded">{month ? `${month}-01` : 'YYYY-MM-01'}</code>
          </p>
        </div>
      </div>

      {/* ── Salary Configs table (generate) ── */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700">
            Step 1 — Configure &amp; Generate
            <span className="ml-2 text-gray-400 font-normal">({selected.size} of {configs.length} selected)</span>
          </h3>
          <button onClick={toggleAll} className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors">
            {selected.size === configs.length ? 'Deselect All' : 'Select All'}
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-3 py-20 text-gray-400">
            <Loader2 size={22} className="animate-spin text-blue-600" />
            <span className="text-sm">Loading salary configs…</span>
          </div>
        ) : configs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-gray-400">
            <Calculator size={36} className="text-gray-200" />
            <p className="text-sm font-medium text-center">
              No salary configs found.<br />
              Go to Salary List → Salary Configs to add employees first.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60">
                  <th className="px-5 py-3 w-10" />
                  {['Employee','Department','Base Salary','Overtime','Bonus','Deduction','Tax','Net Salary'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {configs.map(cfg => {
                  const isSel = selected.has(cfg.id)
                  const ov    = overrides[cfg.id] ?? { overtime: 0, bonus: 0, deduction: 0, tax: 0 }
                  return (
                    <tr key={cfg.id}
                      className={`transition-colors ${isSel ? '' : 'opacity-40 bg-gray-50/30'}`}>
                      <td className="px-5 py-3">
                        <input type="checkbox" checked={isSel} onChange={() => toggleConfig(cfg.id)}
                          className="w-4 h-4 rounded border-gray-300 text-[#1e3a8a] cursor-pointer" />
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-gray-800">{cfg.employee_name}</p>
                      </td>
                      <td className="px-4 py-3 text-gray-500">{cfg.department}</td>
                      <td className="px-4 py-3 font-medium text-gray-700">{fmt$(cfg.basic_salary)}</td>
                      {[
                        { field: 'overtime',  cls: 'text-green-600'  },
                        { field: 'bonus',     cls: 'text-purple-600' },
                        { field: 'deduction', cls: 'text-red-600'    },
                        { field: 'tax',       cls: 'text-orange-500' },
                      ].map(({ field, cls }) => (
                        <td key={field} className="px-4 py-3">
                          <input
                            type="number" min={0} step="0.01"
                            value={ov[field]}
                            onChange={e => setOv(cfg.id, field, e.target.value)}
                            disabled={!isSel}
                            className={`w-24 rounded-lg border border-gray-200 px-2 py-1.5 text-sm ${cls}
                              focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/20 disabled:opacity-40`}
                          />
                        </td>
                      ))}
                      <td className="px-4 py-3 font-bold text-gray-900">{fmt$(netFor(cfg))}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-5 py-4 border-t border-gray-100 bg-gray-50/50">
          <div>
            <p className="text-xs text-gray-500">Estimated total for {selected.size} selected</p>
            <p className="text-xl font-bold text-gray-900 mt-0.5">{fmt$(totalSelected)}</p>
          </div>
          <button
            onClick={handleGenerate}
            disabled={submitting || selected.size === 0}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-[#1e3a8a] hover:bg-[#162d6e] text-white text-sm font-semibold rounded-xl shadow-sm transition-colors disabled:opacity-60 sm:w-auto w-full"
          >
            {submitting ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
            {submitting ? 'Generating…' : 'Generate Payroll'}
          </button>
        </div>
      </div>

      {/* ── Period Status Panel (Step 2) ── */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">

        {/* Panel header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-5 py-4 border-b border-gray-100">
          <div>
            <h3 className="text-sm font-semibold text-gray-700">
              Step 2 — Advance to Processing
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">
              Records for <span className="font-medium">{month ? new Date(`${month}-01T00:00:00`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : '—'}</span>
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Refresh button */}
            <button
              onClick={() => fetchPeriodRecords(month)}
              className="p-2 rounded-lg border border-gray-200 text-gray-400 hover:bg-gray-50 hover:text-gray-600 transition-colors"
              title="Refresh"
            >
              <RefreshCw size={14} />
            </button>

            {/* Bulk advance button — only shown when Unpaid records exist */}
            {unpaidCount > 0 && (
              <button
                onClick={bulkAdvanceAllUnpaid}
                disabled={bulkAdvancing}
                className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold rounded-xl shadow-sm transition-colors disabled:opacity-60"
              >
                {bulkAdvancing
                  ? <Loader2 size={13} className="animate-spin" />
                  : <ChevronsRight size={13} />}
                Advance All {unpaidCount} Unpaid → Processing
              </button>
            )}
          </div>
        </div>

        {/* Period records table */}
        {loadingPeriod ? (
          <div className="flex items-center justify-center gap-3 py-14 text-gray-400">
            <Loader2 size={20} className="animate-spin text-blue-600" />
            <span className="text-sm">Loading period records…</span>
          </div>
        ) : periodRecords.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 gap-2 text-gray-400">
            <Play size={32} className="text-gray-200" />
            <p className="text-sm font-medium">No records for this period yet.</p>
            <p className="text-xs text-gray-300">Click "Generate Payroll" above to create them.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60">
                  {['Employee','Department','Net Salary','Status','Action'].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {periodRecords.map(r => {
                  const cfg      = r.employee_salary_config
                  const name     = cfg?.employee_name ?? '—'
                  const isAdv    = advancing === r.id
                  return (
                    <tr key={r.id} className="hover:bg-gray-50/40 transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                            <span className="text-xs font-bold text-indigo-600">{initials(name)}</span>
                          </div>
                          <p className="font-semibold text-gray-800">{name}</p>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-gray-500">{cfg?.department ?? '—'}</td>
                      {/* net_salary is GENERATED by DB */}
                      <td className="px-5 py-4 font-bold text-gray-900">{fmt$(r.net_salary)}</td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold
                          ${STATUS_CLS[r.status] ?? 'bg-gray-100 text-gray-600'}`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        {isAdv ? (
                          <Loader2 size={16} className="animate-spin text-amber-500" />
                        ) : r.status === 'Unpaid' ? (
                          <button
                            onClick={() => advanceToProcessing(r)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold
                              rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200
                              transition-colors whitespace-nowrap"
                          >
                            <ArrowRight size={12} /> Processing
                          </button>
                        ) : r.status === 'Processing' ? (
                          <span className="flex items-center gap-1 text-xs text-amber-600 font-semibold">
                            <CheckCircle2 size={13} /> In Progress
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs text-emerald-600 font-semibold">
                            <CheckCircle2 size={13} /> Paid
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Toast toast={toast} onDismiss={dismissToast} />
    </div>
  )
}
