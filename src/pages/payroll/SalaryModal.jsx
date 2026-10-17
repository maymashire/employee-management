/** Set / adjust one employee's base salary. Used by Salary List and Payroll Process. */
import { useState } from 'react'
import { Trash2, TrendingUp, TrendingDown } from 'lucide-react'
import {
  Modal, ModalHeader, MoneyInput, ErrorNote, PrimaryButton, PayBadge,
  fmt$, fmtPeriod, netOf, num,
} from './shared'

const QUICK = [-5, 5, 10, 15, 20]

export default function SalaryModal({ person, config, history = [], onClose, onSave, onDelete }) {
  const current = config ? num(config.basic_salary) : 0
  const [value,   setValue]   = useState(config ? String(current) : '')
  const [busy,    setBusy]    = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [error,   setError]   = useState('')

  const next  = num(value)
  const diff  = next - current
  const pctCh = current ? (diff / current) * 100 : null

  async function submit(e) {
    e.preventDefault()
    if (value === '' || next <= 0) { setError('Enter a base salary greater than zero.'); return }
    setBusy(true)
    try { await onSave(Math.round(next * 100) / 100); onClose() }
    catch (err) { setError(err.message); setBusy(false) }
  }

  async function remove() {
    if (!confirm) { setConfirm(true); return }
    setBusy(true)
    try { await onDelete(); onClose() }
    catch (err) { setError(err.message); setBusy(false) }
  }

  return (
    <Modal as="form" onSubmit={submit} onClose={onClose} maxWidth="480px">
      <ModalHeader
        person={person}
        sub={[person.job || 'Employee', person.dept].filter(Boolean).join(' · ')}
        onClose={onClose}
      />

      <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-5">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-gray-50 px-4 py-3">
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Current</p>
            <p className="text-lg font-extrabold text-gray-900 mt-1 tabular-nums">{config ? fmt$(current) : 'Not set'}</p>
          </div>
          <div className="rounded-xl bg-indigo-50/60 px-4 py-3">
            <p className="text-[11px] font-bold text-indigo-400 uppercase tracking-widest">Annual</p>
            <p className="text-lg font-extrabold text-[#1e3a8a] mt-1 tabular-nums">{fmt$(next * 12)}</p>
          </div>
        </div>

        <div>
          <MoneyInput label="Monthly base salary" value={value} onChange={v => { setValue(v); setError('') }} />
          {config && (
            <div className="flex flex-wrap gap-1.5 mt-2.5">
              {QUICK.map(p => (
                <button key={p} type="button"
                  onClick={() => setValue(String(Math.round(current * (1 + p / 100) * 100) / 100))}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors
                    ${p < 0 ? 'border-rose-200 text-rose-600 hover:bg-rose-50' : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'}`}>
                  {p > 0 ? '+' : ''}{p}%
                </button>
              ))}
            </div>
          )}
          {config && diff !== 0 && value !== '' && (
            <p className={`flex items-center gap-1.5 text-xs font-semibold mt-3 ${diff > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {diff > 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
              {diff > 0 ? '+' : '−'}{fmt$(Math.abs(diff))} / month
              {pctCh != null && ` (${diff > 0 ? '+' : ''}${pctCh.toFixed(1)}%)`}
              <span className="text-gray-400 font-medium">· {diff > 0 ? '+' : '−'}{fmt$(Math.abs(diff * 12))} / year</span>
            </p>
          )}
          <p className="text-[11px] text-gray-400 mt-2">
            New payroll runs use this amount. Unpaid drafts can be refreshed from Payroll Process.
          </p>
        </div>

        {history.length > 0 && (
          <div>
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">Recent pay</p>
            <div className="rounded-xl border border-gray-100 divide-y divide-gray-50">
              {history.slice(0, 5).map(r => (
                <div key={r.id} className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-sm">
                  <span className="text-gray-500 w-20">{fmtPeriod(r.pay_period)}</span>
                  <span className="font-semibold text-gray-800 tabular-nums flex-1 text-right">{fmt$(netOf(r))}</span>
                  <PayBadge status={r.status} />
                </div>
              ))}
            </div>
          </div>
        )}

        <ErrorNote>{error}</ErrorNote>
      </div>

      <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-gray-100 shrink-0">
        {config && onDelete ? (
          <button type="button" onClick={remove} disabled={busy}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors disabled:opacity-50
              ${confirm ? 'bg-red-500 text-white hover:bg-red-600' : 'text-red-500 hover:bg-red-50'}`}>
            <Trash2 size={14} /> {confirm ? 'Confirm remove' : 'Remove salary'}
          </button>
        ) : <span />}
        <div className="flex items-center gap-2">
          <button type="button" onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-100 transition-colors">
            Cancel
          </button>
          <PrimaryButton type="submit" disabled={busy} busy={busy}>Save</PrimaryButton>
        </div>
      </div>
    </Modal>
  )
}
