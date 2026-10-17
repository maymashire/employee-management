/** Dashboard widgets — presentational only; data comes from model.js. */
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import {
  ArrowUpRight, ArrowDownRight, Minus, AlertOctagon, AlertTriangle, Info, CheckCircle2, ChevronRight,
  LogIn, LogOut, UserX, Sun, Hourglass, Cake, Sparkles, Award, Flag, PartyPopper, Clock,
} from 'lucide-react'
import { Avatar, Tabs } from '../../components/ui'

export { Tabs }
import { fmtMins, fmtTime, parseDate } from './model'

// ── Palette (validated: attendance statuses in this stack order; blue ordinal ramp) ──
export const ATT = {
  present:  { label: 'Present',  color: '#10b981', Icon: CheckCircle2 },
  late:     { label: 'Late',     color: '#f59e0b', Icon: Clock },
  half_day: { label: 'Half day', color: '#0ea5e9', Icon: Hourglass },
  absent:   { label: 'Absent',   color: '#f43f5e', Icon: UserX },
  holiday:  { label: 'Holiday',  color: '#8b5cf6', Icon: Sun },
  unmarked: { label: 'Not marked', color: '#e2e8f0', Icon: Minus },
}
const RAMP = ['#86b6ef', '#5598e7', '#2a78d6', '#1c5cab', '#104281']
const rampFor = rate => (rate == null ? null : RAMP[rate < 60 ? 0 : rate < 75 ? 1 : rate < 90 ? 2 : rate < 97 ? 3 : 4])

const USD0 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
export const money = n => USD0.format(Number(n) || 0)
export const moneyK = n => {
  const v = Number(n) || 0
  return Math.abs(v) >= 1000 ? `$${(v / 1000).toFixed(v >= 100000 ? 0 : 1)}k` : money(v)
}
const nameOf = e => `${e?.first_name ?? ''} ${e?.last_name ?? ''}`.trim() || 'Former employee'

// ── Shell ─────────────────────────────────────────────────────────────────────
export function Panel({ title, sub, Icon, action, children, className = '', bodyClass = 'p-5' }) {
  return (
    <section className={`bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col min-w-0 ${className}`}
      style={{ animation: 'dashIn .45s cubic-bezier(.2,.7,.2,1) both' }}>
      <header className="flex items-start justify-between gap-3 px-5 pt-4">
        <div className="flex items-center gap-2.5 min-w-0">
          {Icon && <span className="w-8 h-8 rounded-xl bg-indigo-50 text-[#1e3a8a] flex items-center justify-center shrink-0"><Icon size={16} /></span>}
          <div className="min-w-0">
            <h3 className="text-[15px] font-bold text-gray-900 truncate">{title}</h3>
            {sub && <p className="text-xs text-gray-400 truncate">{sub}</p>}
          </div>
        </div>
        {action}
      </header>
      <div className={`flex-1 min-h-0 ${bodyClass}`}>{children}</div>
    </section>
  )
}

export function ViewLink({ to, children = 'View all' }) {
  return (
    <Link to={to} className="flex items-center gap-0.5 text-xs font-semibold text-[#1e3a8a] hover:underline whitespace-nowrap shrink-0 mt-1.5">
      {children} <ChevronRight size={13} />
    </Link>
  )
}

export function LiveClock({ className = '' }) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => { const id = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(id) }, [])
  return (
    <span className={`tabular-nums ${className}`}>
      {now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
    </span>
  )
}

// ── KPI tile with sparkline ───────────────────────────────────────────────────
export function Sparkline({ data, color = '#2a78d6', width = 120, height = 36, fill = true }) {
  const pts = data.map((v, i) => ({ v, i })).filter(p => p.v != null)
  if (pts.length < 2) return <div style={{ width, height }} />
  const vals = pts.map(p => p.v)
  const min  = Math.min(...vals), max = Math.max(...vals)
  const span = max - min || 1
  const x = i => (i / (data.length - 1)) * (width - 4) + 2
  const y = v => height - 3 - ((v - min) / span) * (height - 8)
  const line = pts.map((p, k) => `${k ? 'L' : 'M'}${x(p.i).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ')
  const area = `${line} L${x(pts.at(-1).i).toFixed(1)},${height} L${x(pts[0].i).toFixed(1)},${height} Z`
  const id = `spk-${color.slice(1)}`
  const last = pts.at(-1)
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {fill && <path d={area} fill={`url(#${id})`} />}
      <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(last.i)} cy={y(last.v)} r="3" fill={color} stroke="#fff" strokeWidth="1.5" />
    </svg>
  )
}

export function Delta({ value, suffix = '', goodWhenUp = true, label }) {
  if (value == null || Number.isNaN(value)) return <span className="text-[11px] text-gray-400">{label ?? 'No comparison yet'}</span>
  const flat = Math.abs(value) < 0.5
  const up   = value > 0
  const good = flat ? null : up === goodWhenUp
  const cls  = flat ? 'bg-gray-100 text-gray-500' : good ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
  const Icon = flat ? Minus : up ? ArrowUpRight : ArrowDownRight
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] text-gray-400">
      <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md font-bold ${cls}`}>
        <Icon size={12} />{flat ? '0' : `${up ? '+' : ''}${Math.round(value * 10) / 10}`}{suffix}
      </span>
      {label}
    </span>
  )
}

export function KpiTile({ label, value, sub, Icon, tone, delta, series, color, to }) {
  const navigate = useNavigate()
  return (
    <button onClick={() => to && navigate(to)}
      className="group text-left bg-white rounded-2xl border border-gray-100 shadow-sm p-4 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 min-w-0"
      style={{ animation: 'dashIn .45s cubic-bezier(.2,.7,.2,1) both' }}>
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 min-w-0">
          <span className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${tone}`}><Icon size={16} /></span>
          <span className="text-xs font-semibold text-gray-500 truncate">{label}</span>
        </span>
        {to && <ArrowUpRight size={15} className="text-gray-300 group-hover:text-[#1e3a8a] transition-colors shrink-0" />}
      </div>
      <div className="flex items-end justify-between gap-3 mt-3">
        <div className="min-w-0">
          <p className="text-[28px] font-extrabold text-gray-900 tracking-tight leading-none tabular-nums truncate">{value}</p>
          <div className="mt-2">{delta}</div>
        </div>
        {series && <Sparkline data={series} color={color} width={96} height={40} />}
      </div>
      {sub && <p className="text-[11px] text-gray-400 mt-2 truncate">{sub}</p>}
    </button>
  )
}

// ── Live attendance ring ──────────────────────────────────────────────────────
export function LiveAttendance({ todayM, total, shiftStart }) {
  const r = 58, C = 2 * Math.PI * r
  const order = ['present', 'late', 'half_day', 'absent', 'holiday', 'unmarked']
  let offset = 0
  const segs = order.map(k => {
    const n   = todayM.counts[k]
    const len = total ? (n / total) * C : 0
    const seg = { k, n, len, offset }
    offset += len
    return seg
  }).filter(s => s.n > 0)

  return (
    <div className="flex flex-col sm:flex-row lg:flex-col xl:flex-row items-center gap-5">
      <div className="relative w-[148px] h-[148px] shrink-0">
        <svg width="148" height="148" viewBox="0 0 148 148" className="-rotate-90">
          <circle cx="74" cy="74" r={r} fill="none" stroke="#f1f5f9" strokeWidth="14" />
          {segs.map(s => (
            <circle key={s.k} cx="74" cy="74" r={r} fill="none" stroke={ATT[s.k].color} strokeWidth="14"
              strokeDasharray={`${Math.max(0, s.len - (segs.length > 1 ? 2 : 0))} ${C}`} strokeDashoffset={-s.offset}
              style={{ transition: 'stroke-dasharray .6s ease, stroke-dashoffset .6s ease' }}>
              <title>{`${ATT[s.k].label}: ${s.n}`}</title>
            </circle>
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-extrabold text-gray-900 leading-none tabular-nums">{todayM.rate}<span className="text-lg text-gray-300">%</span></span>
          <span className="text-[11px] text-gray-400 mt-1">{todayM.attended} of {todayM.expected} in</span>
        </div>
      </div>
      <div className="flex-1 w-full space-y-1.5">
        {order.map(k => (
          <div key={k} className="flex items-center gap-2 text-xs">
            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: ATT[k].color }} />
            <span className="text-gray-500 flex-1">{ATT[k].label}</span>
            <span className="font-bold text-gray-800 tabular-nums">{todayM.counts[k]}</span>
            <span className="text-gray-300 w-9 text-right tabular-nums">{total ? Math.round((todayM.counts[k] / total) * 100) : 0}%</span>
          </div>
        ))}
        <div className="grid grid-cols-3 gap-2 pt-2.5 mt-1 border-t border-gray-100">
          <MiniStat label="On shift" value={todayM.onShift} />
          <MiniStat label="Avg in" value={fmtMins(todayM.avgIn)} />
          <MiniStat label="On time" value={todayM.onTime == null ? '—' : `${todayM.onTime}%`} title={`Checked in by ${fmtTime(shiftStart)}`} />
        </div>
      </div>
    </div>
  )
}

function MiniStat({ label, value, title }) {
  return (
    <div title={title}>
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{label}</p>
      <p className="text-sm font-bold text-gray-800 mt-0.5 tabular-nums">{value}</p>
    </div>
  )
}

// ── Attendance trend (stacked) ────────────────────────────────────────────────
const STACK = ['present', 'late', 'half_day', 'absent']

function TrendTip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-lg px-3.5 py-3 text-xs min-w-[170px]">
      <p className="font-bold text-gray-800">{parseDate(d.date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</p>
      <p className="text-gray-400 mb-2">{d.rate == null ? 'No attendance recorded' : `${d.rate}% attendance`}</p>
      {STACK.map(k => (
        <p key={k} className="flex items-center justify-between gap-4 py-0.5 text-gray-500">
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm" style={{ background: ATT[k].color }} />{ATT[k].label}</span>
          <span className="font-semibold text-gray-800 tabular-nums">{d[k]}</span>
        </p>
      ))}
    </div>
  )
}

export function TrendLegend() {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      {STACK.map(k => (
        <span key={k} className="flex items-center gap-1.5 text-[11px] font-medium text-gray-500">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ background: ATT[k].color }} /> {ATT[k].label}
        </span>
      ))}
    </div>
  )
}

export function TrendChart({ data }) {
  const dense = data.length > 31
  return (
    <ResponsiveContainer width="100%" height={236}>
      <BarChart data={data} margin={{ top: 6, right: 4, left: -18, bottom: 0 }} barCategoryGap={dense ? '12%' : '24%'}>
        <CartesianGrid stroke="#f1f5f9" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false}
          interval={dense ? 13 : data.length > 14 ? 2 : 0} />
        <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
        <Tooltip content={<TrendTip />} cursor={{ fill: '#f8fafc', radius: 6 }} />
        {STACK.map((k, i) => (
          <Bar key={k} dataKey={k} stackId="a" fill={ATT[k].color} maxBarSize={28}
            stroke="#fff" strokeWidth={dense ? 0 : 1.5}
            radius={i === STACK.length - 1 ? [4, 4, 0, 0] : 0} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}

// ── Heatmap ───────────────────────────────────────────────────────────────────
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function Heatmap({ weeks }) {
  const [hover, setHover] = useState(null)
  const cells   = weeks.flat().filter(c => !c.future && c.rate != null)
  const average = cells.length ? Math.round(cells.reduce((s, c) => s + c.rate, 0) / cells.length) : null
  const best    = cells.reduce((b, c) => (!b || c.rate > b.rate ? c : b), null)
  const byDow   = DOW.map((_, d) => {
    const l = weeks.map(w => w[d]).filter(c => !c.future && c.rate != null)
    return l.length ? Math.round(l.reduce((s, c) => s + c.rate, 0) / l.length) : null
  })
  const weakest = byDow.reduce((w, v, i) => (v != null && (w == null || v < byDow[w]) ? i : w), null)
  const fmtDay  = s => parseDate(s).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })

  return (
    <div className="flex flex-col md:flex-row gap-6">
      <div className="shrink-0">
        <div className="flex gap-[3px] pl-8 mb-1 h-4">
          {weeks.map((w, i) => {
            const m = parseDate(w[0].date).toLocaleDateString('en-US', { month: 'short' })
            const prev = i ? parseDate(weeks[i - 1][0].date).toLocaleDateString('en-US', { month: 'short' }) : null
            return <span key={i} className="w-[18px] text-[10px] text-gray-400 overflow-visible whitespace-nowrap">{m !== prev ? m : ''}</span>
          })}
        </div>
        <div className="flex gap-[3px]">
          <div className="flex flex-col gap-[3px] w-7 mr-1">
            {DOW.map((d, i) => <span key={d} className="h-[18px] text-[10px] text-gray-400 leading-[18px]">{i % 2 ? d : ''}</span>)}
          </div>
          {weeks.map((w, i) => (
            <div key={i} className="flex flex-col gap-[3px]">
              {w.map(c => {
                const bg = c.future ? 'transparent' : rampFor(c.rate) ?? '#f1f5f9'
                return (
                  <span key={c.date}
                    onMouseEnter={() => setHover(c)} onMouseLeave={() => setHover(null)}
                    title={c.future ? '' : `${fmtDay(c.date)} · ${c.rate == null ? 'no records' : `${c.rate}% (${c.attended}/${c.expected})`}`}
                    className={`w-[18px] h-[18px] rounded-[4px] transition-transform ${c.future ? 'border border-dashed border-gray-200' : 'hover:scale-125 cursor-default'}`}
                    style={{ background: bg, outline: hover?.date === c.date ? '2px solid #0f172a' : 'none', outlineOffset: 1 }} />
                )
              })}
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between gap-3 mt-3 pl-8">
          <p className="text-[11px] text-gray-500 h-4 tabular-nums">
            {hover && !hover.future ? `${fmtDay(hover.date)} · ${hover.rate == null ? 'no records' : `${hover.rate}% · ${hover.attended} of ${hover.expected}`}` : ''}
          </p>
          <div className="flex items-center gap-1 text-[10px] text-gray-400">
            <span>Less</span>
            <span className="w-3 h-3 rounded-[3px]" style={{ background: '#f1f5f9' }} title="No records" />
            {RAMP.map(c => <span key={c} className="w-3 h-3 rounded-[3px]" style={{ background: c }} />)}
            <span>More</span>
          </div>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-2 md:grid-cols-1 gap-3 content-start min-w-0">
        <HeatStat label="13-week average" value={average == null ? '—' : `${average}%`} />
        <HeatStat label="Best day" value={best ? `${best.rate}%` : '—'} sub={best ? fmtDay(best.date) : null} />
        <HeatStat label="Weakest weekday" value={weakest == null ? '—' : DOW[weakest]} sub={weakest == null ? null : `${byDow[weakest]}% on average`} />
        <HeatStat label="Days tracked" value={cells.length} sub="with attendance records" />
      </div>
    </div>
  )
}

function HeatStat({ label, value, sub }) {
  return (
    <div className="rounded-xl bg-gray-50 px-3.5 py-2.5 min-w-0">
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{label}</p>
      <p className="text-lg font-extrabold text-gray-900 leading-tight tabular-nums">{value}</p>
      {sub && <p className="text-[11px] text-gray-400 truncate">{sub}</p>}
    </div>
  )
}

// ── Insights ──────────────────────────────────────────────────────────────────
const SEV = {
  critical: { Icon: AlertOctagon,  cls: 'bg-rose-50 text-rose-600',       label: 'Critical' },
  warning:  { Icon: AlertTriangle, cls: 'bg-amber-50 text-amber-600',     label: 'Warning' },
  info:     { Icon: Info,          cls: 'bg-sky-50 text-sky-600',         label: 'Info' },
  success:  { Icon: CheckCircle2,  cls: 'bg-emerald-50 text-emerald-600', label: 'Good' },
}

export function Insights({ items }) {
  if (!items.length) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-8 gap-2">
        <span className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-500 flex items-center justify-center"><PartyPopper size={22} /></span>
        <p className="text-sm font-semibold text-gray-700">All clear</p>
        <p className="text-xs text-gray-400">Nothing needs your attention right now.</p>
      </div>
    )
  }
  return (
    <ul className="space-y-2">
      {items.map((it, i) => {
        const s = SEV[it.severity]
        return (
          <li key={i} className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-gray-50 transition-colors">
            <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${s.cls}`} title={s.label}><s.Icon size={15} /></span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium text-gray-700 leading-snug">{it.text}</p>
              {it.action && (
                <Link to={it.action.to} className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-[#1e3a8a] hover:underline mt-0.5">
                  {it.action.label} <ChevronRight size={12} />
                </Link>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}

// ── Payroll pipeline ──────────────────────────────────────────────────────────
export function PayrollPipeline({ pay }) {
  const segs = [
    { key: 'Paid',       label: 'Paid',          n: pay.Paid.n,       amt: pay.Paid.amt,       color: '#10b981' },
    { key: 'Processing', label: 'Processing',    n: pay.Processing.n, amt: pay.Processing.amt, color: '#f59e0b' },
    { key: 'Unpaid',     label: 'Draft',         n: pay.Unpaid.n,     amt: pay.Unpaid.amt,     color: '#64748b' },
    { key: 'pending',    label: 'Not generated', n: pay.pending.n,    amt: pay.pending.amt,    color: '#e2e8f0', est: true },
  ]
  const totalAmt = segs.reduce((s, x) => s + x.amt, 0)
  const maxNet   = Math.max(...pay.months6.map(m => m.net), 1)

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{pay.monthLabel} net payroll</p>
          <p className="text-3xl font-extrabold text-gray-900 tracking-tight tabular-nums mt-1">{money(pay.total)}</p>
          <div className="mt-1.5"><Delta value={pay.delta} suffix="%" goodWhenUp={false} label="vs last month" /></div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-extrabold text-emerald-600 tabular-nums">{pay.paidPct}%</p>
          <p className="text-[11px] text-gray-400">paid</p>
        </div>
      </div>

      <div>
        <div className="flex h-3 rounded-full overflow-hidden bg-gray-100 gap-[2px]">
          {segs.filter(s => s.amt > 0).map(s => (
            <div key={s.key} title={`${s.label}: ${money(s.amt)}`} style={{ width: `${(s.amt / (totalAmt || 1)) * 100}%`, background: s.color, transition: 'width .6s ease' }} />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-3">
          {segs.map(s => (
            <div key={s.key} className="flex items-center gap-2 text-xs min-w-0">
              <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: s.color }} />
              <span className="text-gray-500 truncate">{s.label}</span>
              <span className="ml-auto font-bold text-gray-800 tabular-nums whitespace-nowrap">{s.est ? '≈ ' : ''}{moneyK(s.amt)}</span>
              <span className="text-gray-300 tabular-nums w-5 text-right">{s.n}</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Last 6 months</p>
          <span className="flex items-center gap-3 text-[10px] text-gray-400">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm" style={{ background: '#2a78d6' }} /> Paid</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm" style={{ background: '#cde2fb' }} /> Not yet paid</span>
          </span>
        </div>
        <div className="flex items-end gap-2 h-24">
          {pay.months6.map((m, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1.5 min-w-0 h-full justify-end"
              title={`${m.label}: ${money(m.net)} net · ${money(m.paid)} paid`}>
              <div className="w-full max-w-[34px] rounded-t-[4px] overflow-hidden flex flex-col justify-end"
                style={{ height: `${Math.max(m.net ? 6 : 2, (m.net / maxNet) * 100)}%`, background: m.net ? '#cde2fb' : '#f1f5f9' }}>
                <div style={{ height: `${m.net ? (m.paid / m.net) * 100 : 0}%`, background: '#2a78d6' }} />
              </div>
              <span className={`text-[10px] ${i === 5 ? 'font-bold text-gray-700' : 'text-gray-400'}`}>{m.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Departments ───────────────────────────────────────────────────────────────
export function DeptHealth({ depts, showSalary }) {
  if (!depts.length) return <p className="text-sm text-gray-400 py-8 text-center">No departments yet</p>
  const maxHead = Math.max(...depts.map(d => d.headcount))
  return (
    <div className="overflow-x-auto -mx-5">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
            <th className="text-left px-5 pb-2">Department</th>
            <th className="text-left px-3 pb-2">Headcount</th>
            <th className="text-left px-3 pb-2">In today</th>
            <th className="text-right px-3 pb-2">Late</th>
            {showSalary && <th className="text-right px-5 pb-2">Avg salary</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {depts.map(d => (
            <tr key={d.name} className="hover:bg-gray-50/60 transition-colors">
              <td className="px-5 py-2.5 font-semibold text-gray-800 whitespace-nowrap">{d.name}</td>
              <td className="px-3 py-2.5">
                <div className="flex items-center gap-2 min-w-[110px]">
                  <span className="font-bold text-gray-800 tabular-nums w-5">{d.headcount}</span>
                  <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${(d.headcount / maxHead) * 100}%`, background: '#2a78d6' }} />
                  </div>
                </div>
              </td>
              <td className="px-3 py-2.5">
                <div className="flex items-center gap-2 min-w-[110px]">
                  <span className="text-xs font-semibold text-gray-700 tabular-nums w-9">{d.rate == null ? '—' : `${d.rate}%`}</span>
                  <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                    <div className="h-full rounded-full bg-emerald-500" style={{ width: `${d.rate ?? 0}%` }} />
                  </div>
                </div>
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums">
                {d.late ? <span className="text-xs font-bold text-amber-600">{d.late}</span> : <span className="text-gray-300">—</span>}
              </td>
              {showSalary && <td className="px-5 py-2.5 text-right text-gray-700 tabular-nums whitespace-nowrap">{d.avgSalary ? money(d.avgSalary) : '—'}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── People lists ──────────────────────────────────────────────────────────────
function PersonRow({ emp, right, sub }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <Avatar id={emp?.id} name={nameOf(emp)} src={emp?.avatar_url || null} size="w-9 h-9 text-[11px]" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-gray-800 truncate">{nameOf(emp)}</p>
        <p className="text-[11px] text-gray-400 truncate">{sub ?? [emp?.job_title, emp?.departments?.name].filter(Boolean).join(' · ')}</p>
      </div>
      <div className="shrink-0 text-right">{right}</div>
    </div>
  )
}

function Empty({ Icon, text }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-8 gap-2 text-gray-400">
      <Icon size={22} className="text-gray-300" />
      <p className="text-xs">{text}</p>
    </div>
  )
}

export function ActivityFeed({ feed, notIn, limit = 6 }) {
  const [tab, setTab] = useState('feed')
  return (
    <Panel title="Live activity" sub="Today's check-ins and check-outs" Icon={LogIn}
      action={<Tabs value={tab} onChange={setTab} items={[{ key: 'feed', label: 'Activity', count: feed.length }, { key: 'out', label: 'Not in', count: notIn.length }]} />}>
      {tab === 'feed' ? (
        feed.length ? (
          <div className="divide-y divide-gray-50">
            {feed.slice(0, limit).map(ev => {
              const meta = ev.kind === 'in' ? { Icon: LogIn, cls: 'text-emerald-600 bg-emerald-50', text: 'Checked in' }
                : ev.kind === 'out' ? { Icon: LogOut, cls: 'text-sky-600 bg-sky-50', text: 'Checked out' }
                : { Icon: ATT[ev.kind]?.Icon ?? Info, cls: 'text-gray-500 bg-gray-100', text: `Marked ${ATT[ev.kind]?.label.toLowerCase() ?? ev.kind}` }
              return (
                <PersonRow key={ev.key} emp={ev.emp}
                  sub={<span className="flex items-center gap-1.5">{meta.text}{ev.late && <span className="px-1.5 rounded bg-amber-50 text-amber-600 font-semibold">late</span>}</span>}
                  right={
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold tabular-nums ${meta.cls}`}>
                      <meta.Icon size={12} /> {ev.time ? fmtTime(ev.time) : '—'}
                    </span>
                  } />
              )
            })}
          </div>
        ) : <Empty Icon={LogIn} text="No check-ins recorded yet today" />
      ) : notIn.length ? (
        <div className="divide-y divide-gray-50">
          {notIn.slice(0, limit).map(e => <PersonRow key={e.id} emp={e} right={<span className="text-[11px] text-gray-400">Not marked</span>} />)}
          {notIn.length > limit && <Link to="/attendance/daily" className="block pt-2 text-xs font-semibold text-[#1e3a8a] hover:underline">+{notIn.length - limit} more · mark attendance</Link>}
        </div>
      ) : <Empty Icon={CheckCircle2} text="Everyone has been marked today" />}
    </Panel>
  )
}

export function PeoplePanel({ newHires, anniversaries, limit = 6 }) {
  const [tab, setTab] = useState(newHires.length || !anniversaries.length ? 'new' : 'anniv')
  const fmt = s => parseDate(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return (
    <Panel title="People" sub="New joiners and milestones" Icon={Sparkles}
      action={<Tabs value={tab} onChange={setTab} items={[{ key: 'new', label: 'New hires', count: newHires.length }, { key: 'anniv', label: 'Anniversaries', count: anniversaries.length }]} />}>
      {tab === 'new' ? (
        newHires.length ? (
          <div className="divide-y divide-gray-50">
            {newHires.slice(0, limit).map(e => (
              <PersonRow key={e.id} emp={e} right={<span className="px-2 py-1 rounded-lg text-[11px] font-semibold bg-indigo-50 text-[#1e3a8a]">{fmt(e.hire_date)}</span>} />
            ))}
          </div>
        ) : <Empty Icon={Flag} text="No new hires in the last 30 days" />
      ) : anniversaries.length ? (
        <div className="divide-y divide-gray-50">
          {anniversaries.slice(0, limit).map(a => (
            <PersonRow key={a.emp.id} emp={a.emp}
              right={
                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold ${a.past ? 'bg-gray-100 text-gray-500' : 'bg-amber-50 text-amber-700'}`}>
                  <Cake size={12} /> {a.years} yr{a.years !== 1 ? 's' : ''} · {fmt(a.emp.hire_date.replace(/^\d{4}/, String(new Date().getFullYear())))}
                </span>
              } />
          ))}
        </div>
      ) : <Empty Icon={Cake} text="No work anniversaries this month" />}
    </Panel>
  )
}

export function LeadersPanel({ perfect, attention, limit = 6 }) {
  const [tab, setTab] = useState(attention.length ? 'attention' : 'perfect')
  return (
    <Panel title="This month" sub="Attendance standouts" Icon={Award}
      action={<Tabs value={tab} onChange={setTab} items={[{ key: 'perfect', label: 'Perfect', count: perfect.length }, { key: 'attention', label: 'Watch', count: attention.length }]} />}>
      {tab === 'perfect' ? (
        perfect.length ? (
          <div className="divide-y divide-gray-50">
            {perfect.slice(0, limit).map(p => (
              <PersonRow key={p.emp.id} emp={p.emp}
                right={<span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold bg-emerald-50 text-emerald-700"><Award size={12} /> {p.attended} days</span>} />
            ))}
          </div>
        ) : <Empty Icon={Award} text="No perfect attendance records yet this month" />
      ) : attention.length ? (
        <div className="divide-y divide-gray-50">
          {attention.slice(0, limit).map(p => (
            <PersonRow key={p.emp.id} emp={p.emp}
              right={
                <span className="flex items-center gap-1 justify-end">
                  {p.absent > 0 && <span className="px-1.5 py-0.5 rounded-md text-[11px] font-bold bg-rose-50 text-rose-600">{p.absent} absent</span>}
                  {p.late > 0 && <span className="px-1.5 py-0.5 rounded-md text-[11px] font-bold bg-amber-50 text-amber-600">{p.late} late</span>}
                </span>
              } />
          ))}
        </div>
      ) : <Empty Icon={CheckCircle2} text="No attendance concerns this month" />}
    </Panel>
  )
}

