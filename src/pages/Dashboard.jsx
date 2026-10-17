/**
 * Dashboard — live command center.
 * Data: employees, departments, ~13 weeks of attendance and (for Admin/Finance)
 * payroll + salary configs. Everything derived in dashboard/model.js.
 * Auto-refreshes every minute while the tab is visible; widgets can be
 * shown/hidden per user (saved in their preferences).
 */
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Users, CalendarCheck, Timer, Wallet, UserPlus, RefreshCw, SlidersHorizontal, ScanLine,
  CalendarDays, Calculator, UsersRound, BarChart3, Activity, Lightbulb, Grid3x3, Building2,
  AlertCircle, Check, X,
} from 'lucide-react'
import * as db from '../lib/db'
import { useAuth } from '../context/AuthContext'
import { useCompany } from '../context/CompanyContext'
import { Avatar } from '../components/ui'
import { buildModel, toDateStr, addDays, fmtMins, fmtTime } from './dashboard/model'
import {
  Panel, ViewLink, Tabs, LiveClock, KpiTile, Delta, LiveAttendance, TrendChart, TrendLegend, Heatmap,
  Insights, PayrollPipeline, DeptHealth, ActivityFeed, PeoplePanel, LeadersPanel, money, moneyK,
} from './dashboard/widgets'

const WIDGETS = [
  { id: 'kpis',     label: 'Key metrics' },
  { id: 'live',     label: 'Live attendance' },
  { id: 'trend',    label: 'Attendance trend' },
  { id: 'insights', label: 'Smart insights' },
  { id: 'heatmap',  label: 'Attendance heatmap' },
  { id: 'payroll',  label: 'Payroll pipeline', payroll: true },
  { id: 'depts',    label: 'Department health' },
  { id: 'activity', label: 'Live activity' },
  { id: 'people',   label: 'People' },
  { id: 'leaders',  label: 'Attendance standouts' },
]
const RANGES = [7, 14, 30, 90]
const REFRESH_MS = 60_000

function greeting(d = new Date()) {
  const h = d.getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

function readRange() {
  try { const v = Number(localStorage.getItem('dash_trend_range')); return RANGES.includes(v) ? v : 14 } catch { return 14 }
}

function UpdatedAgo({ at }) {
  const [, tick] = useState(0)
  useEffect(() => { const id = setInterval(() => tick(t => t + 1), 10_000); return () => clearInterval(id) }, [])
  if (!at) return null
  const s = Math.round((Date.now() - at) / 1000)
  return <span>{s < 10 ? 'Updated just now' : s < 60 ? `Updated ${s}s ago` : `Updated ${Math.round(s / 60)} min ago`}</span>
}

function CustomizeMenu({ widgets, hidden, onToggle, onReset, onClose }) {
  const ref = useRef(null)
  useEffect(() => {
    const close = e => { if (!ref.current?.contains(e.target)) onClose() }
    const esc   = e => { if (e.key === 'Escape') onClose() }
    document.addEventListener('mousedown', close); document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc) }
  }, [onClose])
  return (
    <div ref={ref} className="absolute right-0 top-full mt-2 w-64 bg-white rounded-2xl shadow-2xl border border-gray-100 z-30 overflow-hidden text-gray-800"
      style={{ animation: 'dashIn .18s ease-out both' }}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <p className="text-sm font-bold">Customize dashboard</p>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X size={15} /></button>
      </div>
      <div className="p-1.5 max-h-80 overflow-y-auto">
        {widgets.map(w => {
          const on = !hidden.includes(w.id)
          return (
            <button key={w.id} onClick={() => onToggle(w.id)}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-gray-50 text-sm text-left">
              <span className={`w-5 h-5 rounded-md flex items-center justify-center border transition-colors ${on ? 'bg-[#1e3a8a] border-[#1e3a8a] text-white' : 'border-gray-300'}`}>
                {on && <Check size={13} />}
              </span>
              <span className={on ? 'font-medium' : 'text-gray-400'}>{w.label}</span>
            </button>
          )
        })}
      </div>
      <div className="px-4 py-2.5 border-t border-gray-100">
        <button onClick={onReset} className="text-xs font-semibold text-[#1e3a8a] hover:underline">Show all widgets</button>
      </div>
    </div>
  )
}

function SkeletonDash() {
  const block = h => <div className={`bg-white rounded-2xl border border-gray-100 ${h} shimmer`} />
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{[0, 1, 2, 3].map(i => <div key={i}>{block('h-32')}</div>)}</div>
      <div className="grid lg:grid-cols-12 gap-4">
        <div className="lg:col-span-4">{block('h-72')}</div>
        <div className="lg:col-span-8">{block('h-72')}</div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════════
export default function Dashboard() {
  const { profile, displayName, avatarUrl, canAccessPayroll, isAdmin, isHR, updateMe } = useAuth()
  const { company } = useCompany()
  const navigate = useNavigate()

  const [raw,        setRaw]        = useState(null)
  const [loading,    setLoading]    = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error,      setError]      = useState('')
  const [updatedAt,  setUpdatedAt]  = useState(null)
  const [range,      setRange]      = useState(readRange)
  const [menuOpen,   setMenuOpen]   = useState(false)
  const reqId = useRef(0)

  const fetchData = useCallback(async (soft = false) => {
    const id = ++reqId.current
    soft ? setRefreshing(true) : setLoading(true)
    try {
      const now = new Date()
      const [employees, departments, attendance, payroll, configs] = await Promise.all([
        db.getEmployees(),
        db.getDepartments(),
        db.getAttendanceRange(toDateStr(addDays(now, -100)), toDateStr(now)),
        canAccessPayroll ? db.getPayrollRecords()  : Promise.resolve([]),
        canAccessPayroll ? db.getSalaryConfigs()   : Promise.resolve([]),
      ])
      if (id !== reqId.current) return
      setRaw({ employees, departments, attendance, payroll, configs })
      setUpdatedAt(Date.now())
      setError('')
    } catch (err) {
      if (id === reqId.current) setError(err.message)
    }
    if (id === reqId.current) { setLoading(false); setRefreshing(false) }
  }, [canAccessPayroll])

  useEffect(() => { fetchData() }, [fetchData])

  // Live: refresh every minute while visible, and when the tab regains focus
  useEffect(() => {
    const tick = () => { if (document.visibilityState === 'visible') fetchData(true) }
    const id = setInterval(tick, REFRESH_MS)
    document.addEventListener('visibilitychange', tick)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', tick) }
  }, [fetchData])

  useEffect(() => { try { localStorage.setItem('dash_trend_range', String(range)) } catch {} }, [range])

  const m = useMemo(() => raw && buildModel({
    ...raw, now: new Date(), shiftStart: company.shift_start || '09:00', canPayroll: canAccessPayroll, trendDays: range,
  }), [raw, company.shift_start, canAccessPayroll, range])

  // ── Widget visibility ──
  const prefs   = profile?.preferences ?? {}
  const hidden  = prefs.dashboard_hidden ?? []
  const widgets = WIDGETS.filter(w => !w.payroll || canAccessPayroll)
  const show    = id => !hidden.includes(id) && widgets.some(w => w.id === id)
  const saveHidden = list => updateMe({ preferences: { ...prefs, dashboard_hidden: list } }).catch(() => {})
  const toggleWidget = id => saveHidden(hidden.includes(id) ? hidden.filter(h => h !== id) : [...hidden, id])

  const firstName = displayName.split(' ')[0]
  const canManagePeople = isAdmin || isHR
  const ACTIONS = [
    { label: 'Mark attendance', Icon: CalendarDays, to: '/attendance/daily' },
    { label: 'Check in / out',  Icon: ScanLine,     to: '/attendance/check-in-out' },
    ...(canManagePeople ? [{ label: 'Add employee', Icon: UserPlus,  to: '/employees?new=1' }] : []),
    ...(canAccessPayroll ? [{ label: 'Run payroll', Icon: Calculator, to: '/payroll/process' }] : []),
    ...(isAdmin ? [{ label: 'Add user', Icon: UsersRound, to: '/users' }] : []),
    { label: 'Analytics', Icon: BarChart3, to: '/analytics' },
  ]

  return (
    <div className="space-y-4 pb-10">
      <style>{`@keyframes dashIn { from { opacity: 0; transform: translateY(6px) } to { opacity: 1; transform: none } }`}</style>

      {/* ── Command banner ── */}
      <section className="relative rounded-2xl text-white shadow-lg"
        style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 45%, #1e3a8a 100%)' }}>
        <div className="absolute inset-0 overflow-hidden rounded-2xl pointer-events-none">
          <div className="absolute -top-20 -left-16 w-72 h-72 rounded-full opacity-25" style={{ background: 'radial-gradient(circle, #6366f1, transparent 70%)' }} />
          <div className="absolute -bottom-24 right-10 w-80 h-80 rounded-full opacity-20" style={{ background: 'radial-gradient(circle, #3b82f6, transparent 70%)' }} />
        </div>

        <div className="relative p-5 sm:p-6">
          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-5">
            <div className="flex items-center gap-4 min-w-0">
              <div className="relative shrink-0">
                <Avatar id={profile?.id} name={displayName} src={avatarUrl} size="w-14 h-14 text-base" rounded="rounded-2xl" />
                <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-400 ring-[3px] ring-[#1e1b4b]" title="Online" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-indigo-300 uppercase tracking-widest">{greeting()}</p>
                <h2 className="text-2xl sm:text-[28px] font-extrabold tracking-tight leading-tight truncate">{firstName}, welcome back</h2>
                <p className="text-sm text-indigo-100/80 mt-1 line-clamp-2">
                  {m ? m.summary : loading ? 'Gathering today’s numbers…' : '—'}
                </p>
              </div>
            </div>

            <div className="flex items-start justify-between lg:justify-end gap-4">
              <div className="lg:text-right">
                <LiveClock className="text-2xl sm:text-3xl font-extrabold tracking-tight" />
                <p className="text-xs text-indigo-200 mt-0.5">
                  {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                </p>
                <p className="text-[11px] text-indigo-300/80 mt-0.5">{company.name} · shift starts {fmtTime(company.shift_start || '09:00')}</p>
              </div>
              <div className="relative flex items-center gap-1.5">
                <button onClick={() => fetchData(true)} title="Refresh now"
                  className="w-9 h-9 rounded-xl flex items-center justify-center bg-white/10 hover:bg-white/20 border border-white/10 transition-colors">
                  <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
                </button>
                <button onClick={() => setMenuOpen(o => !o)} title="Customize"
                  className={`w-9 h-9 rounded-xl flex items-center justify-center border border-white/10 transition-colors ${menuOpen ? 'bg-white text-[#1e3a8a]' : 'bg-white/10 hover:bg-white/20'}`}>
                  <SlidersHorizontal size={15} />
                </button>
                {menuOpen && (
                  <CustomizeMenu widgets={widgets} hidden={hidden} onToggle={toggleWidget}
                    onReset={() => saveHidden([])} onClose={() => setMenuOpen(false)} />
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 mt-5">
            {ACTIONS.map(a => (
              <button key={a.label} onClick={() => navigate(a.to)}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/20 border border-white/10 backdrop-blur transition-colors">
                <a.Icon size={14} /> {a.label}
              </button>
            ))}
            <span className="ml-auto hidden sm:flex items-center gap-1.5 text-[11px] text-indigo-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Live · <UpdatedAgo at={updatedAt} />
            </span>
          </div>
        </div>
      </section>

      {error && (
        <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
          <span className="flex items-center gap-2"><AlertCircle size={16} /> Couldn't load the dashboard: {error}</span>
          <button onClick={() => fetchData()} className="text-xs font-bold hover:underline">Retry</button>
        </div>
      )}

      {loading && !m ? <SkeletonDash /> : m && (
        <>
          {/* ── KPIs ── */}
          {show('kpis') && (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              <KpiTile label="Active employees" value={m.headcount.value} Icon={Users} tone="bg-indigo-50 text-indigo-500"
                delta={<Delta value={m.headcount.delta} label="in 30 days" />}
                series={m.headcount.series} color="#6366f1" to="/employees"
                sub={`${m.headcount.departments} departments · ${m.newHires.length} new this month`} />
              <KpiTile label="Attendance today" value={`${m.todayM.rate}%`} Icon={CalendarCheck} tone="bg-emerald-50 text-emerald-500"
                delta={<Delta value={m.avgRate7 == null ? null : m.todayM.rate - m.avgRate7} suffix=" pts" label="vs 7-day avg" />}
                series={m.rate14} color="#10b981" to="/attendance/daily"
                sub={`${m.todayM.attended} in · ${m.todayM.counts.absent} absent · ${m.todayM.counts.unmarked} not marked`} />
              <KpiTile label="On-time arrivals" value={m.todayM.onTime == null ? '—' : `${m.todayM.onTime}%`} Icon={Timer} tone="bg-amber-50 text-amber-500"
                delta={<Delta value={m.todayM.onTime == null || m.avgOnTime7 == null ? null : m.todayM.onTime - m.avgOnTime7} suffix=" pts" label="vs 7-day avg" />}
                series={m.onTime14} color="#f59e0b" to="/attendance/reports"
                sub={`Avg check-in ${fmtMins(m.todayM.avgIn)} · ${m.lateLast7} late this week`} />
              {m.pay ? (
                <KpiTile label={`${m.pay.monthLabel} payroll`} value={moneyK(m.pay.total || m.pay.pending.amt)} Icon={Wallet} tone="bg-sky-50 text-sky-500"
                  delta={<Delta value={m.pay.delta} suffix="%" goodWhenUp={false} label="vs last month" />}
                  series={m.pay.months6.map(x => x.net)} color="#0ea5e9" to="/payroll/process"
                  sub={m.pay.generated ? `${m.pay.paidPct}% paid · ${m.pay.generated} of ${m.pay.eligible} generated` : `Not generated · ≈ ${money(m.pay.pending.amt)} projected`} />
              ) : (
                <KpiTile label="New hires (30 days)" value={m.newHires.length} Icon={UserPlus} tone="bg-sky-50 text-sky-500"
                  delta={<Delta value={m.headcount.hires.at(-1) - (m.headcount.hires.at(-2) ?? 0)} label="vs last month" />}
                  series={m.headcount.hires} color="#0ea5e9" to="/employees"
                  sub={`${m.anniversaries.length} work anniversaries this month`} />
              )}
            </div>
          )}

          {/* ── Live attendance + trend ── */}
          {(show('live') || show('trend')) && (
            <div className="grid lg:grid-cols-12 gap-4">
              {show('live') && (
                <Panel className={show('trend') ? 'lg:col-span-5 xl:col-span-4' : 'lg:col-span-12'} title="Live attendance" Icon={Activity}
                  sub={`${m.active.length} active employees · today`} action={<ViewLink to="/attendance/daily">Open</ViewLink>}>
                  <LiveAttendance todayM={m.todayM} total={m.active.length} shiftStart={company.shift_start || '09:00'} />
                </Panel>
              )}
              {show('trend') && (
                <Panel className={show('live') ? 'lg:col-span-7 xl:col-span-8' : 'lg:col-span-12'} title="Attendance trend" Icon={BarChart3}
                  sub={`Daily status mix · last ${range} days`}
                  action={<Tabs value={range} onChange={setRange} items={RANGES.map(r => ({ key: r, label: `${r}d` }))} />}>
                  <div className="mb-2"><TrendLegend /></div>
                  <TrendChart data={m.trend} />
                </Panel>
              )}
            </div>
          )}

          {/* ── Insights + heatmap ── */}
          {(show('insights') || show('heatmap')) && (
            <div className="grid lg:grid-cols-12 gap-4">
              {show('insights') && (
                <Panel className={show('heatmap') ? 'lg:col-span-5 xl:col-span-4' : 'lg:col-span-12'} title="Smart insights" Icon={Lightbulb}
                  sub="What needs attention, ranked" bodyClass="px-3 pb-3 pt-3">
                  <Insights items={m.insights} />
                </Panel>
              )}
              {show('heatmap') && (
                <Panel className={show('insights') ? 'lg:col-span-7 xl:col-span-8' : 'lg:col-span-12'} title="Attendance heatmap" Icon={Grid3x3}
                  sub="Daily attendance rate · last 13 weeks" action={<ViewLink to="/attendance/calendar">Calendar</ViewLink>}>
                  <Heatmap weeks={m.heatmap} />
                </Panel>
              )}
            </div>
          )}

          {/* ── Payroll + departments ── */}
          {(show('payroll') || show('depts')) && (
            <div className="grid lg:grid-cols-12 gap-4">
              {show('payroll') && m.pay && (
                <Panel className={show('depts') ? 'lg:col-span-5' : 'lg:col-span-12'} title="Payroll pipeline" Icon={Wallet}
                  sub={`${m.pay.monthLabel} · base payroll ${money(m.pay.baseMonthly)}/mo`} action={<ViewLink to="/payroll/process">Process</ViewLink>}>
                  <PayrollPipeline pay={m.pay} />
                </Panel>
              )}
              {show('depts') && (
                <Panel className={show('payroll') && m.pay ? 'lg:col-span-7' : 'lg:col-span-12'} title="Department health" Icon={Building2}
                  sub="Headcount, today's attendance and lateness" action={<ViewLink to="/departments" />}>
                  <DeptHealth depts={m.depts} showSalary={canAccessPayroll} />
                </Panel>
              )}
            </div>
          )}

          {/* ── People ── */}
          {(show('activity') || show('people') || show('leaders')) && (
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
              {show('activity') && <ActivityFeed feed={m.todayM.feed} notIn={m.todayM.notIn} />}
              {show('people')   && <PeoplePanel newHires={m.newHires} anniversaries={m.anniversaries} />}
              {show('leaders')  && <LeadersPanel perfect={m.perfect} attention={m.attention} />}
            </div>
          )}

          {widgets.every(w => hidden.includes(w.id)) && (
            <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
              <p className="text-sm font-semibold text-gray-600">All widgets are hidden</p>
              <button onClick={() => saveHidden([])} className="mt-2 text-xs font-semibold text-[#1e3a8a] hover:underline">Show all widgets</button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
