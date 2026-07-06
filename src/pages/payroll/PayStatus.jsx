/**
 * PayStatus — tracks payroll_records.status enum ('Unpaid' | 'Processing' | 'Paid').
 * Reads from payroll_records JOIN employee_salary_config via salary_config_id.
 */
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { CheckCircle2, Clock, AlertCircle, Loader2, X, RefreshCw } from 'lucide-react'

const fmt$ = n =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n ?? 0)

const fmtPeriod = iso =>
  iso ? new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '—'

const fmtDateTime = iso =>
  iso ? new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—'

function initials(name = '') {
  return name.trim().split(/\s+/).map(w => w[0] ?? '').join('').slice(0, 2).toUpperCase()
}

// Matches payroll_status enum: 'Unpaid' | 'Processing' | 'Paid'
const PAY_STATUS = {
  Unpaid:     { label: 'Unpaid',     Icon: AlertCircle,  cls: 'bg-gray-100    text-gray-600',   dot: 'bg-gray-400'    },
  Processing: { label: 'Processing', Icon: Clock,        cls: 'bg-amber-100   text-amber-700',  dot: 'bg-amber-400'   },
  Paid:       { label: 'Paid',       Icon: CheckCircle2, cls: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
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
    <div className={`fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:bottom-6 sm:max-w-sm z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl border text-sm font-medium
      ${ok ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
      {ok ? <CheckCircle2 size={16} className="text-emerald-500 shrink-0" /> : <AlertCircle size={16} className="text-red-500 shrink-0" />}
      <span>{toast.message}</span>
      <button onClick={onDismiss} className="ml-1 opacity-50 hover:opacity-100"><X size={14} /></button>
    </div>
  )
}

export default function PayStatus() {
  const [records,      setRecords]      = useState([])
  const [loading,      setLoading]      = useState(true)
  const [updating,     setUpdating]     = useState(null)
  const [toast,        setToast]        = useState(null)
  const [filterStatus, setFilterStatus] = useState('all')

  const showToast    = useCallback((type, msg) => setToast({ type, message: msg }), [])
  const dismissToast = useCallback(() => setToast(null), [])

  const fetchRecords = useCallback(async () => {
    const WITH_EMP = `
      id, pay_period, net_salary, status, processed_at, created_at,
      employee_salary_config!salary_config_id(
        employee_name, department,
        employees!employee_salary_config_employee_id_fkey(email)
      )`

    const WITHOUT_EMP = `
      id, pay_period, net_salary, status, processed_at, created_at,
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

  /** Advance status: Unpaid → Processing → Paid */
  async function advance(id, current) {
    const next = current === 'Unpaid' ? 'Processing' : current === 'Processing' ? 'Paid' : null
    if (!next) return
    setUpdating(id)
    const extra = (next === 'Processing' || next === 'Paid')
      ? { processed_at: new Date().toISOString() }
      : {}
    const { error } = await supabase
      .from('payroll_records')
      .update({ status: next, ...extra })
      .eq('id', id)
    setUpdating(null)
    if (error) showToast('error', error.message)
    else {
      showToast('success', `Payment status → ${PAY_STATUS[next].label}`)
      await fetchRecords()
    }
  }

  const filtered = filterStatus === 'all'
    ? records
    : records.filter(r => r.status === filterStatus)

  // Summary counts using enum values
  const counts = {
    Unpaid:     records.filter(r => r.status === 'Unpaid').length,
    Processing: records.filter(r => r.status === 'Processing').length,
    Paid:       records.filter(r => r.status === 'Paid').length,
  }

  return (
    <div className="space-y-5">

      {/* Summary cards — clickable filters */}
      <div className="grid grid-cols-3 gap-4">
        {Object.entries(PAY_STATUS).map(([key, { label, Icon, cls, dot }]) => (
          <button
            key={key}
            onClick={() => setFilterStatus(filterStatus === key ? 'all' : key)}
            className={`bg-white rounded-2xl border shadow-sm p-5 flex items-center gap-4 text-left
              transition-all duration-150
              ${filterStatus === key ? 'border-[#1e3a8a] ring-2 ring-[#1e3a8a]/15' : 'border-gray-100 hover:border-gray-200'}`}
          >
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${cls}`}>
              <Icon size={20} />
            </div>
            <div>
              <p className="text-2xl font-extrabold text-gray-900">{counts[key]}</p>
              <p className="text-sm text-gray-500">{label}</p>
            </div>
          </button>
        ))}
      </div>

      {/* Table controls */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          <span className="font-semibold text-gray-700">{filtered.length}</span> records
          {filterStatus !== 'all' && (
            <> · {PAY_STATUS[filterStatus]?.label}</>
          )}
        </p>
        <button
          onClick={() => { setLoading(true); fetchRecords().finally(() => setLoading(false)) }}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-600
            border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center gap-3 py-24 text-gray-400">
            <Loader2 size={22} className="animate-spin text-blue-600" />
            <span className="text-sm">Loading…</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-gray-400">
            <CheckCircle2 size={40} className="text-gray-200" />
            <p className="text-sm font-medium">No records for this status.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[740px]">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60">
                  {['Employee','Department','Pay Period','Net Salary','Payment Status','Last Updated','Action'].map(h => (
                    <th key={h} className="px-5 py-4 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(r => {
                  const cfg  = r.employee_salary_config
                  const name = cfg?.employee_name ?? '—'
                  const ps   = PAY_STATUS[r.status]
                  const isUp = updating === r.id
                  const lastUpdated = r.processed_at ?? r.created_at

                  return (
                    <tr key={r.id} className="hover:bg-gray-50/40 transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
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
                      <td className="px-5 py-4 text-gray-500">{cfg?.department ?? '—'}</td>
                      <td className="px-5 py-4 text-gray-500 text-xs whitespace-nowrap">{fmtPeriod(r.pay_period)}</td>
                      {/* net_salary is GENERATED in DB */}
                      <td className="px-5 py-4 font-bold text-gray-900">{fmt$(r.net_salary)}</td>
                      <td className="px-5 py-4">
                        {ps ? (
                          <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${ps.cls}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${ps.dot}`} />
                            {ps.label}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">{r.status}</span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-xs text-gray-400 whitespace-nowrap">
                        {fmtDateTime(lastUpdated)}
                      </td>
                      <td className="px-5 py-4">
                        {isUp ? (
                          <Loader2 size={16} className="animate-spin text-blue-600" />
                        ) : r.status === 'Unpaid' ? (
                          <button onClick={() => advance(r.id, r.status)}
                            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors whitespace-nowrap">
                            → Processing
                          </button>
                        ) : r.status === 'Processing' ? (
                          <button onClick={() => advance(r.id, r.status)}
                            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors whitespace-nowrap">
                            → Mark Paid
                          </button>
                        ) : (
                          <span className="flex items-center gap-1 text-xs text-emerald-600 font-semibold">
                            <CheckCircle2 size={13} /> Complete
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
