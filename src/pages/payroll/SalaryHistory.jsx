/**
 * SalaryHistory — reads payroll_records joined with employee_salary_config.
 * Status enum: 'Unpaid' | 'Processing' | 'Paid'
 */
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { History, Loader2, ChevronDown, CheckCircle2, AlertCircle, X } from 'lucide-react'

const fmt$ = n =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n ?? 0)

const fmtPeriod = iso =>
  iso ? new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '—'

const fmtDateTime = iso =>
  iso ? new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'

// Enum values match payroll_status type: 'Unpaid', 'Processing', 'Paid'
const STATUS_META = {
  Unpaid:     { label: 'Unpaid',     cls: 'bg-gray-100    text-gray-600'    },
  Processing: { label: 'Processing', cls: 'bg-amber-100   text-amber-700'   },
  Paid:       { label: 'Paid',       cls: 'bg-emerald-100 text-emerald-700' },
}

function initials(name = '') {
  return name.trim().split(/\s+/).map(w => w[0] ?? '').join('').slice(0, 2).toUpperCase()
}

function Toast({ toast, onDismiss }) {
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(onDismiss, 4000)
    return () => clearTimeout(t)
  }, [toast, onDismiss])
  if (!toast) return null
  const ok = toast.type === 'success'
  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl border text-sm font-medium
      ${ok ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
      {ok ? <CheckCircle2 size={16} className="text-emerald-500" /> : <AlertCircle size={16} className="text-red-500" />}
      <span>{toast.message}</span>
      <button onClick={onDismiss} className="ml-1 opacity-50 hover:opacity-100"><X size={14} /></button>
    </div>
  )
}

export default function SalaryHistory() {
  const [records,      setRecords]      = useState([])
  const [loading,      setLoading]      = useState(true)
  const [updating,     setUpdating]     = useState(null)
  const [toast,        setToast]        = useState(null)
  const [filterStatus, setFilterStatus] = useState('all')

  const showToast    = useCallback((type, msg) => setToast({ type, message: msg }), [])
  const dismissToast = useCallback(() => setToast(null), [])

  const fetchRecords = useCallback(async () => {
    const WITH_EMP = `
      id, pay_period, basic_salary, overtime, bonus,
      deductions, tax, net_salary, status, processed_at, created_at,
      employee_salary_config!salary_config_id(
        employee_name, department,
        employees!employee_salary_config_employee_id_fkey(email)
      )`

    const WITHOUT_EMP = `
      id, pay_period, basic_salary, overtime, bonus,
      deductions, tax, net_salary, status, processed_at, created_at,
      employee_salary_config!salary_config_id(employee_name, department)`

    let { data, error } = await supabase
      .from('payroll_records').select(WITH_EMP).order('pay_period', { ascending: false })

    if (error?.message?.toLowerCase().includes('relationship')) {
      ;({ data, error } = await supabase
        .from('payroll_records').select(WITHOUT_EMP).order('pay_period', { ascending: false }))
    }

    if (error) showToast('error', error.message)
    setRecords(data ?? [])
  }, [showToast])

  useEffect(() => {
    setLoading(true)
    fetchRecords().finally(() => setLoading(false))
  }, [fetchRecords])

  /** Advance: Unpaid → Processing → Paid */
  async function advanceStatus(id, current) {
    const next = current === 'Unpaid' ? 'Processing' : current === 'Processing' ? 'Paid' : null
    if (!next) return
    setUpdating(id)
    const extra = next === 'Paid' || next === 'Processing'
      ? { processed_at: new Date().toISOString() }
      : {}
    const { error } = await supabase
      .from('payroll_records')
      .update({ status: next, ...extra })
      .eq('id', id)
    setUpdating(null)
    if (error) showToast('error', error.message)
    else {
      showToast('success', `Status updated → ${next}`)
      await fetchRecords()
    }
  }

  const filtered = filterStatus === 'all'
    ? records
    : records.filter(r => r.status === filterStatus)

  const totalNet = filtered.reduce((s, r) => s + Number(r.net_salary ?? 0), 0)

  return (
    <div className="space-y-4">

      {/* Filter + summary */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <p className="text-sm text-gray-400">
          {filtered.length} record{filtered.length !== 1 ? 's' : ''} ·{' '}
          Total: <span className="font-semibold text-gray-700">{fmt$(totalNet)}</span>
        </p>
        <div className="relative">
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="appearance-none pl-4 pr-9 py-2.5 text-sm rounded-xl border border-gray-200 bg-white
              focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/25 focus:border-[#1e3a8a] transition-colors cursor-pointer"
          >
            <option value="all">All Statuses</option>
            <option value="Unpaid">Unpaid</option>
            <option value="Processing">Processing</option>
            <option value="Paid">Paid</option>
          </select>
          <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center gap-3 py-24 text-gray-400">
            <Loader2 size={22} className="animate-spin text-blue-600" />
            <span className="text-sm">Loading history…</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-gray-400">
            <History size={40} className="text-gray-200" />
            <p className="text-sm font-medium">No records found. Generate payroll first.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[880px]">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60">
                  {['Employee','Department','Pay Period','Basic','Overtime','Bonus','Deductions','Tax','Net Salary','Status','Action'].map(h => (
                    <th key={h} className="px-4 py-4 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(r => {
                  const cfg  = r.employee_salary_config
                  const name = cfg?.employee_name ?? '—'
                  const meta = STATUS_META[r.status]
                  const isUp = updating === r.id
                  return (
                    <tr key={r.id} className="hover:bg-gray-50/40 transition-colors">
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                            <span className="text-xs font-bold text-indigo-600">{initials(name)}</span>
                          </div>
                          <div>
                            <p className="font-semibold text-gray-800">{name}</p>
                            {cfg?.employees?.email && (
                              <p className="text-xs text-gray-400">{cfg.employees.email}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-gray-500">{cfg?.department ?? '—'}</td>
                      <td className="px-4 py-4 text-gray-500 text-xs whitespace-nowrap">{fmtPeriod(r.pay_period)}</td>
                      {/* All financial data comes from payroll_records */}
                      <td className="px-4 py-4 text-gray-700 font-medium">{fmt$(r.basic_salary)}</td>
                      <td className="px-4 py-4 text-green-600  font-medium">{fmt$(r.overtime)}</td>
                      <td className="px-4 py-4 text-purple-600 font-medium">{fmt$(r.bonus)}</td>
                      <td className="px-4 py-4 text-red-500    font-medium">-{fmt$(r.deductions)}</td>
                      <td className="px-4 py-4 text-orange-500 font-medium">-{fmt$(r.tax)}</td>
                      {/* net_salary is GENERATED in DB */}
                      <td className="px-4 py-4 font-bold text-gray-900">{fmt$(r.net_salary)}</td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${meta?.cls ?? ''}`}>
                          {meta?.label ?? r.status}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        {isUp ? (
                          <Loader2 size={16} className="animate-spin text-blue-600" />
                        ) : r.status === 'Unpaid' ? (
                          <button onClick={() => advanceStatus(r.id, r.status)}
                            className="text-xs font-semibold text-amber-600 hover:text-amber-800 transition-colors">
                            → Processing
                          </button>
                        ) : r.status === 'Processing' ? (
                          <button onClick={() => advanceStatus(r.id, r.status)}
                            className="text-xs font-semibold text-emerald-600 hover:text-emerald-800 transition-colors">
                            → Mark Paid
                          </button>
                        ) : (
                          <span className="text-xs text-gray-300">Complete</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-100 bg-gray-50/60">
                  <td colSpan={8} className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Total Net
                  </td>
                  <td className="px-4 py-3 font-extrabold text-gray-900">{fmt$(totalNet)}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      <Toast toast={toast} onDismiss={dismissToast} />
    </div>
  )
}
