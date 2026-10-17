/**
 * Generic UI building blocks + helpers shared across pages
 * (payroll tabs, Users, Settings). Visual language mirrors DailyAttendance.
 */
import { useState, useEffect, useCallback } from 'react'
import { CheckCircle2, AlertCircle, X, Search, Loader2 } from 'lucide-react'

export const fmtDate   = iso =>
  iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'

export const fmtDateTime = iso =>
  iso ? new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—'

export const sumBy    = (list, fn) => list.reduce((s, x) => s + fn(x), 0)

const AVATAR_BG = [
  'bg-indigo-500', 'bg-sky-500', 'bg-emerald-500', 'bg-amber-500',
  'bg-rose-500', 'bg-violet-500', 'bg-teal-500', 'bg-fuchsia-500',
]

export const fullName = e => `${e?.first_name ?? ''} ${e?.last_name ?? ''}`.trim()

export const initialsOf = name =>
  (name ?? '').trim().split(/\s+/).map(w => w[0] ?? '').join('').slice(0, 2).toUpperCase() || '?'

export const avatarBg = id =>
  AVATAR_BG[[...(id ?? '')].reduce((s, c) => s + c.charCodeAt(0), 0) % AVATAR_BG.length]

export const indexById = list => Object.fromEntries(list.map(x => [x.id, x]))

export function downloadCSV(rows, filename) {
  if (!rows.length) return
  const keys = Object.keys(rows[0])
  const csv  = [keys.join(','), ...rows.map(r => keys.map(k => JSON.stringify(r[k] ?? '')).join(','))].join('\n')
  const url  = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const a    = Object.assign(document.createElement('a'), { href: url, download: filename })
  document.body.appendChild(a); a.click(); document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function useToast() {
  const [toast, setToast] = useState(null)
  const show    = useCallback((type, message) => setToast({ type, message }), [])
  const dismiss = useCallback(() => setToast(null), [])
  return [toast, show, dismiss]
}

export function useArmed() {
  const [armed, setArmed] = useState(null)
  useEffect(() => {
    if (!armed) return
    const t = setTimeout(() => setArmed(null), 3500)
    return () => clearTimeout(t)
  }, [armed])
  const fire = key => {
    if (armed === key) { setArmed(null); return true }
    setArmed(key); return false
  }
  return [armed, fire]
}

export function useSelection() {
  const [selected, setSelected] = useState(() => new Set())
  const toggle = id => setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const toggleAll = (ids, allOn) => setSelected(s => {
    const n = new Set(s)
    ids.forEach(id => (allOn ? n.delete(id) : n.add(id)))
    return n
  })
  const clear = () => setSelected(new Set())
  return { selected, toggle, toggleAll, clear, setSelected }
}

export const INPUT_CLS =
  'w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 bg-gray-50 focus:bg-white ' +
  'focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/20 focus:border-[#1e3a8a] transition-colors'

export function Toast({ toast, onDismiss }) {
  useEffect(() => {
    if (!toast) return
    const id = setTimeout(onDismiss, 4000)
    return () => clearTimeout(id)
  }, [toast, onDismiss])
  if (!toast) return null
  const ok = toast.type === 'success'
  return (
    <div className={`fixed top-20 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-sm z-[70] flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl border text-sm font-medium
      ${ok ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
      {ok ? <CheckCircle2 size={17} className="text-emerald-500 shrink-0" /> : <AlertCircle size={17} className="text-red-500 shrink-0" />}
      <span className="flex-1">{toast.message}</span>
      <button onClick={onDismiss} className="opacity-50 hover:opacity-100"><X size={14} /></button>
    </div>
  )
}

export function Avatar({ id, name, src, size = 'w-10 h-10 text-xs', rounded = 'rounded-xl' }) {
  if (src) {
    return <img src={src} alt={name ?? ''} className={`${size} ${rounded} object-cover shrink-0 bg-gray-100`} />
  }
  return (
    <div className={`${size} ${avatarBg(id ?? name)} ${rounded} flex items-center justify-center text-white font-bold shrink-0`}>
      {initialsOf(name)}
    </div>
  )
}

export function RateRing({ pct, color = '#34d399', label }) {
  const r = 36
  const c = 2 * Math.PI * r
  return (
    <div className="relative w-[88px] h-[88px] shrink-0">
      <svg width="88" height="88" viewBox="0 0 88 88" className="-rotate-90">
        <circle cx="44" cy="44" r={r} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="9" />
        <circle
          cx="44" cy="44" r={r} fill="none" stroke={color} strokeWidth="9" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(100, Math.max(0, pct)) / 100)}
          style={{ transition: 'stroke-dashoffset .6s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-extrabold text-white leading-none">{pct}%</span>
        {label && <span className="text-[9px] font-semibold text-indigo-200 uppercase tracking-wider mt-1">{label}</span>}
      </div>
    </div>
  )
}

export function HeroCard({ ring, eyebrow, headline, sub, stats = [], className = 'col-span-2' }) {
  return (
    <div className={`${className} rounded-2xl p-5 text-white shadow-lg relative overflow-hidden bg-gradient-to-br from-[#1e3a8a] via-[#1e3a8a] to-indigo-900`}>
      <div className="absolute -top-12 -right-12 w-40 h-40 bg-indigo-400/20 rounded-full blur-3xl pointer-events-none" />
      <div className="relative flex items-center gap-5">
        {ring}
        <div className="min-w-0">
          <p className="text-xs font-semibold text-indigo-200 uppercase tracking-widest">{eyebrow}</p>
          <p className="text-2xl font-extrabold text-white mt-1 tracking-tight truncate">{headline}</p>
          {sub && <p className="text-xs text-white/80 mt-0.5 truncate">{sub}</p>}
          {stats.length > 0 && (
            <div className="flex gap-5 mt-3">
              {stats.map(s => (
                <div key={s.label} className="min-w-0">
                  <p className="text-[10px] text-indigo-200 uppercase tracking-wider flex items-center gap-1 whitespace-nowrap">
                    {s.Icon && <s.Icon size={11} />} {s.label}
                  </p>
                  <p className="text-sm font-bold mt-0.5 truncate">{s.value}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export function StatCard({ label, value, sub, pct, Icon, iconCls, barCls, active, onClick }) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      onClick={onClick}
      className={`text-left bg-white rounded-2xl border p-4 shadow-sm transition-all duration-200 min-w-0
        ${onClick ? 'hover:-translate-y-0.5 hover:shadow-md' : ''}
        ${active ? 'border-[#1e3a8a] ring-2 ring-[#1e3a8a]/15' : 'border-gray-100'}`}
    >
      <div className="flex items-center justify-between">
        <span className={`w-9 h-9 rounded-xl flex items-center justify-center ${iconCls}`}><Icon size={17} /></span>
        {pct != null && <span className="text-[11px] font-semibold text-gray-400">{pct}%</span>}
      </div>
      <p className="text-2xl font-extrabold text-gray-900 mt-3 leading-none truncate">{value}</p>
      <p className="text-xs font-medium text-gray-500 mt-1 truncate">{label}</p>
      {sub && <p className="text-[11px] text-gray-400 mt-0.5 truncate">{sub}</p>}
      {pct != null && (
        <div className="h-1 bg-gray-100 rounded-full mt-3 overflow-hidden">
          <div className={`h-full rounded-full ${barCls}`} style={{ width: `${pct}%`, transition: 'width .5s ease' }} />
        </div>
      )}
    </Tag>
  )
}

export function SearchBox({ value, onChange, placeholder = 'Search employee…' }) {
  return (
    <div className="relative flex-1 min-w-0">
      <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
      <input
        value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className={`${INPUT_CLS} pl-9 pr-8`}
      />
      {value && (
        <button onClick={() => onChange('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700">
          <X size={14} />
        </button>
      )}
    </div>
  )
}

export function DeptSelect({ value, onChange, options }) {
  return (
    <select
      value={value} onChange={e => onChange(e.target.value)}
      className="md:w-48 px-3 py-2.5 text-sm rounded-xl border border-gray-200 bg-gray-50 text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/20 focus:border-[#1e3a8a] transition-colors"
    >
      <option value="all">All departments</option>
      {options.map(d => <option key={d} value={d}>{d}</option>)}
    </select>
  )
}

export function FilterPills({ items, value, onChange }) {
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto -mx-1 px-1 pb-0.5">
      {items.map(f => {
        const on = value === f.key
        return (
          <button key={f.key} onClick={() => onChange(f.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors
              ${on ? 'bg-[#1e3a8a] text-white shadow-sm' : 'bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-gray-700'}`}>
            {!on && <span className={`w-1.5 h-1.5 rounded-full ${f.dot}`} />}
            {f.label}
            <span className={`px-1.5 rounded-full text-[10px] ${on ? 'bg-white/20' : 'bg-white text-gray-400 ring-1 ring-gray-200'}`}>
              {f.count}
            </span>
          </button>
        )
      })}
    </div>
  )
}

export function ToolButton({ onClick, disabled, title, children, tone = 'default', className = '' }) {
  const tones = {
    default: 'text-gray-600 border border-gray-200 hover:bg-gray-50',
    primary: 'bg-[#1e3a8a] text-white hover:bg-[#162d6e] shadow-sm',
    success: 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100',
    armed:   'bg-emerald-500 text-white hover:bg-emerald-600',
  }
  return (
    <button onClick={onClick} disabled={disabled} title={title}
      className={`flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-colors disabled:opacity-40 ${tones[tone]} ${className}`}>
      {children}
    </button>
  )
}

export function SkeletonRows({ count = 5 }) {
  return (
    <div className="divide-y divide-gray-50">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-5 py-4 animate-pulse">
          <div className="w-10 h-10 rounded-xl bg-gray-100" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-40 bg-gray-100 rounded" />
            <div className="h-2.5 w-24 bg-gray-100 rounded" />
          </div>
          <div className="hidden md:block h-3 w-20 bg-gray-100 rounded" />
          <div className="hidden md:block h-7 w-28 bg-gray-100 rounded-xl" />
        </div>
      ))}
    </div>
  )
}

export function EmptyState({ Icon, title, sub, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 gap-2 text-gray-400 text-center">
      <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center">
        <Icon size={26} className="text-gray-300" />
      </div>
      <p className="text-sm font-semibold text-gray-500 mt-1">{title}</p>
      {sub && <p className="text-xs text-gray-400 max-w-sm">{sub}</p>}
      {action}
    </div>
  )
}

export function Checkbox({ checked, onChange }) {
  return (
    <input type="checkbox" checked={checked} onChange={onChange}
      className="w-4 h-4 rounded border-gray-300 accent-[#1e3a8a] cursor-pointer shrink-0" />
  )
}

export function Th({ children, right, className = '' }) {
  return (
    <th className={`px-4 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap ${right ? 'text-right' : 'text-left'} ${className}`}>
      {children}
    </th>
  )
}

export function Modal({ onClose, maxWidth = '520px', children, as: Tag = 'div', ...rest }) {
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(3px)' }}
      onClick={onClose}
    >
      <Tag
        {...rest}
        onClick={e => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl flex flex-col mx-auto"
        style={{ width: '100%', maxWidth, maxHeight: '90vh', animation: 'payModalIn .2s cubic-bezier(.4,0,.2,1) forwards' }}
      >
        {children}
      </Tag>
      <style>{`
        @keyframes payModalIn {
          from { opacity: 0; transform: translateY(8px) scale(.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  )
}

export function ModalHeader({ person, title, sub, onClose }) {
  return (
    <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100 shrink-0">
      {person && <Avatar id={person.id} name={person.name} />}
      <div className="min-w-0 flex-1">
        <p className="font-bold text-gray-900 truncate">{title ?? person?.name}</p>
        {sub && <p className="text-xs text-gray-400 truncate">{sub}</p>}
      </div>
      <button type="button" onClick={onClose}
        className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-700 transition-colors">
        <X size={16} />
      </button>
    </div>
  )
}

export function ErrorNote({ children }) {
  if (!children) return null
  return (
    <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
      <AlertCircle size={14} className="shrink-0" /> {children}
    </div>
  )
}

export function PrimaryButton({ busy, children, ...props }) {
  return (
    <button {...props}
      className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold text-white bg-[#1e3a8a] hover:bg-[#162d6e] disabled:opacity-60 transition-colors">
      {busy && <Loader2 size={14} className="animate-spin" />} {children}
    </button>
  )
}

export function BulkBar({ count, busy, onClear, children }) {
  if (!count) return null
  return (
    <div className="fixed bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-2rem)] sm:w-auto">
      <div className="flex items-center gap-2 sm:gap-3 bg-slate-900 text-white rounded-2xl shadow-2xl px-3 sm:px-4 py-2.5">
        <span className="text-sm font-semibold whitespace-nowrap pl-1">{count} selected</span>
        <div className="w-px h-6 bg-white/15" />
        <div className="flex items-center gap-1 overflow-x-auto">{children}</div>
        {busy && <Loader2 size={16} className="animate-spin text-white/70 shrink-0" />}
        <button onClick={onClear} title="Clear selection"
          className="w-8 h-8 rounded-lg flex items-center justify-center text-white/60 hover:bg-white/10 hover:text-white transition-colors shrink-0">
          <X size={15} />
        </button>
      </div>
    </div>
  )
}

export function BulkAction({ onClick, disabled, title, dot, Icon, children, danger }) {
  return (
    <button onClick={onClick} disabled={disabled} title={title}
      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors
        disabled:opacity-30 disabled:cursor-not-allowed
        ${danger ? 'text-rose-300 hover:bg-rose-500/20 hover:text-rose-200' : 'text-white/80 hover:bg-white/10 hover:text-white'}`}>
      {dot && <span className={`w-2 h-2 rounded-full ${dot}`} />}
      {Icon && <Icon size={14} />}
      <span className={dot ? 'hidden sm:inline' : ''}>{children}</span>
    </button>
  )
}

export function ListFooter({ shown, total, noun = 'records', right }) {
  return (
    <div className="flex items-center justify-between gap-3 px-5 py-3 border-t border-gray-100 text-xs text-gray-400">
      <span>Showing {shown} of {total} {noun}</span>
      {right}
    </div>
  )
}

/** Small segmented tabs (used in panels and toolbars). */
export function Tabs({ value, onChange, items }) {
  return (
    <div className="flex items-center gap-1 p-0.5 bg-gray-50 rounded-lg border border-gray-100 shrink-0">
      {items.map(i => (
        <button key={i.key} onClick={() => onChange(i.key)}
          className={`px-2.5 py-1 rounded-md text-[11px] font-semibold whitespace-nowrap transition-all
            ${value === i.key ? 'bg-white text-[#1e3a8a] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
          {i.label}{i.count != null && <span className="ml-1 text-gray-400">{i.count}</span>}
        </button>
      ))}
    </div>
  )
}
