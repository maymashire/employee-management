/**
 * Pure data model for the dashboard: takes raw Firestore rows and returns
 * every number, series, list and insight the widgets render.
 */
import { computeNet } from '../../lib/db'

const pad = n => String(n).padStart(2, '0')
export const toDateStr = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const addDays   = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }
export const parseDate = s => new Date(`${s}T00:00:00`)
export const minsOf    = t => { const [h, m] = (t ?? '0:0').split(':').map(Number); return h * 60 + m }
export const fmtMins   = m => {
  if (m == null) return '—'
  const d = new Date(); d.setHours(Math.floor(m / 60), Math.round(m % 60), 0, 0)
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}
export const fmtTime = t => (t ? fmtMins(minsOf(t)) : '—')

const ATT_KEYS  = ['present', 'late', 'half_day', 'absent', 'holiday']
const ATTENDED  = ['present', 'late', 'half_day']
const netOf     = r => (r.net_salary != null ? Number(r.net_salary) || 0 : computeNet(r))
const sum       = (list, fn) => list.reduce((s, x) => s + fn(x), 0)
const avg       = list => (list.length ? list.reduce((s, x) => s + x, 0) / list.length : null)
const fullName  = e => `${e?.first_name ?? ''} ${e?.last_name ?? ''}`.trim() || 'Unknown'
const recEmpId  = r => r.employee_id ?? r.employee_salary_config?.employee_id ?? null
const plural    = (n, w, p = `${w}s`) => `${n} ${n === 1 ? w : p}`
const SEVERITY  = { critical: 0, warning: 1, info: 2, success: 3 }

export function buildModel({
  employees = [], departments = [], attendance = [], payroll = [], configs = [],
  now = new Date(), shiftStart = '09:00', canPayroll = false, trendDays = 14,
}) {
  const today     = toDateStr(now)
  const monthKey  = today.slice(0, 7)
  const active    = employees.filter(e => e.status === 'active')
  const activeIds = new Set(active.map(e => e.id))
  const empMap    = Object.fromEntries(employees.map(e => [e.id, e]))
  const hiredBy   = date => active.filter(e => !e.hire_date || e.hire_date <= date).length

  // ── Attendance indexed by date (active employees only) ──
  const byDate = {}
  attendance.forEach(a => {
    if (!activeIds.has(a.employee_id)) return
    const d = (byDate[a.date] ??= { present: 0, late: 0, half_day: 0, absent: 0, holiday: 0, recs: [] })
    if (ATT_KEYS.includes(a.status)) d[a.status]++
    d.recs.push(a)
  })
  const statsFor = date => {
    const d = byDate[date]
    if (!d) return null
    const attended = d.present + d.late + d.half_day
    const expected = Math.max(0, hiredBy(date) - d.holiday)
    return {
      ...d, attended, expected,
      rate:   expected ? Math.round((attended / expected) * 100) : null,
      onTime: d.present + d.late ? Math.round((d.present / (d.present + d.late)) * 100) : null,
    }
  }
  const lastDays = n => Array.from({ length: n }, (_, i) => toDateStr(addDays(now, i - n + 1)))

  // ── Today ──
  const t        = byDate[today] ?? { present: 0, late: 0, half_day: 0, absent: 0, holiday: 0, recs: [] }
  const attended = t.present + t.late + t.half_day
  const expected = Math.max(0, active.length - t.holiday)
  const markedIds = new Set(t.recs.map(r => r.employee_id))
  const checkIns  = t.recs.filter(r => r.clock_in).map(r => minsOf(r.clock_in))
  const lateBy    = t.recs.filter(r => r.clock_in && r.clock_in > shiftStart).map(r => minsOf(r.clock_in) - minsOf(shiftStart))
  const todayM = {
    counts:   { present: t.present, late: t.late, half_day: t.half_day, absent: t.absent, holiday: t.holiday, unmarked: active.length - markedIds.size },
    attended, expected,
    rate:     expected ? Math.round((attended / expected) * 100) : 0,
    onTime:   t.present + t.late ? Math.round((t.present / (t.present + t.late)) * 100) : null,
    avgIn:    avg(checkIns),
    avgLate:  avg(lateBy),
    onShift:  t.recs.filter(r => r.clock_in && !r.clock_out && ATTENDED.includes(r.status)).length,
    notIn:    active.filter(e => !markedIds.has(e.id)),
    feed: t.recs.flatMap(r => {
      const emp = empMap[r.employee_id]
      const ev = []
      if (r.clock_in)  ev.push({ key: `${r.id}-in`,  emp, kind: 'in',  time: r.clock_in,  late: r.clock_in > shiftStart })
      if (r.clock_out) ev.push({ key: `${r.id}-out`, emp, kind: 'out', time: r.clock_out })
      if (!r.clock_in && !r.clock_out) ev.push({ key: `${r.id}-st`, emp, kind: r.status, time: null })
      return ev
    }).sort((a, b) => (b.time ?? '').localeCompare(a.time ?? '')),
  }

  // ── Series ──
  const trend = lastDays(trendDays).map(date => {
    const s = statsFor(date)
    const d = parseDate(date)
    return {
      date,
      label: trendDays > 31 ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' }),
      present: s?.present ?? 0, late: s?.late ?? 0, half_day: s?.half_day ?? 0, absent: s?.absent ?? 0,
      rate: s?.rate ?? null, expected: s?.expected ?? hiredBy(date),
    }
  })
  const last14       = lastDays(14).map(statsFor)
  const rate14       = last14.map(s => s?.rate ?? null)
  const onTime14     = last14.map(s => s?.onTime ?? null)
  const prev7Rates   = lastDays(8).slice(0, 7).map(statsFor).filter(s => s?.rate != null).map(s => s.rate)
  const avgRate7     = avg(prev7Rates)
  const prev7OnTime  = lastDays(8).slice(0, 7).map(statsFor).filter(s => s?.onTime != null).map(s => s.onTime)
  const avgOnTime7   = avg(prev7OnTime)
  const lateLast7    = sum(lastDays(7), d => byDate[d]?.late ?? 0)
  const latePrev7    = sum(lastDays(14).slice(0, 7), d => byDate[d]?.late ?? 0)

  // Heatmap: 13 full weeks (Sun → Sat), current week last
  const weekStart = addDays(now, -now.getDay() - 12 * 7)
  const heatmap = Array.from({ length: 13 }, (_, w) => Array.from({ length: 7 }, (_, d) => {
    const date = toDateStr(addDays(weekStart, w * 7 + d))
    const s = date <= today ? statsFor(date) : null
    return { date, future: date > today, rate: s?.rate ?? null, attended: s?.attended ?? 0, expected: s?.expected ?? 0 }
  }))

  // ── Headcount ──
  const months12 = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1)
    const end = toDateStr(new Date(d.getFullYear(), d.getMonth() + 1, 0))
    const key = toDateStr(d).slice(0, 7)
    return {
      key, label: d.toLocaleDateString('en-US', { month: 'short' }),
      headcount: hiredBy(end > today ? today : end),
      hires: active.filter(e => e.hire_date?.startsWith(key)).length,
    }
  })
  const ago30     = toDateStr(addDays(now, -30))
  const newHires  = active.filter(e => e.hire_date && e.hire_date > ago30 && e.hire_date <= today)
    .sort((a, b) => b.hire_date.localeCompare(a.hire_date))
  const anniversaries = active
    .filter(e => e.hire_date && e.hire_date.slice(5, 7) === monthKey.slice(5) && e.hire_date.slice(0, 4) < monthKey.slice(0, 4))
    .map(e => ({ emp: e, years: now.getFullYear() - Number(e.hire_date.slice(0, 4)), day: Number(e.hire_date.slice(8, 10)), past: e.hire_date.slice(5) < today.slice(5) }))
    .sort((a, b) => a.day - b.day)

  // ── This month per employee ──
  const monthStats = {}
  Object.entries(byDate).forEach(([date, d]) => {
    if (!date.startsWith(monthKey)) return
    d.recs.forEach(r => {
      const s = (monthStats[r.employee_id] ??= { attended: 0, late: 0, absent: 0, half_day: 0 })
      if (ATTENDED.includes(r.status)) s.attended++
      if (r.status === 'late') s.late++
      if (r.status === 'absent') s.absent++
      if (r.status === 'half_day') s.half_day++
    })
  })
  const daysTracked = Object.keys(byDate).filter(d => d.startsWith(monthKey)).length
  const perfect = active
    .map(e => ({ emp: e, ...(monthStats[e.id] ?? { attended: 0, late: 0, absent: 0, half_day: 0 }) }))
    .filter(s => s.absent === 0 && s.late === 0 && s.half_day === 0 && s.attended > 0 && s.attended >= Math.min(daysTracked, 3))
    .sort((a, b) => b.attended - a.attended)
  const attention = active
    .map(e => ({ emp: e, ...(monthStats[e.id] ?? { attended: 0, late: 0, absent: 0, half_day: 0 }) }))
    .filter(s => s.absent >= 2 || s.late >= 3)
    .sort((a, b) => (b.absent * 2 + b.late) - (a.absent * 2 + a.late))

  // ── Departments ──
  const cfgByEmp = {}
  configs.forEach(c => { if (c.employee_id && !cfgByEmp[c.employee_id]) cfgByEmp[c.employee_id] = c })
  const deptNames = [...new Set([...departments.map(d => d.name), ...active.map(e => e.departments?.name ?? 'Unassigned')])]
  const depts = deptNames.map(name => {
    const members  = active.filter(e => (e.departments?.name ?? 'Unassigned') === name)
    const inToday  = members.filter(e => t.recs.some(r => r.employee_id === e.id && ATTENDED.includes(r.status))).length
    const holidays = members.filter(e => t.recs.some(r => r.employee_id === e.id && r.status === 'holiday')).length
    const salaries = members.map(e => Number(cfgByEmp[e.id]?.basic_salary)).filter(v => v > 0)
    const exp      = members.length - holidays
    return {
      name, headcount: members.length, inToday,
      rate: exp > 0 ? Math.round((inToday / exp) * 100) : null,
      share: active.length ? (members.length / active.length) * 100 : 0,
      avgSalary: avg(salaries), payrollBase: sum(salaries, v => v),
      late: members.filter(e => t.recs.some(r => r.employee_id === e.id && r.status === 'late')).length,
    }
  }).filter(d => d.headcount > 0).sort((a, b) => b.headcount - a.headcount)

  // ── Payroll ──
  let pay = null
  if (canPayroll) {
    const period = `${monthKey}-01`
    const recs   = payroll.filter(r => r.pay_period === period)
    const status = k => { const l = recs.filter(r => r.status === k); return { n: l.length, amt: sum(l, netOf) } }
    const genIds = new Set(recs.map(recEmpId))
    const eligible = active.filter(e => cfgByEmp[e.id])
    const pending  = eligible.filter(e => !genIds.has(e.id))
    const months6  = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1)
      const p = `${toDateStr(d).slice(0, 7)}-01`
      const l = payroll.filter(r => r.pay_period === p)
      return { label: d.toLocaleDateString('en-US', { month: 'short' }), net: sum(l, netOf), paid: sum(l.filter(r => r.status === 'Paid'), netOf), n: l.length }
    })
    const total  = sum(recs, netOf)
    const lastM  = months6[4].net
    const overdue = payroll.filter(r => (r.pay_period ?? '') < period && r.status !== 'Paid')
    pay = {
      monthLabel: now.toLocaleDateString('en-US', { month: 'long' }),
      total, generated: recs.length, eligible: eligible.length,
      pending: { n: pending.length, amt: sum(pending, e => Number(cfgByEmp[e.id].basic_salary) || 0) },
      Unpaid: status('Unpaid'), Processing: status('Processing'), Paid: status('Paid'),
      paidPct: total > 0 ? Math.round((status('Paid').amt / total) * 100) : 0,
      months6, delta: lastM > 0 && total > 0 ? ((total - lastM) / lastM) * 100 : null,
      noSalary: active.filter(e => !cfgByEmp[e.id]).length,
      overdue: { n: overdue.length, amt: sum(overdue, netOf) },
      baseMonthly: sum(eligible, e => Number(cfgByEmp[e.id].basic_salary) || 0),
    }
  }

  // ── Insights ──
  const insights = []
  const add = (severity, text, action) => insights.push({ severity, text, action })
  const nowMins = now.getHours() * 60 + now.getMinutes()

  if (todayM.counts.unmarked > 0 && active.length && nowMins > minsOf(shiftStart) + 30) {
    add('warning', `${plural(todayM.counts.unmarked, 'employee')} not marked for today yet`, { label: 'Mark attendance', to: '/attendance/daily' })
  }
  const chronic = attention.filter(a => a.absent >= 3)
  if (chronic.length) {
    const names = chronic.slice(0, 3).map(a => a.emp.first_name).join(', ')
    add('critical', `${names}${chronic.length > 3 ? ` +${chronic.length - 3}` : ''} absent 3+ days this month`, { label: 'Review', to: '/attendance/reports' })
  }
  const habitualLate = attention.filter(a => a.late >= 5)
  if (habitualLate.length) {
    const names = habitualLate.slice(0, 3).map(a => a.emp.first_name).join(', ')
    add('warning', `${names}${habitualLate.length > 3 ? ` +${habitualLate.length - 3}` : ''} late 5+ times this month`, { label: 'Review', to: '/attendance/reports' })
  }
  if (t.late > 0) {
    add('info', `${plural(t.late, 'late arrival')} today${todayM.avgLate != null ? ` · avg ${Math.round(todayM.avgLate)} min late` : ''}`, { label: 'See who', to: '/attendance/daily' })
  }
  if (lateLast7 >= 3 && lateLast7 > latePrev7 * 1.3) {
    add('warning', `Late arrivals up ${latePrev7 ? `${Math.round(((lateLast7 - latePrev7) / latePrev7) * 100)}%` : `to ${lateLast7}`} vs the previous 7 days`, { label: 'Trends', to: '/attendance/reports' })
  } else if (latePrev7 >= 3 && lateLast7 < latePrev7 * 0.7) {
    add('success', `Late arrivals down ${Math.round(((latePrev7 - lateLast7) / latePrev7) * 100)}% vs the previous 7 days`)
  }
  if (pay) {
    if (pay.overdue.n) add('critical', `${plural(pay.overdue.n, 'payment')} from earlier months still unpaid`, { label: 'Pay status', to: '/payroll/pay-status' })
    if (!pay.generated && pay.eligible && now.getDate() >= 20) add('warning', `${pay.monthLabel} payroll hasn't been generated yet`, { label: 'Run payroll', to: '/payroll/process' })
    if (pay.Processing.n) add('info', `${plural(pay.Processing.n, 'payslip')} approved and awaiting payment`, { label: 'Pay now', to: '/payroll/pay-status' })
    if (pay.noSalary) add('warning', `${plural(pay.noSalary, 'active employee')} without a base salary`, { label: 'Set salary', to: '/payroll/salary-list' })
  }
  if (newHires.length) add('success', `${plural(newHires.length, 'new hire')} in the last 30 days`, { label: 'Welcome', to: '/employees' })
  if (anniversaries.length) add('info', `${plural(anniversaries.length, 'work anniversary', 'work anniversaries')} this month`)
  if (attended > 0 && todayM.rate >= 95) add('success', `Outstanding attendance today — ${todayM.rate}% in`)
  insights.sort((a, b) => SEVERITY[a.severity] - SEVERITY[b.severity])

  // ── One-line summary ──
  const parts = []
  if (active.length) parts.push(`${attended} of ${expected} in today (${todayM.rate}%)${t.late ? `, ${t.late} late` : ''}`)
  if (pay?.generated) parts.push(`${pay.monthLabel} payroll ${pay.paidPct}% paid`)
  const urgent = insights.filter(i => i.severity === 'critical' || i.severity === 'warning').length
  parts.push(urgent ? `${plural(urgent, 'item')} need${urgent === 1 ? 's' : ''} attention` : 'nothing urgent')

  return {
    today, active, empMap,
    headcount: {
      value: active.length,
      delta: active.length - hiredBy(ago30),
      series: months12.map(m => m.headcount),
      hires: months12.map(m => m.hires),
      months: months12,
      departments: departments.length,
    },
    todayM, trend, heatmap,
    rate14, onTime14, avgRate7, avgOnTime7, lateLast7, latePrev7,
    newHires, anniversaries, perfect, attention, daysTracked,
    depts, pay, insights,
    summary: parts.join(' · '),
  }
}
